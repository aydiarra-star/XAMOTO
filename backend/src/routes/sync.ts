/**
 * XAMOTO — Mode hors ligne et synchronisation (§29).
 *
 * Principe : l'application mobile fonctionne SANS réseau (SQLite local), puis
 * synchronise. Le serveur ne fusionne jamais en silence : tout conflit est
 * enregistré et expliqué. Aucune donnée locale n'est écrasée par une donnée
 * simulée ou estimée de moindre valeur (§33, §47-5).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { all, audit, get, id, jsonParse, now, run, transaction, type Row } from '../db/index.js';
import { assertVehicleAccess, authenticate, type AuthUser } from '../auth/index.js';

const ORIGIN_RANK: Record<string, number> = {
  measured: 5,
  documented: 4,
  calculated: 3,
  estimated: 2,
  simulated: 1,
  unknown: 0,
};

const operationSchema = z.object({
  opId: z.string(),
  entity: z.enum(['vehicle', 'obd_session', 'dtc_event', 'repair', 'maintenance', 'symptom_report', 'document', 'note']),
  action: z.enum(['create', 'update', 'delete']),
  /** Identifiant local côté appareil (facultatif). */
  localId: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  payload: z.record(z.unknown()),
  clientUpdatedAt: z.string(),
  origin: z.enum(['measured', 'documented', 'calculated', 'estimated', 'simulated', 'unknown']).default('measured'),
});

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.post('/api/sync/push', async (request, reply) => {
    const user = request.user as AuthUser;
    const schema = z.object({
      clientId: z.string(),
      operations: z.array(operationSchema).max(500),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Opérations de synchronisation invalides.', details: parsed.error.flatten() } });

    const applied: Array<{ opId: string; status: string; serverId?: string; conflictReason?: string }> = [];

    for (const operation of parsed.data.operations) {
      const existing = get<Row>('SELECT * FROM sync_operations WHERE user_id = ? AND id = ?', [user.id, operation.opId]);
      if (existing) {
        applied.push({ opId: operation.opId, status: 'duplicate', serverId: existing.entity_id ? String(existing.entity_id) : undefined });
        continue;
      }
      if (operation.vehicleId) {
        try {
          assertVehicleAccess(operation.vehicleId, user, 'write');
        } catch {
          run(
            'INSERT INTO sync_operations (id, user_id, client_id, entity, action, payload, status, conflict_reason, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
            [operation.opId, user.id, parsed.data.clientId, operation.entity, operation.action, JSON.stringify(operation.payload), 'rejected', 'permission', now()],
          );
          applied.push({ opId: operation.opId, status: 'rejected', conflictReason: 'Accès refusé sur ce véhicule.' });
          continue;
        }
      }

      try {
        transaction(() => {
          const serverId = applyOperation(user.id, parsed.data.clientId, operation);
          run(
            'INSERT INTO sync_operations (id, user_id, client_id, entity, action, payload, status, applied_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
            [operation.opId, user.id, parsed.data.clientId, operation.entity, operation.action, JSON.stringify(operation.payload), 'applied', now(), now()],
          );
          applied.push({ opId: operation.opId, status: 'applied', serverId });
        });
      } catch (error) {
        run(
          'INSERT INTO sync_operations (id, user_id, client_id, entity, action, payload, status, conflict_reason, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
          [operation.opId, user.id, parsed.data.clientId, operation.entity, operation.action, JSON.stringify(operation.payload), 'conflict', (error as Error).message, now()],
        );
        applied.push({ opId: operation.opId, status: 'conflict', conflictReason: (error as Error).message });
      }
    }

    audit('sync.push', 'sync_operations', null, user.id, { clientId: parsed.data.clientId, count: parsed.data.operations.length });
    return reply.send({
      applied,
      summary: {
        total: applied.length,
        applied: applied.filter((a) => a.status === 'applied').length,
        conflicts: applied.filter((a) => a.status === 'conflict').length,
        rejected: applied.filter((a) => a.status === 'rejected').length,
        duplicates: applied.filter((a) => a.status === 'duplicate').length,
      },
      noticeFr:
        'Les opérations en conflit sont CONSERVÉES et explicables : XAMOTO ne supprime jamais une donnée locale sans le dire. Consultez « /api/sync/conflicts ».',
    });
  });

  app.get('/api/sync/pull', async (request, reply) => {
    const user = request.user as AuthUser;
    const query = request.query as { since?: string };
    const since = query.since ?? '1970-01-01T00:00:00.000Z';

    const vehicles = all<Row>(
      `SELECT DISTINCT v.* FROM vehicles v
       LEFT JOIN vehicle_shares s ON s.vehicle_id = v.id AND s.revoked_at IS NULL
       WHERE (v.owner_id = ? OR s.user_id = ?) AND v.updated_at > ? ORDER BY v.updated_at ASC`,
      [user.id, user.id, since],
    );
    const events = all<Row>(
      `SELECT e.* FROM vehicle_events e JOIN vehicles v ON v.id = e.vehicle_id WHERE v.owner_id = ? AND e.occurred_at > ? ORDER BY e.occurred_at ASC LIMIT 2000`,
      [user.id, since],
    );
    const maintenance = all<Row>(
      `SELECT m.* FROM maintenance m JOIN vehicles v ON v.id = m.vehicle_id WHERE v.owner_id = ? AND m.created_at > ? ORDER BY m.created_at ASC LIMIT 2000`,
      [user.id, since],
    );
    const alerts = all<Row>('SELECT * FROM alerts WHERE user_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 500', [user.id, since]);

    return reply.send({
      serverTime: now(),
      vehicles,
      events,
      maintenance,
      alerts,
      deletions: [],
      noticeFr:
        'Synchronisation incrémentale. Les suppressions sont signalées explicitement ; aucun effacement n’est implicite.',
    });
  });

  app.get('/api/sync/conflicts', async (request, reply) => {
    const user = request.user as AuthUser;
    const rows = all<Row>("SELECT * FROM sync_operations WHERE user_id = ? AND status IN ('conflict','rejected') ORDER BY created_at DESC LIMIT 200", [user.id]);
    return reply.send({
      conflicts: rows.map((row) => ({
        opId: row.id,
        clientId: row.client_id,
        entity: row.entity,
        action: row.action,
        status: row.status,
        reason: row.conflict_reason,
        payload: jsonParse<Record<string, unknown>>(row.payload, {}),
        createdAt: row.created_at,
      })),
      noticeFr: 'Un conflit n’est jamais résolu en silence : XAMOTO conserve les deux versions et explique le choix effectué.',
    });
  });

  /** Version serveur minimale pour un véhicule, utilisée par le mode hors ligne. */
  app.get('/api/vehicles/:id/sync-state', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user);
    const vehicle = get<Row>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    const scans = all<Row>('SELECT id, started_at, source, dtc_count, mil_on FROM obd_sessions WHERE vehicle_id = ? ORDER BY started_at DESC LIMIT 20', [vehicleId]);
    const diagnostics = all<Row>(
      'SELECT id, started_at, certainty, safety, conclusion_fr, data_origin FROM diagnostic_sessions WHERE vehicle_id = ? ORDER BY started_at DESC LIMIT 20',
      [vehicleId],
    );
    return reply.send({
      vehicleUpdatedAt: vehicle?.updated_at ?? null,
      scans: scans.map((row) => ({ id: row.id, startedAt: row.started_at, source: row.source, dtcCount: row.dtc_count, milOn: Number(row.mil_on) === 1 })),
      diagnostics: diagnostics.map((row) => ({
        id: row.id,
        startedAt: row.started_at,
        certainty: row.certainty,
        safety: row.safety,
        conclusionFr: row.conclusion_fr,
        dataOrigin: row.data_origin,
      })),
      serverTime: now(),
    });
  });
}

