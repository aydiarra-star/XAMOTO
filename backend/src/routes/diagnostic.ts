/**
 * XAMOTO — Diagnostic, tests guidés, seconde opinion, inspection, réparation
 * (§9 → §24, §30).
 *
 * Aucune route ne produit de conclusion par elle-même : toutes passent par le
 * moteur de diagnostic déterministe (diagnostic/engine). L'IA n'intervient
 * qu'en explication, via la couche ai/.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { all, audit, get, id, jsonParse, now, run, type Row } from '../db/index.js';
import { assertVehicleAccess, authenticate, type AuthUser } from '../auth/index.js';
import { buildStoredContext, recordEvent, refreshPassport, vehicleRowToApi } from '../services/scanService.js';
import {
  ALL_DTC_KNOWLEDGE,
  DiagnosticEngine,
  GUIDED_TESTS,
  SYMPTOM_DEFINITIONS,
  buildGuidedSession,
  buildInspectionReport,
  compareAfterRepair,
  describeUnknownDtc,
  findDtcKnowledge,
  secondOpinion,
  type DiagnosticContext,
  type DiagnosticResult,
} from '@xamoto/diagnostic';

const engine = new DiagnosticEngine();

/** Sérialisation stable d'une session de diagnostic pour l'API. */
export function serializeDiagnostic(row: Row): Record<string, unknown> {
  const hypotheses = all<Row>('SELECT * FROM hypotheses WHERE session_id = ? ORDER BY score DESC', [String(row.id)]).map((hypothesis) => ({
    id: hypothesis.id,
    causeKey: hypothesis.cause_key,
    labelFr: hypothesis.label_fr,
    labelEn: hypothesis.label_en,
    score: Number(hypothesis.score),
    certainty: hypothesis.certainty,
    reasoning: jsonParse<string[]>(hypothesis.reasoning, []),
    supporting: jsonParse<string[]>(hypothesis.supporting, []),
    contradicting: jsonParse<string[]>(hypothesis.contradicting, []),
    discriminatingTests: jsonParse<string[]>(hypothesis.discriminating_tests, []),
    parts: jsonParse<string[]>(hypothesis.parts, []),
  }));

  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    userId: row.user_id,
    obdSessionId: row.obd_session_id,
    mode: row.mode,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    certainty: row.certainty,
    safety: row.safety,
    conclusionFr: row.conclusion_fr,
    conclusionEn: row.conclusion_en,
    canIDrive: row.can_i_drive ? jsonParse<Record<string, unknown>>(row.can_i_drive, {}) : null,
    symptoms: jsonParse<unknown[]>(row.symptoms, []),
    missingData: jsonParse<unknown[]>(row.missing_data, []),
    nextSteps: jsonParse<string[]>(row.next_steps, []),
    rulesFired: jsonParse<string[]>(row.rules_fired, []),
    engineVersion: row.engine_version,
    dataOrigin: row.data_origin,
    hypotheses,
    findings: all<Row>('SELECT * FROM diagnostic_findings WHERE session_id = ? ORDER BY certainty DESC, id ASC', [String(row.id)]).map((finding) => ({
      id: finding.id,
      kind: finding.kind,
      titleFr: finding.title_fr,
      titleEn: finding.title_en,
      detailFr: finding.detail_fr,
      detailEn: finding.detail_en,
      certainty: finding.certainty,
      safety: finding.safety,
      evidence: jsonParse<unknown[]>(finding.evidence, []),
      origin: finding.origin,
    })),
    tests: all<Row>('SELECT * FROM diagnostic_tests WHERE session_id = ? ORDER BY priority ASC', [String(row.id)]).map((test) => ({
      id: test.id,
      testKey: test.test_key,
      titleFr: findTest(String(test.test_key))?.titleFr ?? String(test.test_key),
      titleEn: findTest(String(test.test_key))?.titleEn ?? String(test.test_key),
      objectiveFr: findTest(String(test.test_key))?.objectiveFr ?? null,
      objectiveEn: findTest(String(test.test_key))?.objectiveEn ?? null,
      equipment: findTest(String(test.test_key))?.equipment ?? [],
      durationMin: findTest(String(test.test_key))?.durationMin ?? null,
      safety: findTest(String(test.test_key))?.safety ?? 'normal',
      status: test.status,
      priority: Number(test.priority),
      reasonFr: test.reason_fr,
      reasonEn: test.reason_en,
      proposedAt: test.proposed_at,
      result: testResultFor(String(test.id)),
    })),
    disclaimerFr:
      'XAMOTO fournit une aide au diagnostic. Il ne remplace pas l’avis d’un professionnel et n’engage aucune garantie sur l’état réel du véhicule.',
  };
}

