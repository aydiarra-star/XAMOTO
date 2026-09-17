/**
 * XAMOTO — Service de scan (§7, §8, §30, §33).
 *
 * Rôle : exécuter un scan (réel ou simulé), produire un `DiagnosticContext`
 * complet, appeler le moteur de diagnostic, puis TOUT persister avec sa
 * provenance. Chaque donnée enregistrée reste rattachée à une session (§33),
 * et une session de simulateur est identifiable comme telle partout.
 */
import type { DataOrigin, PidKey, SafetyLevel, SymptomInput } from '@xamoto/shared';
import {
  DiagnosticEngine,
  assessSafety,
  canIDrive,
  type CanIDriveAnswer,
  type DiagnosticContext,
  type DiagnosticResult,
  type DtcInput,
  type ReadingInput,
} from '@xamoto/diagnostic';
import {
  Elm327Adapter,
  ObdSimulator,
  SCENARIO_BY_ID,
  SimulatorAdapter,
  TcpTransport,
  type ScanSnapshot,
  type SimulationScenarioId,
} from '@xamoto/obd';
import { all, audit, get, id, jsonParse, now, run, type Row } from '../db/index.js';
import { buildAiContext } from '@xamoto/ai';

export interface RunScanOptions {
  userId: string;
  vehicleId: string;
  mode: 'simulator' | 'obd';
  scenario?: SimulationScenarioId;
  /** Adaptateur Wi-Fi : adresse et port de l'adaptateur ELM327. */
  host?: string;
  port?: number;
  /** Nombre de relevés successifs pour les mesures suivies dans le temps. */
  samples?: number;
  symptoms?: SymptomInput[];
  /** Mode d'analyse demandé. */
  analysisMode?: DiagnosticContext['mode'];
}

export interface ScanOutcome {
  scan: ScanSnapshot & { sessionId: string };
  diagnostic: DiagnosticResult;
  diagnosticSessionId: string;
  scenario?: SimulationScenarioId;
}

const engine = new DiagnosticEngine();

/** PID suivis en série temporelle (activité sonde O2, stabilité ralenti, charge). */
const SERIES_PID_KEYS: PidKey[] = ['engine_rpm', 'coolant_temp', 'battery_voltage', 'o2_b1s1_voltage', 'short_fuel_trim_b1', 'long_fuel_trim_b1'];

type SeriesReading = { key: PidKey; series?: number[] };

/* ────────────────────────────── Scan complet ────────────────────────────── */