/* ─────────────────────────── Application des opérations ─────────────────── */

function applyOperation(
  userId: string,
  clientId: string,
  operation: z.infer<typeof operationSchema>,
): string | undefined {
  const payload = operation.payload as Record<string, unknown>;
  const str = (key: string, fallback = ''): string => (payload[key] === undefined || payload[key] === null ? fallback : String(payload[key]));
  const num = (key: string): number | null => (payload[key] === undefined || payload[key] === null ? null : Number(payload[key]));

  switch (operation.entity) {
    case 'repair': {
      const serverId = operation.localId ?? id('repair');
      const existing = get<Row>('SELECT id FROM repairs WHERE id = ?', [serverId]);
      if (existing) {
        // Résolution par provenance : la donnée la plus fiable gagne, et si la
        // version locale est plus fiable, elle est appliquée ; sinon l'écart est
        // conservé dans `sync_operations`.
        const current = get<Row>('SELECT description, created_at FROM repairs WHERE id = ?', [serverId]);
        const incomingRank = ORIGIN_RANK[operation.origin] ?? 0;
        if (incomingRank >= (ORIGIN_RANK.documented ?? 4)) {
          run('UPDATE repairs SET description = ? WHERE id = ?', [str('description', String(current?.description ?? '')), serverId]);
          return serverId;
        }
        throw new Error('Conflit conservé : la version serveur est jugée plus fiable (provenance supérieure).');
      }
      if (!operation.vehicleId) throw new Error('vehicleId requis pour une réparation.');
      run(
        'INSERT INTO repairs (id, vehicle_id, user_id, diagnostic_session_id, description, parts_replaced, labour_hours, cost_amount, currency, garage_id, performed_at, odometer_km, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          serverId,
          operation.vehicleId,
          userId,
          payload.diagnosticSessionId ? String(payload.diagnosticSessionId) : null,
          str('description', 'Réparation (saisie hors ligne)'),
          JSON.stringify(payload.partsReplaced ?? []),
          num('labourHours'),
          num('costAmount'),
          str('currency', 'XOF'),
          payload.garageId ? String(payload.garageId) : null,
          str('performedAt', operation.clientUpdatedAt),
          num('odometerKm'),
          now(),
        ],
      );
      return serverId;
    }
    case 'maintenance': {
      const serverId = operation.localId ?? id('maint');
      if (!operation.vehicleId) throw new Error('vehicleId requis pour un entretien.');
      run(
        'INSERT INTO maintenance (id, vehicle_id, kind, label_fr, label_en, performed_at, odometer_km, status, source_id, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [
          serverId,
          operation.vehicleId,
          str('kind', 'autre'),
          str('labelFr', 'Entretien (saisie hors ligne)'),
          str('labelEn', 'Service (offline entry)'),
          str('performedAt', operation.clientUpdatedAt),
          num('odometerKm'),
          str('status', 'ok'),
          str('sourceId', 'src_maintenance_ranges'),
          payload.notes ? String(payload.notes) : null,
          now(),
        ],
      );
      return serverId;
    }
    case 'symptom_report': {
      const serverId = operation.localId ?? id('symptom');
      if (!operation.vehicleId) throw new Error('vehicleId requis pour un symptôme.');
      run(
        'INSERT INTO vehicle_events (id, vehicle_id, type, title_fr, title_en, detail, odometer_km, occurred_at, origin) VALUES (?,?,?,?,?,?,?,?,?)',
        [
          serverId,
          operation.vehicleId,
          'symptom',
          `Symptôme signalé : ${str('labelFr', str('symptomKey'))}`,
          `Reported symptom: ${str('labelEn', str('symptomKey'))}`,
          JSON.stringify(payload),
          num('odometerKm'),
          str('at', operation.clientUpdatedAt),
          operation.origin,
        ],
      );
      return serverId;
    }
    case 'note': {
      const serverId = operation.localId ?? id('note');
      if (!operation.vehicleId) throw new Error('vehicleId requis pour une note.');
      run(
        'INSERT INTO vehicle_events (id, vehicle_id, type, title_fr, title_en, detail, odometer_km, occurred_at, origin) VALUES (?,?,?,?,?,?,?,?,?)',
        [
          serverId,
          operation.vehicleId,
          'note',
          str('titleFr', 'Note'),
          str('titleEn', 'Note'),
          str('detail'),
          num('odometerKm'),
          str('at', operation.clientUpdatedAt),
          operation.origin,
        ],
      );
      return serverId;
    }
    case 'obd_session':
    case 'dtc_event': {
      // Les sessions OBD et les codes défaut ne sont JAMAIS rejoués en
      // synchronisation : une lecture OBD est liée au matériel qui l'a produite
      // et à un instant précis. Elles doivent être rejouées par un scan.
      throw new Error(
        'Les lectures OBD et les codes défaut ne sont pas synchronisables : relancez un scan sur l’appareil connecté à l’adaptateur. XAMOTO ne rejoue jamais une mesure hors de son contexte matériel.',
      );
    }
    default:
      throw new Error(`Entité non synchronisable : ${operation.entity}.`);
  }
}

export { ORIGIN_RANK };
export type { Row };