function findTest(testKey: string) {
  const definition = GUIDED_TESTS.find((test) => test.id === testKey);
  if (!definition) return null;
  return {
    titleFr: definition.titleFr,
    titleEn: definition.titleEn,
    objectiveFr: definition.objectiveFr,
    objectiveEn: definition.objectiveEn,
    equipment: definition.equipment,
    durationMin: definition.durationMin,
    safety: definition.safety,
  };
}

function testResultFor(testId: string): Record<string, unknown> | null {
  const row = get<Row>('SELECT * FROM diagnostic_test_results WHERE test_id = ? ORDER BY recorded_at DESC LIMIT 1', [testId]);
  if (!row) return null;
  return {
    outcome: row.outcome,
    measuredValue: row.measured_value === null ? null : Number(row.measured_value),
    unit: row.unit,
    note: row.note,
    origin: row.origin,
    recordedAt: row.recorded_at,
  };
}

/** Contexte + résultat pour une session de diagnostic persistée. */
export function loadContextAndResult(diagnosticRow: Row): { context: DiagnosticContext; result: DiagnosticResult } {
  const obdSessionId = diagnosticRow.obd_session_id ? String(diagnosticRow.obd_session_id) : '';
  const testResults = all<Row>('SELECT t.test_key, r.outcome, r.note FROM diagnostic_test_results r JOIN diagnostic_tests t ON t.id = r.test_id WHERE r.session_id = ?', [
    String(diagnosticRow.id),
  ]).map((row) => ({
    testKey: String(row.test_key),
    outcome: String(row.outcome) as NonNullable<DiagnosticContext['testResults']>[number]['outcome'],
    note: row.note === null ? null : String(row.note),
  }));

  const context = buildStoredContext({
    vehicleId: String(diagnosticRow.vehicle_id),
    obdSessionId,
    mode: String(diagnosticRow.mode) as NonNullable<DiagnosticContext['mode']>,
    testResults,
  });
  const result = engine.analyze(context, { vehicleId: String(diagnosticRow.vehicle_id), sessionId: String(diagnosticRow.id), mode: context.mode });
  return { context, result };
}