export async function runScan(options: RunScanOptions): Promise<ScanOutcome> {
  const samples = Math.max(1, Math.min(options.samples ?? 5, 12));
  const vehicleRow = get<Row>('SELECT * FROM vehicles WHERE id = ?', [options.vehicleId]);
  if (!vehicleRow) throw new Error('Véhicule introuvable');

  const vehicle = {
    id: String(vehicleRow.id),
    brand: String(vehicleRow.brand),
    model: String(vehicleRow.model),
    year: Number(vehicleRow.year),
    engine: String(vehicleRow.engine),
    fuelType: String(vehicleRow.fuel_type) as NonNullable<DiagnosticContext['vehicle']>['fuelType'],
    odometerKm: Number(vehicleRow.odometer_km),
    vin: vehicleRow.vin ? String(vehicleRow.vin) : null,
    plate: vehicleRow.plate ? String(vehicleRow.plate) : null,
    supportedPids: jsonParse<string[]>(vehicleRow.supported_pids, []),
  };

  const startedAt = now();
  const obdSessionId = id('scan');
  let snapshot: ScanSnapshot;
  let deviceFailed: string | null = null;

  /* ── Acquisition ──────────────────────────────────────────────────────── */
  if (options.mode === 'obd') {
    if (!options.host) throw new Error('Adresse de l’adaptateur requise pour un scan réel.');
    const transport = new TcpTransport({ host: options.host, port: options.port });
    const adapter = new Elm327Adapter({ transport });
    try {
      snapshot = await adapter.scan({ vehicle });
      snapshot = await enrichWithSeries(adapter, snapshot, samples);
    } catch (error) {
      deviceFailed = (error as Error).message;
      // Une session échouée est enregistrée comme telle : XAMOTO ne fabrique
      // jamais de données pour compenser un échec de liaison.
      run(
        'INSERT INTO obd_sessions (id, vehicle_id, user_id, source, scenario, protocol, started_at, ended_at, status, error_message, mil_on, pid_count, dtc_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [obdSessionId, options.vehicleId, options.userId, 'obd', null, null, startedAt, now(), 'failed', deviceFailed, 0, 0, 0],
      );
      audit('scan.failed', 'obd_sessions', obdSessionId, options.userId, { error: deviceFailed });
      throw new Error(`Lecture OBD impossible (${deviceFailed}). Aucune donnée n’a été enregistrée.`);
    } finally {
      await adapter.disconnect().catch(() => undefined);
    }
  } else {
    const scenarioId = options.scenario ?? 'normal_engine';
    const adapter = new SimulatorAdapter({ scenario: scenarioId });
    snapshot = await adapter.scan({ vehicle });
    snapshot = await enrichSimulatedSeries(adapter, snapshot, samples);
  }

  const finishedAt = now();

  /* ── Persistance de la session OBD et des données (§33) ──────────────── */
  run(
    'INSERT INTO obd_sessions (id, vehicle_id, user_id, source, scenario, protocol, started_at, ended_at, status, mil_on, pid_count, dtc_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [
      obdSessionId,
      options.vehicleId,
      options.userId,
      snapshot.source,
      options.scenario ?? null,
      snapshot.protocol,
      startedAt,
      finishedAt,
      'completed',
      snapshot.milOn ? 1 : 0,
      snapshot.readings.length,
      snapshot.dtcs.length,
    ],
  );

  for (const reading of snapshot.readings) {
    const series = (reading as SeriesReading).series;
    run(
      'INSERT INTO obd_data (id, session_id, vehicle_id, pid, pid_key, label, value, unit, supported, origin, condition, series, captured_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        id('data'),
        obdSessionId,
        options.vehicleId,
        reading.obdPid,
        reading.key,
        reading.label,
        reading.value,
        reading.unit,
        reading.supported ? 1 : 0,
        reading.origin,
        reading.condition ?? null,
        series && series.length > 0 ? JSON.stringify(series) : null,
        reading.capturedAt,
      ],
    );
  }

  /* ── Historique des défauts : un code effacé puis revenu est une preuve ── */
  const clearedCodes = new Set(
    all<Row>('SELECT DISTINCT code FROM dtc_events WHERE vehicle_id = ? AND cleared_at IS NOT NULL', [options.vehicleId]).map((r) => String(r.code)),
  );

  const dtcInputs: DtcInput[] = [];
  for (const dtc of snapshot.dtcs) {
    const previous = get<Row>(
      'SELECT first_seen_at, occurrences FROM dtc_events WHERE vehicle_id = ? AND code = ? ORDER BY last_seen_at DESC LIMIT 1',
      [options.vehicleId, dtc.code],
    );
    const occurrences = Math.max(Number(previous?.occurrences ?? 0), dtc.occurrences ?? 1);
    const returnedAfterClear = clearedCodes.has(dtc.code);
    run(
      'INSERT INTO dtc_events (id, session_id, vehicle_id, code, status, occurrences, freeze_frame, origin, first_seen_at, last_seen_at, returned_after_clear) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [
        id('dtc'),
        obdSessionId,
        options.vehicleId,
        dtc.code,
        dtc.status,
        occurrences,
        dtc.freezeFrame ? JSON.stringify(dtc.freezeFrame) : null,
        dtc.origin,
        (previous?.first_seen_at as string | null) ?? dtc.lastSeenAt,
        dtc.lastSeenAt,
        returnedAfterClear ? 1 : 0,
      ],
    );
    dtcInputs.push({
      code: dtc.code,
      status: dtc.status,
      occurrences,
      firstSeenAt: (previous?.first_seen_at as string | null) ?? dtc.lastSeenAt,
      lastSeenAt: dtc.lastSeenAt,
      returnedAfterClear,
      freezeFrame: dtc.freezeFrame,
      origin: dtc.origin,
    });
  }

  /* ── Construction du contexte de diagnostic ──────────────────────────── */
  const context = buildContext({
    vehicle,
    snapshot,
    vehicleId: options.vehicleId,
    obdSessionId,
    symptoms: options.symptoms ?? [],
    mode: options.analysisMode ?? 'standard',
    dtcInputs,
    clearedCodes: [...clearedCodes],
  });

  /* ── Moteur de diagnostic (§9) ───────────────────────────────────────── */
  const diagnosticSessionId = id('diag');
  const diagnostic = engine.analyze(context, {
    sessionId: diagnosticSessionId,
    vehicleId: options.vehicleId,
    userId: options.userId,
    mode: context.mode,
  });

  persistDiagnostic(diagnosticSessionId, options, obdSessionId, diagnostic);

  /* ── Événements, passeport, alertes (§21, §22) ───────────────────────── */
  recordEvent({
    vehicleId: options.vehicleId,
    type: 'scan',
    titleFr: snapshot.source === 'simulator' ? 'Scan simulé (MODE SIMULATION)' : 'Scan OBD',
    titleEn: snapshot.source === 'simulator' ? 'Simulated scan (SIMULATION MODE)' : 'OBD scan',
    detail: `${snapshot.readings.length} mesures, ${snapshot.dtcs.length} défaut(s) — certitude : ${diagnostic.certainty}`,
    refId: obdSessionId,
    odometerKm: vehicle.odometerKm,
    origin: snapshot.source === 'simulator' ? 'simulated' : 'measured',
  });
  recordEvent({
    vehicleId: options.vehicleId,
    type: 'diagnostic',
    titleFr: 'Diagnostic XAMOTO',
    titleEn: 'XAMOTO diagnosis',
    detail: diagnostic.conclusionFr,
    refId: diagnosticSessionId,
    odometerKm: vehicle.odometerKm,
    origin: diagnostic.dataOrigin === 'simulator' ? 'simulated' : 'measured',
  });
  refreshPassport(options.vehicleId);
  refreshAlerts(options.vehicleId, diagnostic, options.userId);

  audit('scan.completed', 'obd_sessions', obdSessionId, options.userId, {
    source: snapshot.source,
    scenario: options.scenario ?? null,
    dtcCount: snapshot.dtcs.length,
    certainty: diagnostic.certainty,
    safety: diagnostic.safety,
  });

  const stored = { ...snapshot, sessionId: obdSessionId };
  return { scan: stored, diagnostic, diagnosticSessionId, scenario: options.scenario };
}

