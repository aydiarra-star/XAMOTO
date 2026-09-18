/**
 * XAMOTO — Rapports (§25).
 *
 * Le rapport est partageable (PDF à terme, partage web et QR code dès
 * maintenant). Il contient toujours : véhicule, date, kilométrage, diagnostic,
 * DTC, données disponibles, hypothèses, tests, résultats, recommandations,
 * niveau de certitude, niveau de sécurité, sources et provenance.
 */
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { MESSAGES, type ReportPayload } from '@xamoto/shared';
import { KNOWLEDGE_SOURCES, findDtcKnowledge } from '@xamoto/diagnostic';
import { all, get, id, now, run, type Row } from '../db/index.js';
import { config } from '../config.js';

export interface ReportBuildResult {
  reportId: string;
  payload: ReportPayload;
  shareToken: string;
  publicUrl: string;
  qrDataUrl: string;
}

export async function buildDiagnosticReport(input: {
  userId: string;
  vehicleId: string;
  sessionId: string;
  kind?: 'diagnostic' | 'inspection' | 'repair_verification' | 'maintenance' | 'passport';
  title?: string;
}): Promise<ReportBuildResult> {
  const vehicle = get<Row>('SELECT * FROM vehicles WHERE id = ?', [input.vehicleId]);
  if (!vehicle) throw new Error('Véhicule introuvable');
  const session = get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ?', [input.sessionId]);
  if (!session) throw new Error('Session de diagnostic introuvable');

  const dtcs = all<Row>('SELECT * FROM dtc_events WHERE session_id = ? ORDER BY code', [session.obd_session_id ?? '']).map((row) => ({
    code: String(row.code),
    status: String(row.status),
    severity: ((): ReportPayload['dtcs'][number]['severity'] => {
      const knowledge = all<Row>('SELECT severity FROM dtc_codes WHERE code = ?', [String(row.code)])[0];
      return (knowledge?.severity as ReportPayload['dtcs'][number]['severity']) ?? 'attention';
    })(),
    technical: String(all<Row>('SELECT technical FROM dtc_codes WHERE code = ?', [row.code])[0]?.technical ?? 'Définition non disponible'),
    simpleFr: String(all<Row>('SELECT simple_fr FROM dtc_codes WHERE code = ?', [row.code])[0]?.simple_fr ?? 'XAMOTO ne dispose pas de la définition de ce code.'),
  }));

  const measurements = all<Row>('SELECT * FROM obd_data WHERE session_id = ?', [session.obd_session_id ?? '']).map((row) => ({
    label: String(row.label),
    value: row.value === null ? null : Number(row.value),
    unit: String(row.unit),
    supported: Number(row.supported) === 1,
    origin: row.origin as ReportPayload['measurements'][number]['origin'],
    capturedAt: String(row.captured_at),
  }));

  const findings = all<Row>('SELECT * FROM diagnostic_findings WHERE session_id = ?', [input.sessionId]).map((row) => ({
    id: String(row.id),
    sessionId: input.sessionId,
    kind: row.kind as 'dtc' | 'pid_anomaly' | 'symptom' | 'history' | 'coherence',
    titleFr: String(row.title_fr),
    titleEn: String(row.title_en),
    detailFr: String(row.detail_fr),
    detailEn: String(row.detail_en),
    certainty: row.certainty as ReportPayload['diagnosis']['certainty'],
    safety: row.safety as ReportPayload['diagnosis']['safety'],
    evidence: JSON.parse(String(row.evidence ?? '[]')) as ReportPayload['findings'][number]['evidence'],
    origin: row.origin as ReportPayload['measurements'][number]['origin'],
  }));

  const hypotheses = all<Row>('SELECT * FROM hypotheses WHERE session_id = ? ORDER BY score DESC', [input.sessionId]).map((row) => ({
    id: String(row.id),
    causeKey: String(row.cause_key),
    labelFr: String(row.label_fr),
    labelEn: String(row.label_en),
    score: Number(row.score),
    certainty: row.certainty as ReportPayload['diagnosis']['certainty'],
    reasoning: JSON.parse(String(row.reasoning ?? '[]')) as string[],
    supporting: JSON.parse(String(row.supporting ?? '[]')) as string[],
    contradicting: JSON.parse(String(row.contradicting ?? '[]')) as string[],
    discriminatingTests: JSON.parse(String(row.discriminating_tests ?? '[]')) as string[],
    parts: JSON.parse(String(row.parts ?? '[]')) as string[],
  }));

  const tests = all<Row>('SELECT * FROM diagnostic_tests WHERE session_id = ? ORDER BY priority', [input.sessionId]).map((row) => ({
    testKey: String(row.test_key),
    title: String(row.test_key),
    status: String(row.status),
    outcome: null as string | null,
    note: null as string | null,
  }));

  /* §15/§33 : ne sont listées QUE les sources réellement utilisées. */
  const usedSourceIds = new Set<string>();
  if (measurements.length > 0) usedSourceIds.add('src_sae_j1979');
  if (dtcs.length > 0) usedSourceIds.add('src_sae_j2012');
  usedSourceIds.add('src_xamoto_practice');
  for (const dtc of dtcs) {
    const knowledge = findDtcKnowledge(dtc.code);
    if (knowledge) usedSourceIds.add(knowledge.sourceId);
  }
  const sources = KNOWLEDGE_SOURCES.filter((s) => usedSourceIds.has(s.id)).map((s) => ({
    id: s.id,
    title: s.title,
    publisher: s.publisher,
    reliability: s.reliability,
    version: s.version,
    date: s.date,
  }));

  const canIDrive = session.can_i_drive ? (JSON.parse(String(session.can_i_drive)) as ReportPayload['canIDrive']) : undefined;
  const missingData = JSON.parse(String(session.missing_data ?? '[]')) as ReportPayload['missingData'];

  const payload: ReportPayload = {
    vehicle: {
      brand: String(vehicle.brand),
      model: String(vehicle.model),
      year: Number(vehicle.year),
      engine: String(vehicle.engine),
      fuelType: vehicle.fuel_type as ReportPayload['vehicle']['fuelType'],
      vin: vehicle.vin ? String(vehicle.vin) : null,
      plate: vehicle.plate ? String(vehicle.plate) : null,
      odometerKm: Number(vehicle.odometer_km),
    },
    diagnosis: {
      conclusionFr: String(session.conclusion_fr),
      conclusionEn: String(session.conclusion_en),
      certainty: session.certainty as ReportPayload['diagnosis']['certainty'],
      safety: session.safety as ReportPayload['diagnosis']['safety'],
    },
    dtcs,
    measurements,
    findings,
    hypotheses,
    tests,
    recommendations: JSON.parse(String(session.next_steps ?? '[]')) as string[],
    missingData,
    canIDrive,
    sources,
    generatedBy: `XAMOTO ${session.engine_version as string}`,
    disclaimerFr: MESSAGES.noGuaranteeFr,
  };

  const shareToken = randomBytes(12).toString('base64url');
  const publicUrl = `${config.publicUrl}/api/reports/public/${shareToken}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, { margin: 1, width: 320 });

  const reportId = id('report');
  run(
    'INSERT INTO reports (id, vehicle_id, user_id, session_id, kind, title, payload, share_token, public_url, generated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [
      reportId,
      input.vehicleId,
      input.userId,
      input.sessionId,
      input.kind ?? 'diagnostic',
      input.title ?? `Rapport XAMOTO — ${vehicle.brand} ${vehicle.model}`,
      JSON.stringify({ ...payload, generatedAt: now() }),
      shareToken,
      publicUrl,
      now(),
    ],
  );

  return { reportId, payload, shareToken, publicUrl, qrDataUrl };
}

export function reportByToken(token: string): Row | undefined {
  return get<Row>('SELECT * FROM reports WHERE share_token = ?', [token]);
}