export async function diagnosticRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  /* ─────────────────────── Référentiels techniques ──────────────────────── */

  app.get('/api/knowledge/tests', async (_request, reply) => {
    return reply.send({
      tests: GUIDED_TESTS.map((test) => ({
        id: test.id,
        titleFr: test.titleFr,
        titleEn: test.titleEn,
        objectiveFr: test.objectiveFr,
        objectiveEn: test.objectiveEn,
        equipment: test.equipment,
        stepsFr: test.stepsFr,
        stepsEn: test.stepsEn,
        expectedFr: test.expectedFr,
        expectedEn: test.expectedEn,
        interpretation: test.interpretation,
        conditions: test.conditions,
        durationMin: test.durationMin,
        safety: test.safety,
        appliesTo: test.appliesTo ?? null,
        sourceId: test.sourceId,
      })),
      notice: 'Un test ne s’improvise pas : respectez les consignes de sécurité et n’intervenez pas sur un véhicule chaud ou sous le véhicule.',
    });
  });

  app.get('/api/knowledge/symptoms', async (_request, reply) => {
    return reply.send({
      symptoms: SYMPTOM_DEFINITIONS.map((symptom) => ({
        key: symptom.key,
        labelFr: symptom.labelFr,
        labelEn: symptom.labelEn,
        systems: symptom.systems,
        safety: symptom.safety,
      })),
      notice: 'Un symptôme seul ne permet jamais de conclure : il oriente les vérifications.',
    });
  });

  app.get('/api/knowledge/dtc', async (request, reply) => {
    const query = request.query as { code?: string; search?: string; system?: string };
    let rows = ALL_DTC_KNOWLEDGE;
    if (query.code) rows = rows.filter((dtc) => dtc.code.toUpperCase() === query.code!.toUpperCase());
    if (query.system) rows = rows.filter((dtc) => dtc.system === query.system);
    if (query.search) {
      const needle = query.search.toLowerCase();
      rows = rows.filter(
        (dtc) => dtc.code.toLowerCase().includes(needle) || dtc.simpleFr.toLowerCase().includes(needle) || dtc.technical.toLowerCase().includes(needle),
      );
    }
    return reply.send({
      codes: rows.map((dtc) => ({
        code: dtc.code,
        technical: dtc.technical,
        simpleFr: dtc.simpleFr,
        simpleEn: dtc.simpleEn,
        system: dtc.system,
        severity: dtc.severity,
        canDriveDefault: dtc.canDriveDefault,
        consequences: dtc.consequences,
        likelyCauses: dtc.likelyCauses,
        relatedTests: dtc.relatedTests,
        provenanceNote: dtc.provenanceNote,
        sourceId: dtc.sourceId,
      })),
      total: rows.length,
      notice: 'Chaque définition indique sa source. Aucune valeur n’est inventée : un code absent est annoncé comme non documenté.',
    });
  });

  /** Codes défaut inconnus : XAMOTO explique la nomenclature, sans inventer. */
  app.get('/api/knowledge/dtc/unknown/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const known = findDtcKnowledge(code);
    if (known) return reply.send({ known: true, code: known.code });
    const description = describeUnknownDtc(code);
    return reply.send({
      known: false,
      code: code.toUpperCase(),
      description,
      message:
        'Je ne dispose pas de cette donnée pour votre véhicule. Ce code n’est pas documenté dans la base XAMOTO : son interprétation doit être confirmée par un professionnel, et XAMOTO ne proposera pas de cause.',
    });
  });

  /* ─────────────────────── Sessions de diagnostic (§30) ─────────────────── */

  app.get('/api/diagnostics', async (request, reply) => {
    const user = request.user as AuthUser;
    const query = request.query as { vehicleId?: string; limit?: string };
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const rows = query.vehicleId
      ? (assertVehicleAccess(query.vehicleId, user), all<Row>('SELECT * FROM diagnostic_sessions WHERE vehicle_id = ? ORDER BY started_at DESC LIMIT ?', [query.vehicleId, limit]))
      : all<Row>(
          `SELECT d.* FROM diagnostic_sessions d JOIN vehicles v ON v.id = d.vehicle_id WHERE v.owner_id = ? ORDER BY d.started_at DESC LIMIT ?`,
          [user.id, limit],
        );
    return reply.send({
      diagnostics: rows.map((row) => ({
        id: row.id,
        vehicleId: row.vehicle_id,
        obdSessionId: row.obd_session_id,
        mode: row.mode,
        certainty: row.certainty,
        safety: row.safety,
        dataOrigin: row.data_origin,
        engineVersion: row.engine_version,
        startedAt: row.started_at,
        conclusionFr: row.conclusion_fr,
        conclusionEn: row.conclusion_en,
      })),
    });
  });

  app.get('/api/diagnostics/:id', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: sessionId } = request.params as { id: string };
    const row = get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ?', [sessionId]);
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Diagnostic introuvable.' } });
    assertVehicleAccess(String(row.vehicle_id), user);
    const { context, result } = loadContextAndResult(row);
    return reply.send({
      diagnostic: serializeDiagnostic(row),
      guided: buildGuidedSession(context, result),
      dataOrigin: result.dataOrigin,
      simulationNotice: result.dataOrigin === 'simulated' ? 'MODE SIMULATION — données non issues d’un véhicule réel.' : null,
    });
  });

  /* ───────────────────────── « Puis-je rouler ? » (§12) ─────────────────── */

  app.get('/api/diagnostics/:id/can-i-drive', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: sessionId } = request.params as { id: string };
    const row = get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ?', [sessionId]);
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Diagnostic introuvable.' } });
    assertVehicleAccess(String(row.vehicle_id), user);
    const answer = row.can_i_drive ? jsonParse<Record<string, unknown>>(row.can_i_drive, {}) : null;
    if (!answer) {
      return reply.code(404).send({
        error: { code: 'not_available', message: 'Aucune conclusion « Puis-je rouler ? » pour ce diagnostic.' },
      });
    }
    return reply.send({
      canIDrive: answer,
      notice:
        'XAMOTO ne garantit pas la sécurité du véhicule. Cette réponse dépend des données disponibles et du moment du scan : si un voyant reste allumé ou si le comportement change, faites contrôler le véhicule.',
    });
  });

  /* ────────────────────────── Tests guidés (§17) ────────────────────────── */

  app.get('/api/diagnostics/:id/tests', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: sessionId } = request.params as { id: string };
    const row = get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ?', [sessionId]);
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Diagnostic introuvable.' } });
    assertVehicleAccess(String(row.vehicle_id), user);
    const serialized = serializeDiagnostic(row) as { tests: unknown[] };
    return reply.send({ tests: serialized.tests });
  });

  app.post('/api/diagnostics/:id/tests/:testKey/result', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: sessionId, testKey } = request.params as { id: string; testKey: string };
    const row = get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ?', [sessionId]);
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Diagnostic introuvable.' } });
    assertVehicleAccess(String(row.vehicle_id), user, 'diagnose');

    const schema = z.object({
      outcome: z.enum(['ok', 'out_of_range', 'intermittent', 'not_testable', 'no_signal', 'visual_damage', 'other']),
      measuredValue: z.number().nullable().optional(),
      unit: z.string().nullable().optional(),
      note: z.string().nullable().optional(),
      origin: z.enum(['measured', 'documented', 'calculated', 'estimated', 'simulated', 'unknown']).default('measured'),
      /** §16 : XAMOTO n'attribue jamais un résultat que l'utilisateur n'a pas confirmé. */
      confirmed: z.boolean().default(false),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Résultat de test invalide.', details: parsed.error.flatten() } });
    if (!parsed.data.confirmed) {
      return reply.code(400).send({
        error: { code: 'confirmation_required', message: 'Confirmez le résultat observé : XAMOTO n’invente jamais une mesure.' },
      });
    }

    let testRow = get<Row>('SELECT * FROM diagnostic_tests WHERE session_id = ? AND test_key = ?', [sessionId, testKey]);
    if (!testRow) {
      const definition = findTest(testKey);
      if (!definition) {
        return reply.code(404).send({
          error: { code: 'unknown_test', message: 'Ce test n’est pas documenté dans XAMOTO : aucun résultat ne peut être enregistré pour lui.' },
        });
      }
      const testId = id('dtest');
      run('INSERT INTO diagnostic_tests (id, session_id, test_key, status, priority, reason_fr, reason_en, proposed_at) VALUES (?,?,?,?,?,?,?,?)', [
        testId,
        sessionId,
        testKey,
        'accepted',
        50,
        'Test ajouté par l’utilisateur.',
        'Test added by the user.',
        now(),
      ]);
      testRow = get<Row>('SELECT * FROM diagnostic_tests WHERE id = ?', [testId]);
    }

    const resultId = id('tres');
    run(
      'INSERT INTO diagnostic_test_results (id, test_id, session_id, vehicle_id, outcome, measured_value, unit, note, origin, recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [
        resultId,
        String(testRow?.id),
        sessionId,
        String(row.vehicle_id),
        parsed.data.outcome,
        parsed.data.measuredValue ?? null,
        parsed.data.unit ?? null,
        parsed.data.note ?? null,
        parsed.data.origin,
        now(),
      ],
    );
    run('UPDATE diagnostic_tests SET status = ? WHERE id = ?', [parsed.data.outcome === 'not_testable' ? 'skipped' : 'done', String(testRow?.id)]);

    /* Le diagnostic est RECALCULÉ avec le résultat : rien n'est estimé. */
    const { result } = loadContextAndResult(row);
    run(
      `UPDATE diagnostic_sessions SET certainty = ?, safety = ?, conclusion_fr = ?, conclusion_en = ?, missing_data = ?, next_steps = ?, rules_fired = ?, can_i_drive = ?, debug_trace = ?, status = 'completed' WHERE id = ?`,
      [
        result.certainty,
        result.safety,
        result.conclusionFr,
        result.conclusionEn,
        JSON.stringify(result.missingData),
        JSON.stringify(result.tests.map((t) => t.testKey)),
        JSON.stringify(result.rulesFired),
        JSON.stringify(result.canIDrive),
        JSON.stringify(result.debug),
        sessionId,
      ],
    );
    recordEvent({
      vehicleId: String(row.vehicle_id),
      type: 'test',
      titleFr: `Test réalisé : ${findTest(testKey)?.titleFr ?? testKey}`,
      titleEn: `Test performed: ${findTest(testKey)?.titleEn ?? testKey}`,
      detail: `Résultat déclaré : ${parsed.data.outcome}${parsed.data.note ? ` — ${parsed.data.note}` : ''}`,
      refId: resultId,
      origin: parsed.data.origin,
    });
    audit('diagnostic.test_result', 'diagnostic_test_results', resultId, user.id, { diagnosticSessionId: sessionId, testKey, outcome: parsed.data.outcome });

    return reply.send({
      ok: true,
      testKey,
      outcome: parsed.data.outcome,
      recalculated: {
        certainty: result.certainty,
        safety: result.safety,
        conclusionFr: result.conclusionFr,
        conclusionEn: result.conclusionEn,
        hypotheses: result.hypotheses,
        findings: result.findings,
        canIDrive: result.canIDrive,
        missingData: result.missingData,
      },
      notice:
        'Le diagnostic a été recalculé en intégrant ce résultat. Les autres hypothèses restent affichées avec leur niveau de certitude : un test positif n’exclut pas automatiquement les autres causes.',
    });
  });

  /* ─────────────────────────── Seconde opinion (§20) ────────────────────── */

  app.post('/api/diagnostics/:id/second-opinion', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: sessionId } = request.params as { id: string };
    const row = get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ?', [sessionId]);
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Diagnostic introuvable.' } });
    assertVehicleAccess(String(row.vehicle_id), user);

    const schema = z.object({
      externalDiagnosis: z.string().min(3, 'Indiquez le diagnostic reçu.'),
      externalCauses: z.array(z.string()).default([]),
      proposedRepair: z.string().nullable().optional(),
      proposedAmount: z.number().nullable().optional(),
      currency: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'invalid_input', message: 'Diagnostic reçu manquant ou trop court.', details: parsed.error.flatten() } });
    }

    const { context, result } = loadContextAndResult(row);
    const opinion = secondOpinion({
      externalDiagnosis: parsed.data.externalDiagnosis,
      externalCauses: parsed.data.externalCauses,
      proposedRepair: parsed.data.proposedRepair ?? null,
      proposedAmount: parsed.data.proposedAmount ?? null,
      currency: parsed.data.currency ?? null,
      context,
    }, result);

    // La seconde opinion est enregistrée dans le passeport du véhicule :
    // aucune donnée commerciale n'est inventée faute de garage identifié.
    recordEvent({
      vehicleId: String(row.vehicle_id),
      type: 'second_opinion',
      titleFr: 'Seconde opinion demandée',
      titleEn: 'Second opinion requested',
      detail: `${parsed.data.externalDiagnosis}${parsed.data.proposedRepair ? ` — réparation proposée : ${parsed.data.proposedRepair}` : ''}`,
      refId: sessionId,
      origin: 'documented',
    });
    audit('diagnostic.second_opinion', 'diagnostic_sessions', sessionId, user.id, { hasAmount: parsed.data.proposedAmount != null });

    return reply.send({
      secondOpinion: opinion,
      notice:
        'La seconde opinion XAMOTO compare les éléments disponibles. Elle ne juge jamais le garage et ne remplace pas un avis professionnel : elle liste les vérifications à demander.',
    });
  });

  /* ─────────────────────────── Post-réparation (§19) ────────────────────── */

  app.post('/api/diagnostics/:id/compare', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: sessionId } = request.params as { id: string };
    const schema = z.object({
      afterDiagnosticSessionId: z.string(),
      repairDescription: z.string().default('Réparation déclarée'),
      repairDate: z.string().optional(),
      kmSinceRepair: z.number().nullable().optional(),
      driveCycles: z.number().nullable().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Diagnostic de comparaison manquant.' } });

    const before = get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ?', [sessionId]);
    const after = get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ?', [parsed.data.afterDiagnosticSessionId]);
    if (!before || !after) return reply.code(404).send({ error: { code: 'not_found', message: 'Diagnostic introuvable.' } });
    assertVehicleAccess(String(before.vehicle_id), user);
    assertVehicleAccess(String(after.vehicle_id), user);

    const beforeScan = before.obd_session_id ? String(before.obd_session_id) : '';
    const afterScan = after.obd_session_id ? String(after.obd_session_id) : '';
    const beforeContext = buildStoredContext({ vehicleId: String(before.vehicle_id), obdSessionId: beforeScan });
    const afterContext = buildStoredContext({ vehicleId: String(after.vehicle_id), obdSessionId: afterScan });

    const comparison = compareAfterRepair({
      before: {
        sessionId: beforeScan,
        finishedAt: String(before.completed_at ?? before.started_at),
        dtcCodes: beforeContext.dtcs.map((d) => d.code),
        dtcs: beforeContext.dtcs,
        readings: beforeContext.readings,
        symptoms: beforeContext.symptoms,
      },
      after: {
        sessionId: afterScan,
        finishedAt: String(after.completed_at ?? after.started_at),
        dtcCodes: afterContext.dtcs.map((d) => d.code),
        dtcs: afterContext.dtcs,
        readings: afterContext.readings,
        symptoms: afterContext.symptoms,
        kmSinceRepair: parsed.data.kmSinceRepair ?? null,
        driveCycles: parsed.data.driveCycles ?? null,
      },
      repairDescription: parsed.data.repairDescription,
      repairDate: parsed.data.repairDate ?? String(before.completed_at ?? before.started_at),
    });

    const verificationId = id('rver');
    run(
      `INSERT INTO repairs_verification
         (id, repair_id, vehicle_id, before_session_id, after_session_id, verdict, certainty, summary_fr, summary_en, comparison, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        verificationId,
        null,
        String(before.vehicle_id),
        beforeScan,
        afterScan,
        comparison.verdict,
        comparison.certainty,
        comparison.summaryFr,
        comparison.summaryEn,
        JSON.stringify(comparison),
        now(),
      ],
    );

    return reply.send({
      comparison,
      notice:
        'Un défaut peut revenir après plusieurs cycles de conduite. XAMOTO ne déclare jamais une réparation « définitive » : refaites un scan après avoir roulé.',
    });
  });

  app.post('/api/repairs', async (request, reply) => {
    const user = request.user as AuthUser;
    const schema = z.object({
      vehicleId: z.string(),
      diagnosticSessionId: z.string().nullable().optional(),
      description: z.string().min(3),
      partsReplaced: z.array(z.object({ label: z.string(), quantity: z.number().default(1), reference: z.string().optional() })).default([]),
      labourHours: z.number().nullable().optional(),
      costAmount: z.number().nullable().optional(),
      currency: z.string().default('XOF'),
      garageId: z.string().nullable().optional(),
      performedAt: z.string().default(() => now()),
      odometerKm: z.number().int().nullable().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Réparation invalide.', details: parsed.error.flatten() } });
    const data = parsed.data;
    assertVehicleAccess(data.vehicleId, user, 'write');

    const repairId = id('repair');
    run(
      `INSERT INTO repairs (id, vehicle_id, user_id, diagnostic_session_id, description, parts_replaced, labour_hours, cost_amount, currency, garage_id, performed_at, odometer_km, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        repairId,
        data.vehicleId,
        user.id,
        data.diagnosticSessionId ?? null,
        data.description,
        JSON.stringify(data.partsReplaced),
        data.labourHours ?? null,
        data.costAmount ?? null,
        data.currency,
        data.garageId ?? null,
        data.performedAt,
        data.odometerKm ?? null,
        now(),
      ],
    );
    recordEvent({
      vehicleId: data.vehicleId,
      type: 'repair',
      titleFr: 'Réparation enregistrée',
      titleEn: 'Repair recorded',
      detail: data.description,
      refId: repairId,
      odometerKm: data.odometerKm ?? null,
      occurredAt: data.performedAt,
      origin: 'documented',
    });
    refreshPassport(data.vehicleId);
    audit('repair.created', 'repairs', repairId, user.id, { vehicleId: data.vehicleId });
    return reply.code(201).send({
      id: repairId,
      nextStepFr:
        'Après une réparation, faites un nouveau scan puis utilisez la comparaison avant/après : XAMOTO vous dira si le défaut est résolu, toujours présent, ou si les données sont insuffisantes pour conclure.',
      nextStepEn:
        'After a repair, run a new scan and use the before/after comparison: XAMOTO will tell you whether the fault is resolved, still present, or whether the data is insufficient to conclude.',
    });
  });

  app.get('/api/repairs', async (request, reply) => {
    const user = request.user as AuthUser;
    const query = request.query as { vehicleId?: string };
    const rows = query.vehicleId
      ? (assertVehicleAccess(query.vehicleId, user),
        all<Row>('SELECT * FROM repairs WHERE vehicle_id = ? ORDER BY performed_at DESC', [query.vehicleId]))
      : all<Row>(
          `SELECT r.* FROM repairs r JOIN vehicles v ON v.id = r.vehicle_id WHERE v.owner_id = ? ORDER BY r.performed_at DESC LIMIT 100`,
          [user.id],
        );
    return reply.send({
      repairs: rows.map((row) => ({
        id: row.id,
        vehicleId: row.vehicle_id,
        diagnosticSessionId: row.diagnostic_session_id,
        description: row.description,
        partsReplaced: jsonParse<unknown[]>(row.parts_replaced, []),
        costAmount: row.cost_amount,
        currency: row.currency,
        garageId: row.garage_id,
        performedAt: row.performed_at,
        odometerKm: row.odometer_km,
      })),
    });
  });

  /* ───────────────────────── Inspection avant achat (§24) ───────────────── */

  app.post('/api/vehicles/:id/inspection', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user, 'diagnose');

    const schema = z.object({
      diagnosticSessionId: z.string().nullable().optional(),
      sellerClaims: z.array(z.string()).default([]),
      notTestable: z.array(z.string()).default([]),
      displayedOdometerKm: z.number().int().nullable().optional(),
    });
    const parsed = schema.safeParse(request.body ?? {});
    const data = parsed.success ? parsed.data : { diagnosticSessionId: null, sellerClaims: [], notTestable: [], displayedOdometerKm: null };

    const vehicleRow = get<Row>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicleRow) return reply.code(404).send({ error: { code: 'not_found', message: 'Véhicule introuvable.' } });

    const diagnosticRow = data.diagnosticSessionId
      ? get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ?', [data.diagnosticSessionId])
      : get<Row>('SELECT * FROM diagnostic_sessions WHERE vehicle_id = ? ORDER BY started_at DESC LIMIT 1', [vehicleId]);

    if (!diagnosticRow) {
      return reply.code(409).send({
        error: {
          code: 'scan_required',
          message:
            'Une inspection avant achat exige un scan : sans lecture des codes défaut ni mesures, XAMOTO ne peut rien affirmer. Lancez d’abord un scan (le mode démonstration est disponible si vous n’avez pas d’adaptateur).',
        },
      });
    }

    const { context, result } = loadContextAndResult(diagnosticRow);
    const inspection = buildInspectionReport(context, result, {
      displayedOdometerKm: data.displayedOdometerKm ?? Number(vehicleRow.odometer_km),
      vehicleYear: Number(vehicleRow.year),
      sellerClaims: data.sellerClaims,
      notTestable: data.notTestable,
    });

    const inspectionId = id('insp');
    run(
      'INSERT INTO inspections (id, vehicle_id, user_id, session_id, target_vehicle, scores, checklist, red_flags, notes, seller_claims, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [
        inspectionId,
        vehicleId,
        user.id,
        String(diagnosticRow.id),
        JSON.stringify({
          brand: vehicleRow.brand,
          model: vehicleRow.model,
          year: vehicleRow.year,
          odometerKm: vehicleRow.odometer_km,
          vin: vehicleRow.vin,
          plate: vehicleRow.plate,
        }),
        JSON.stringify(inspection.scores),
        JSON.stringify(inspection.checklist),
        JSON.stringify(inspection.redFlags),
        JSON.stringify(inspection.notes),
        JSON.stringify(data.sellerClaims),
        now(),
      ],
    );
    recordEvent({
      vehicleId,
      type: 'inspection',
      titleFr: 'Inspection avant achat',
      titleEn: 'Pre-purchase inspection',
      detail: `Score technique global : ${inspection.scores.overall}/100`,
      refId: inspectionId,
      origin: result.dataOrigin === 'simulated' ? 'simulated' : 'measured',
    });

    return reply.code(201).send({
      id: inspectionId,
      inspection,
      notice:
        'Cette inspection est technique. XAMOTO ne porte aucun jugement commercial sur le véhicule ni sur le vendeur : il indique ce qui a été vérifié, ce qui n’a pas pu l’être, et ce qui doit être validé avant l’achat.',
    });
  });

  app.get('/api/vehicles/:id/inspections', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user);
    const rows = all<Row>('SELECT * FROM inspections WHERE vehicle_id = ? ORDER BY created_at DESC', [vehicleId]);
    return reply.send({
      inspections: rows.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        targetVehicle: jsonParse<unknown>(row.target_vehicle, {}),
        scores: jsonParse<unknown>(row.scores, {}),
        checklist: jsonParse<unknown[]>(row.checklist, []),
        redFlags: jsonParse<string[]>(row.red_flags, []),
        notes: jsonParse<string[]>(row.notes, []),
        sellerClaims: jsonParse<string[]>(row.seller_claims, []),
        createdAt: row.created_at,
      })),
    });
  });
}