/* ───────────────────── Contexte de diagnostic réutilisable ─────────────── */

function buildContext(input: {
  vehicle: NonNullable<DiagnosticContext['vehicle']>;
  snapshot: ScanSnapshot;
  vehicleId: string;
  obdSessionId: string;
  symptoms: SymptomInput[];
  mode: NonNullable<DiagnosticContext['mode']>;
  dtcInputs: DtcInput[];
  clearedCodes: string[];
}): DiagnosticContext {
  const readings: ReadingInput[] = input.snapshot.readings.map((r) => ({
    key: r.key,
    label: r.label,
    value: r.value,
    unit: r.unit,
    supported: r.supported,
    origin: r.origin,
    condition: r.condition,
    series: (r as SeriesReading).series,
    capturedAt: r.capturedAt,
  }));

  return {
    vehicle: input.vehicle,
    spec: loadVehicleSpec(input.vehicle),
    readings,
    dtcs: input.dtcInputs,
    symptoms: input.symptoms,
    history: {
      previousScans: loadPreviousScans(input.vehicleId, input.obdSessionId),
      repairs: loadRepairs(input.vehicleId),
      returnedCodes: input.clearedCodes,
    },
    source: input.snapshot.source,
    mode: input.mode,
  };
}

function loadVehicleSpec(vehicle: NonNullable<DiagnosticContext['vehicle']>): DiagnosticContext['spec'] {
  const specRow = get<Row>(
    'SELECT * FROM vehicle_specs WHERE lower(brand) = lower(?) AND lower(model) = lower(?) AND ? BETWEEN year_from AND year_to ORDER BY year_from DESC LIMIT 1',
    [vehicle.brand ?? '', vehicle.model ?? '', vehicle.year ?? 0],
  );
  if (!specRow) return null;
  return {
    oilSpec: String(specRow.oil_spec ?? ''),
    oilCapacityL: specRow.oil_capacity_l === null ? undefined : Number(specRow.oil_capacity_l),
    coolantSpec: String(specRow.coolant_spec ?? ''),
    timingType: (specRow.timing_type as 'chaine' | 'courroie' | 'inconnu') ?? 'inconnu',
    timingIntervalKm: specRow.timing_interval_km === null ? null : Number(specRow.timing_interval_km),
    commonIssues: jsonParse<string[]>(specRow.common_issues, []),
    sourceId: String(specRow.source_id ?? ''),
  };
}

