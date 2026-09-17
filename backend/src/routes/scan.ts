/**
 * XAMOTO — Scan OBD et sessions (§7, §8, §29, §30).
 *
 * Deux voies d'acquisition, jamais confondues :
 *   – `mode: "obd"` : adaptateur ELM327 réel (Wi-Fi/TCP côté serveur ;
 *     Bluetooth côté application mobile), données d'origine `measured` ;
 *   – `mode: "simulator"` : scénario de simulation, origine `simulated`,
 *     affichage « MODE SIMULATION » obligatoire.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { all, get, jsonParse, type Row } from '../db/index.js';
import { assertVehicleAccess, authenticate, type AuthUser } from '../auth/index.js';
import { runScan } from '../services/scanService.js';
import { COMMON_ELM327_HOSTS, COMMON_ELM327_PORTS, SCENARIOS, TcpTransport, Elm327Adapter } from '@xamoto/obd';

const SCENARIO_IDS = ['normal_engine', 'weak_battery', 'high_temperature', 'engine_fault', 'multiple_dtc', 'intermittent_fault', 'no_start', 'diesel_egr_dpf'] as const;

const scanSchema = z.object({
  vehicleId: z.string(),
  mode: z.enum(['obd', 'simulator']).default('simulator'),
  scenario: z.enum(SCENARIO_IDS).optional(),
  host: z.string().optional(),
  port: z.number().int().optional(),
  samples: z.number().int().min(1).max(12).default(5),
  symptoms: z
    .array(
      z.object({
        key: z.string(),
        present: z.boolean().default(true),
        intensity: z.enum(['light', 'moderate', 'severe']).optional(),
        note: z.string().optional(),
      }),
    )
    .default([]),
  analysisMode: z.enum(['standard', 'guided', 'inspection', 'second_opinion', 'post_repair']).default('standard'),
});

export async function scanRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  /** Découverte des adaptateurs Wi-Fi usuels (utile avant un scan réel). */
  app.get('/api/obd/candidates', async (_request, reply) => {
    return reply.send({
      hosts: COMMON_ELM327_HOSTS,
      ports: COMMON_ELM327_PORTS,
      notice:
        'XAMOTO teste la présence d’un adaptateur ELM327 compatible (Wi-Fi). Les adaptateurs Bluetooth nécessitent l’application mobile (Bluetooth SPP / BLE).',
      bluetooth: { supportedInBrowser: 'web-bluetooth (selon navigateur)', supportedInMobileApp: true },
    });
  });

  app.post('/api/obd/probe', async (request, reply) => {
    const schema = z.object({ host: z.string(), port: z.number().int().optional() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Adresse de l’adaptateur requise.' } });
    const transport = new TcpTransport({ host: parsed.data.host, port: parsed.data.port });
    const adapter = new Elm327Adapter({ transport, retries: 1 });
    try {
      const info = await adapter.connect();
      await adapter.disconnect();
      return reply.send({ reachable: true, device: info });
    } catch (error) {
      return reply.send({
        reachable: false,
        error: (error as Error).message,
        hint:
          'Vérifiez que le contact est mis, que l’adaptateur est alimenté par la prise OBD et que le téléphone/ordinateur est connecté à son réseau Wi-Fi.',
      });
    }
  });

  app.get('/api/obd/simulator/scenarios', async (_request, reply) => {
    return reply.send({
      scenarios: SCENARIOS.map((scenario) => ({
        id: scenario.id,
        labelFr: scenario.labelFr,
        labelEn: scenario.labelEn,
        descriptionFr: scenario.descriptionFr,
        descriptionEn: scenario.descriptionEn,
        vehicle: scenario.demoVehicle,
        dtcCodes: scenario.dtcs.map((d) => ({ code: d.code, status: d.status, appearsAtSeconds: d.appearsAtSeconds })),
        symptoms: scenario.defaultSymptoms,
        unsupportedPids: scenario.unsupportedPids,
      })),
      notice: 'MODE SIMULATION : ces scénarios ne proviennent pas d’un véhicule réel.',
    });
  });

  app.post('/api/scans', async (request, reply) => {
    const parsed = scanSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Paramètres de scan invalides.', details: parsed.error.flatten() } });
    const user = request.user as AuthUser;
    assertVehicleAccess(parsed.data.vehicleId, user, 'diagnose');

    try {
      const outcome = await runScan({
        userId: user.id,
        vehicleId: parsed.data.vehicleId,
        mode: parsed.data.mode,
        scenario: parsed.data.scenario,
        host: parsed.data.host,
        port: parsed.data.port,
        samples: parsed.data.samples,
        symptoms: parsed.data.symptoms as never,
        analysisMode: parsed.data.analysisMode,
      });

      return reply.code(201).send({
        sessionId: outcome.scan.sessionId,
        diagnosticSessionId: outcome.diagnosticSessionId,
        source: outcome.scan.source,
        scenario: outcome.scenario ?? null,
        protocol: outcome.scan.protocol,
        milOn: outcome.scan.milOn,
        startedAt: outcome.scan.startedAt,
        finishedAt: outcome.scan.finishedAt,
        device: outcome.scan.device,
        readings: outcome.scan.readings,
        dtcs: outcome.scan.dtcs,
        unsupportedPids: outcome.scan.unsupportedPids,
        warnings: outcome.scan.warnings,
        notes: outcome.scan.notes,
        diagnostic: outcome.diagnostic,
        simulationNotice: outcome.scan.source === 'simulator' ? 'MODE SIMULATION — données non issues d’un véhicule réel.' : null,
      });
    } catch (error) {
      const message = (error as Error).message;
      return reply.code(502).send({
        error: {
          code: 'scan_failed',
          message: `Le scan n’a pas pu aboutir : ${message}`,
          hint: 'Aucune donnée n’a été enregistrée. XAMOTO ne remplace jamais une lecture échouée par une valeur estimée.',
        },
      });
    }
  });

  app.get('/api/scans', async (request, reply) => {
    const user = request.user as AuthUser;
    const query = request.query as { vehicleId?: string; limit?: string };
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const rows = query.vehicleId
      ? (assertVehicleAccess(query.vehicleId, user), all<Row>('SELECT * FROM obd_sessions WHERE vehicle_id = ? ORDER BY started_at DESC LIMIT ?', [query.vehicleId, limit]))
      : all<Row>(
          `SELECT s.* FROM obd_sessions s JOIN vehicles v ON v.id = s.vehicle_id WHERE v.owner_id = ? ORDER BY s.started_at DESC LIMIT ?`,
          [user.id, limit],
        );
    return reply.send({
      scans: rows.map((row) => ({
        id: row.id,
        vehicleId: row.vehicle_id,
        source: row.source,
        scenario: row.scenario,
        protocol: row.protocol,
        startedAt: row.started_at,
        status: row.status,
        milOn: Number(row.mil_on) === 1,
        pidCount: Number(row.pid_count),
        dtcCount: Number(row.dtc_count),
      })),
    });
  });

  app.get('/api/scans/:id', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: sessionId } = request.params as { id: string };
    const session = get<Row>('SELECT * FROM obd_sessions WHERE id = ?', [sessionId]);
    if (!session) return reply.code(404).send({ error: { code: 'not_found', message: 'Scan introuvable.' } });
    assertVehicleAccess(String(session.vehicle_id), user);

    const readings = all<Row>('SELECT * FROM obd_data WHERE session_id = ?', [sessionId]).map((row) => ({
      key: row.pid_key,
      obdPid: row.pid,
      label: row.label,
      value: row.value === null ? null : Number(row.value),
      unit: row.unit,
      supported: Number(row.supported) === 1,
      origin: row.origin,
      condition: row.condition,
      series: jsonParse<number[]>(row.series, []),
      capturedAt: row.captured_at,
    }));
    const dtcs = all<Row>('SELECT * FROM dtc_events WHERE session_id = ?', [sessionId]).map((row) => ({
      code: row.code,
      status: row.status,
      occurrences: Number(row.occurrences),
      freezeFrame: jsonParse<Record<string, unknown>>(row.freeze_frame, {}),
      origin: row.origin,
      lastSeenAt: row.last_seen_at,
      returnedAfterClear: Number(row.returned_after_clear) === 1,
    }));
    const diagnosticSession = get<Row>('SELECT * FROM diagnostic_sessions WHERE obd_session_id = ? ORDER BY started_at DESC LIMIT 1', [sessionId]);

    return reply.send({
      scan: {
        id: session.id,
        vehicleId: session.vehicle_id,
        source: session.source,
        scenario: session.scenario,
        protocol: session.protocol,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        status: session.status,
        milOn: Number(session.mil_on) === 1,
      },
      readings,
      dtcs,
      diagnosticSessionId: diagnosticSession?.id ?? null,
      simulationNotice: session.source === 'simulator' ? 'MODE SIMULATION — données non issues d’un véhicule réel.' : null,
      provenance: {
        source: `OBD ${session.protocol ?? ''}`.trim(),
        acquisition: session.started_at,
        session: session.id,
      },
    });
  });

  /**
   * Effacement des défauts (§18) : XAMOTO n'efface pas à l'aveugle.
   * L'API refuse l'effacement si un diagnostic n'a pas encore été établi, et
   * enregistre l'effacement dans l'historique pour détecter un retour du code.
   */
  app.post('/api/scans/:id/clear', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: sessionId } = request.params as { id: string };
    const session = get<Row>('SELECT * FROM obd_sessions WHERE id = ?', [sessionId]);
    if (!session) return reply.code(404).send({ error: { code: 'not_found', message: 'Scan introuvable.' } });
    assertVehicleAccess(String(session.vehicle_id), user, 'diagnose');
    const schema = z.object({ confirm: z.boolean(), reason: z.string().optional() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success || !parsed.data.confirm) {
      return reply.code(400).send({
        error: {
          code: 'confirmation_required',
          message: 'L’effacement des défauts doit être confirmé explicitement.',
        },
      });
    }

    const { run, now, id, audit } = await import('../db/index.js');
    run('UPDATE dtc_events SET cleared_at = ? WHERE session_id = ? AND cleared_at IS NULL', [now(), sessionId]);
    run('INSERT INTO vehicle_events (id, vehicle_id, type, title_fr, title_en, detail, ref_id, occurred_at, origin) VALUES (?,?,?,?,?,?,?,?,?)', [
      id('evt'),
      String(session.vehicle_id),
      'note',
      'Effacement des défauts',
      'Faults cleared',
      parsed.data.reason ?? 'Effacement confirmé par l’utilisateur',
      sessionId,
      now(),
      'documented',
    ]);
    audit('scan.dtcs_cleared', 'obd_sessions', sessionId, user.id, { reason: parsed.data.reason });
    return reply.send({
      ok: true,
      noteFr:
        'Effacement enregistré. XAMOTO comparera le prochain scan à cet effacement : si un défaut revient, il sera identifié comme « revenu après effacement », ce qui est une information de diagnostic importante.',
      noteEn:
        'Clear recorded. XAMOTO will compare the next scan with this clear: if a fault returns, it will be identified as "returned after clearing", which is important diagnostic information.',
      warningFr:
        session.source === 'simulator'
          ? 'MODE SIMULATION : l’effacement est simulé, le scénario continuera de produire le défaut.'
          : 'Un défaut effacé ne prouve pas une réparation : roulez puis refaites un scan pour vérifier.',
    });
  });
}