function loadPreviousScans(vehicleId: string, excludeSessionId: string): NonNullable<DiagnosticContext['history']>['previousScans'] {
  const sessions = all<Row>('SELECT id, started_at FROM obd_sessions WHERE vehicle_id = ? AND id <> ? AND status = ? ORDER BY started_at DESC LIMIT 5', [
    vehicleId,
    excludeSessionId,
    'completed',
  ]);
  return sessions.map((row) => {
    const keyValues: Record<string, number | null> = {};
    for (const data of all<Row>('SELECT pid_key, value FROM obd_data WHERE session_id = ?', [String(row.id)])) {
      keyValues[String(data.pid_key)] = data.value === null ? null : Number(data.value);
    }
    return {
      id: String(row.id),
      finishedAt: String(row.started_at),
      dtcCodes: all<Row>('SELECT code FROM dtc_events WHERE session_id = ?', [String(row.id)]).map((d) => String(d.code)),
      keyValues,
    };
  });
}

function loadRepairs(vehicleId: string): NonNullable<DiagnosticContext['history']>['repairs'] {
  return all<Row>('SELECT id, description, performed_at, parts_replaced FROM repairs WHERE vehicle_id = ? ORDER BY performed_at DESC LIMIT 10', [vehicleId]).map(
    (row) => ({
      id: String(row.id),
      description: String(row.description),
      performedAt: String(row.performed_at),
      partsLabels: jsonParse<Array<{ label?: string }>>(row.parts_replaced, []).map((p) => String(p.label ?? '')),
    }),
  );
}

/**
 * Recharge un contexte complet depuis la base (tests guidés, seconde opinion,
 * inspection avant achat). Le scan d'origine n'est jamais modifié : les tests
 * confirmés s'ajOUTENT au contexte et le moteur recalcule tout.
 */
export function buildStoredContext(options: {
  vehicleId: string;
  obdSessionId: string;
  mode?: NonNullable<DiagnosticContext['mode']>;
  testResults?: DiagnosticContext['testResults'];
  symptoms?: SymptomInput[];
}): DiagnosticContext {
  const vehicleRow = get<Row>('SELECT * FROM vehicles WHERE id = ?', [options.vehicleId]);
  if (!vehicleRow) throw new Error('Véhicule introuvable');
  const snapshot = loadScanSnapshot(options.obdSessionId);
  const vehicle = {
    id: String(vehicleRow.id),
    brand: String(vehicleRow.brand),
    model: String(vehicleRow.model),
    year: Number(vehicleRow.year),
    engine: String(vehicleRow.engine),
    fuelType: String(vehicleRow.fuel_type) as NonNullable<DiagnosticContext['vehicle']>['fuelType'],
    odometerKm: Number(vehicleRow.odometer_km),
    vin: vehicleRow.vin ? String(vehicleRow.vin) : null,
    plate: vehicleRow.plate ? String(vehicleRow.plate) : null,
  };

  const symptoms: SymptomInput[] =
    options.symptoms ??
    (jsonParse<SymptomInput[]>(
      get<Row>('SELECT symptoms FROM diagnostic_sessions WHERE obd_session_id = ? ORDER BY started_at DESC LIMIT 1', [options.obdSessionId])?.symptoms ?? '[]',
      [],
    ) as SymptomInput[]);

  const dtcInputs: DtcInput[] = all<Row>('SELECT * FROM dtc_events WHERE session_id = ?', [options.obdSessionId]).map((row) => ({
    code: String(row.code),
    status: String(row.status) as DtcInput['status'],
    occurrences: Number(row.occurrences),
    firstSeenAt: row.first_seen_at ? String(row.first_seen_at) : null,
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
    returnedAfterClear: Number(row.returned_after_clear) === 1,
    origin: String(row.origin) as DataOrigin,
  }));

  return {
    vehicle,
    spec: loadVehicleSpec(vehicle),
    readings: snapshot.readings.map((r) => ({
      key: r.key,
      label: r.label,
      value: r.value,
      unit: r.unit,
      supported: r.supported,
      origin: r.origin,
      condition: r.condition,
      capturedAt: r.capturedAt,
    })),
    dtcs: dtcInputs,
    symptoms,
    history: {
      previousScans: loadPreviousScans(options.vehicleId, options.obdSessionId),
      repairs: loadRepairs(options.vehicleId),
      returnedCodes: dtcInputs.filter((d) => d.returnedAfterClear).map((d) => d.code),
    },
    source: snapshot.source,
    mode: options.mode ?? 'standard',
    testResults: options.testResults,
  };
}

/** Relit un scan persisté sous forme d'instantané exploitable. */
export function loadScanSnapshot(obdSessionId: string): ScanSnapshot {
  const session = get<Row>('SELECT * FROM obd_sessions WHERE id = ?', [obdSessionId]);
  if (!session) throw new Error('Scan introuvable');
  const readings = all<Row>('SELECT * FROM obd_data WHERE session_id = ?', [obdSessionId]).map((row) => ({
    key: String(row.pid_key) as PidKey,
    obdPid: String(row.pid),
    label: String(row.label),
    value: row.value === null ? null : Number(row.value),
    unit: String(row.unit),
    supported: Number(row.supported) === 1,
    origin: String(row.origin) as DataOrigin,
    condition: (row.condition ? String(row.condition) : 'unknown') as 'cold' | 'warm' | 'running' | 'idle' | 'unknown',
    capturedAt: String(row.captured_at),
    series: jsonParse<number[] | undefined>(row.series, undefined),
  }));
  const dtcs = all<Row>('SELECT * FROM dtc_events WHERE session_id = ?', [obdSessionId]).map((row) => ({
    code: String(row.code),
    status: String(row.status) as 'active' | 'pending' | 'permanent' | 'stored',
    occurrences: Number(row.occurrences),
    lastSeenAt: String(row.last_seen_at),
    freezeFrame: row.freeze_frame ? jsonParse<Record<string, number | string | null>>(row.freeze_frame, {}) : undefined,
    origin: String(row.origin) as DataOrigin,
  }));

  return {
    sessionId: String(session.id),
    vehicleId: String(session.vehicle_id),
    source: String(session.source) as 'obd' | 'simulator',
    protocol: session.protocol ? String(session.protocol) : null,
    startedAt: String(session.started_at),
    finishedAt: String(session.ended_at ?? session.started_at),
    device: null,
    readings: readings as ScanSnapshot['readings'],
    dtcs,
    milOn: Number(session.mil_on) === 1,
    unsupportedPids: readings.filter((r) => !r.supported).map((r) => String(r.key)),
    warnings: [],
    notes: [],
  };
}

/** Réexécute le moteur de diagnostic sur un scan existant (avec tests confirmés). */
export function reanalyzeDiagnostic(options: {
  vehicleId: string;
  obdSessionId: string;
  mode?: NonNullable<DiagnosticContext['mode']>;
  testResults?: DiagnosticContext['testResults'];
  symptoms?: SymptomInput[];
}): { context: DiagnosticContext; result: DiagnosticResult } {
  const context = buildStoredContext(options);
  const result = engine.analyze(context, { vehicleId: options.vehicleId, mode: context.mode });
  return { context, result };
}

function persistDiagnostic(diagnosticSessionId: string, options: RunScanOptions, obdSessionId: string, diagnostic: DiagnosticResult): void {
  run(
    `INSERT INTO diagnostic_sessions
      (id, vehicle_id, user_id, obd_session_id, mode, status, started_at, completed_at, symptoms, certainty, safety, conclusion_fr, conclusion_en, missing_data, next_steps, rules_fired, engine_version, data_origin, can_i_drive, debug_trace)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      diagnosticSessionId,
      options.vehicleId,
      options.userId,
      obdSessionId,
      options.analysisMode ?? 'standard',
      'completed',
      now(),
      now(),
      JSON.stringify(options.symptoms ?? []),
      diagnostic.certainty,
      diagnostic.safety,
      diagnostic.conclusionFr,
      diagnostic.conclusionEn,
      JSON.stringify(diagnostic.missingData),
      JSON.stringify(diagnostic.tests.map((test) => test.testKey)),
      JSON.stringify(diagnostic.rulesFired),
      diagnostic.engineVersion,
      diagnostic.dataOrigin,
      JSON.stringify(diagnostic.canIDrive),
      JSON.stringify(diagnostic.debug),
    ],
  );

  for (const finding of diagnostic.findings) {
    run(
      'INSERT INTO diagnostic_findings (id, session_id, kind, title_fr, title_en, detail_fr, detail_en, certainty, safety, evidence, origin) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [
        id('find'),
        diagnosticSessionId,
        finding.kind,
        finding.titleFr,
        finding.titleEn,
        finding.detailFr,
        finding.detailEn,
        finding.certainty,
        finding.safety,
        JSON.stringify(finding.evidence),
        finding.origin,
      ],
    );
  }

  for (const hypothesis of diagnostic.hypotheses) {
    run(
      'INSERT INTO hypotheses (id, session_id, cause_key, label_fr, label_en, score, certainty, reasoning, supporting, contradicting, discriminating_tests, parts) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        id('hyp'),
        diagnosticSessionId,
        hypothesis.causeKey,
        hypothesis.labelFr,
        hypothesis.labelEn,
        hypothesis.score,
        hypothesis.certainty,
        JSON.stringify(hypothesis.reasoning),
        JSON.stringify(hypothesis.supporting),
        JSON.stringify(hypothesis.contradicting),
        JSON.stringify(hypothesis.discriminatingTests),
        JSON.stringify(hypothesis.parts),
      ],
    );
  }

  for (const test of diagnostic.tests) {
    run('INSERT INTO diagnostic_tests (id, session_id, test_key, status, priority, reason_fr, reason_en, proposed_at) VALUES (?,?,?,?,?,?,?,?)', [
      id('dtest'),
      diagnosticSessionId,
      test.testKey,
      test.status,
      test.priority,
      test.reasonFr,
      test.reasonEn,
      test.proposedAt,
    ]);
  }
}

/* ─────────────────── Acquisition : séries temporelles (§23) ─────────────── */

/** Complète le scan simulé par des séries temporelles cohérentes. */
async function enrichSimulatedSeries(adapter: SimulatorAdapter, snapshot: ScanSnapshot, samples: number): Promise<ScanSnapshot> {
  const seriesByKey = new Map<string, number[]>();
  const simulator = new ObdSimulator(adapter.scenario.id, 7);
  for (let i = 0; i < samples; i += 1) {
    const state = simulator.tick(4);
    for (const reading of state.readings) {
      if (!SERIES_PID_KEYS.includes(reading.key)) continue;
      if (reading.value === null) continue;
      const list = seriesByKey.get(reading.key) ?? [];
      list.push(reading.value);
      seriesByKey.set(reading.key, list);
    }
  }
  return {
    ...snapshot,
    readings: snapshot.readings.map((reading) => ({ ...reading, series: seriesByKey.get(reading.key) })),
  };
}

/** Pour un adaptateur réel : plusieurs relevés des PID suivis dans le temps. */
async function enrichWithSeries(adapter: Elm327Adapter, snapshot: ScanSnapshot, samples: number): Promise<ScanSnapshot> {
  const seriesByKey = new Map<string, number[]>();
  for (let i = 0; i < samples; i += 1) {
    const readings = await adapter.readPids(SERIES_PID_KEYS);
    for (const reading of readings) {
      if (reading.value === null) continue;
      const list = seriesByKey.get(reading.key) ?? [];
      list.push(reading.value);
      seriesByKey.set(reading.key, list);
    }
  }
  return {
    ...snapshot,
    readings: snapshot.readings.map((reading) => ({ ...reading, series: seriesByKey.get(reading.key) })),
  };
}

/* ─────────────────────────── Utilitaires communs ───────────────────────── */

export function recordEvent(input: {
  vehicleId: string;
  type: string;
  titleFr: string;
  titleEn: string;
  detail?: string | null;
  refId?: string | null;
  odometerKm?: number | null;
  occurredAt?: string;
  origin?: DataOrigin;
}): void {
  run('INSERT INTO vehicle_events (id, vehicle_id, type, title_fr, title_en, detail, ref_id, odometer_km, occurred_at, origin) VALUES (?,?,?,?,?,?,?,?,?,?)', [
    id('evt'),
    input.vehicleId,
    input.type,
    input.titleFr,
    input.titleEn,
    input.detail ?? null,
    input.refId ?? null,
    input.odometerKm ?? null,
    input.occurredAt ?? now(),
    input.origin ?? 'measured',
  ]);
}

export function refreshPassport(vehicleId: string): void {
  const counts = {
    diagnostics: Number(get<Row>('SELECT COUNT(*) AS c FROM diagnostic_sessions WHERE vehicle_id = ?', [vehicleId])?.c ?? 0),
    repairs: Number(get<Row>('SELECT COUNT(*) AS c FROM repairs WHERE vehicle_id = ?', [vehicleId])?.c ?? 0),
    maintenance: Number(get<Row>('SELECT COUNT(*) AS c FROM maintenance WHERE vehicle_id = ?', [vehicleId])?.c ?? 0),
    documents: Number(get<Row>('SELECT COUNT(*) AS c FROM vehicle_documents WHERE vehicle_id = ?', [vehicleId])?.c ?? 0),
  };
  const range = get<Row>('SELECT MIN(occurred_at) AS first, MAX(occurred_at) AS last FROM vehicle_events WHERE vehicle_id = ?', [vehicleId]);
  const vehicle = get<Row>('SELECT brand, model, year, engine, fuel_type, odometer_km, vin, plate FROM vehicles WHERE id = ?', [vehicleId]);
  const lastDiagnostic = get<Row>(
    'SELECT certainty, safety, conclusion_fr, started_at, data_origin FROM diagnostic_sessions WHERE vehicle_id = ? ORDER BY started_at DESC LIMIT 1',
    [vehicleId],
  );
  const scanCount = Number(get<Row>('SELECT COUNT(*) AS c FROM obd_sessions WHERE vehicle_id = ?', [vehicleId])?.c ?? 0);

  run(
    `INSERT INTO vehicle_passport (vehicle_id, summary, diagnostics, repairs, maintenance, documents, first_event_at, last_event_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(vehicle_id) DO UPDATE SET summary = excluded.summary, diagnostics = excluded.diagnostics, repairs = excluded.repairs,
       maintenance = excluded.maintenance, documents = excluded.documents, first_event_at = excluded.first_event_at,
       last_event_at = excluded.last_event_at, updated_at = excluded.updated_at`,
    [
      vehicleId,
      JSON.stringify({
        vehicle,
        counts,
        scans: scanCount,
        lastDiagnostic: lastDiagnostic
          ? {
              certainty: lastDiagnostic.certainty,
              safety: lastDiagnostic.safety,
              conclusionFr: lastDiagnostic.conclusion_fr,
              at: lastDiagnostic.started_at,
              dataOrigin: lastDiagnostic.data_origin,
            }
          : null,
      }),
      counts.diagnostics,
      counts.repairs,
      counts.maintenance,
      counts.documents,
      (range?.first as string | null) ?? null,
      (range?.last as string | null) ?? null,
      now(),
    ],
  );
}

/** Alertes créées par le moteur (§22, §23) — jamais par une règle commerciale. */
function refreshAlerts(vehicleId: string, diagnostic: DiagnosticResult, userId: string): void {
  const level: SafetyLevel = diagnostic.safety;
  if (level !== 'critical' && level !== 'important') return;
  const existing = get<Row>("SELECT id FROM alerts WHERE vehicle_id = ? AND kind = 'security' AND created_at >= datetime('now', '-1 day')", [vehicleId]);
  if (existing) return;
  run('INSERT INTO alerts (id, user_id, vehicle_id, level, kind, title_fr, title_en, body_fr, body_en, ref_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
    id('alert'),
    userId,
    vehicleId,
    level,
    'security',
    `Niveau de sécurité : ${level}`,
    `Safety level: ${level}`,
    diagnostic.conclusionFr,
    diagnostic.conclusionEn,
    null,
    now(),
  ]);
}

export function vehicleRowToApi(row: Row, spec?: Row | null): Record<string, unknown> {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    generation: row.generation,
    year: row.year,
    engine: row.engine,
    engineDisplacementCc: row.engine_cc,
    fuelType: row.fuel_type,
    gearbox: row.gearbox,
    powerHp: row.power_hp,
    vin: row.vin,
    plate: row.plate,
    country: row.country,
    purchaseDate: row.purchase_date,
    odometerKm: row.odometer_km,
    odometerUpdatedAt: row.odometer_updated_at,
    nickname: row.nickname,
    obdProtocol: row.obd_protocol,
    supportedPids: jsonParse<string[]>(row.supported_pids, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    spec: spec
      ? {
          oilSpec: spec.oil_spec,
          oilCapacityL: spec.oil_capacity_l,
          coolantSpec: spec.coolant_spec,
          timingType: spec.timing_type,
          timingIntervalKm: spec.timing_interval_km,
          sparkPlugSpec: spec.spark_plug_spec,
          commonIssues: jsonParse<string[]>(spec.common_issues, []),
          sourceId: spec.source_id,
        }
      : null,
  };
}

/** Scénarios disponibles pour le mode démo (§31). */
export function availableScenarios(): Array<{
  id: string;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
  vehicle: unknown;
  dtcCount: number;
}> {
  return [...SCENARIO_BY_ID.values()].map((scenario) => ({
    id: scenario.id,
    labelFr: scenario.labelFr,
    labelEn: scenario.labelEn,
    descriptionFr: scenario.descriptionFr,
    descriptionEn: scenario.descriptionEn,
    vehicle: scenario.demoVehicle,
    dtcCount: scenario.dtcs.length,
  }));
}

/**
 * « Puis-je rouler ? » tel qu'il doit être présenté, y compris lorsque aucune
 * donnée n'est disponible : XAMOTO refuse alors explicitement de garantir.
 */
export function canIDriveForContext(context: DiagnosticContext, result?: DiagnosticResult | null): CanIDriveAnswer {
  if (result?.canIDrive) return result.canIDrive;
  const assessment = assessSafety(context, []);
  if (context.readings.length === 0 && context.dtcs.length === 0) {
    assessment.dataQuality.notes.push('Aucun diagnostic n’a encore été réalisé sur ce véhicule.');
    assessment.cannotGuarantee = true;
  }
  return canIDrive(context, assessment);
}

export { buildAiContext };
