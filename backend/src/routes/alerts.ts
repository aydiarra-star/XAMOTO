/**
 * XAMOTO — Alertes et notifications (§22, §23).
 *
 * Toutes les alertes proviennent du moteur de diagnostic ou du planificateur
 * d'entretien. Aucune alerte n'est créée par une règle commerciale, et une
 * alerte de sécurité n'est jamais désactivée par défaut (§47-7).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { all, audit, get, id, jsonParse, now, run, type Row } from '../db/index.js';
import { assertVehicleAccess, authenticate, type AuthUser } from '../auth/index.js';

export async function alertRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/api/alerts', async (request, reply) => {
    const user = request.user as AuthUser;
    const query = request.query as { unread?: string; vehicleId?: string };
    let rows = all<Row>('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [user.id]);
    if (query.unread === 'true') rows = rows.filter((row) => row.read_at === null);
    if (query.vehicleId) rows = rows.filter((row) => String(row.vehicle_id) === query.vehicleId);
    return reply.send({
      alerts: rows.map((row) => ({
        id: row.id,
        vehicleId: row.vehicle_id,
        level: row.level,
        kind: row.kind,
        titleFr: row.title_fr,
        titleEn: row.title_en,
        bodyFr: row.body_fr,
        bodyEn: row.body_en,
        refId: row.ref_id,
        createdAt: row.created_at,
        readAt: row.read_at,
      })),
      unread: rows.filter((row) => row.read_at === null).length,
    });
  });

  app.post('/api/alerts/read', async (request, reply) => {
    const user = request.user as AuthUser;
    const schema = z.object({ ids: z.array(z.string()).optional(), all: z.boolean().default(false) });
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Requête invalide.' } });
    if (parsed.data.all) {
      run('UPDATE alerts SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [now(), user.id]);
      return reply.send({ ok: true, updated: 'all' });
    }
    for (const alertId of parsed.data.ids ?? []) {
      run('UPDATE alerts SET read_at = ? WHERE id = ? AND user_id = ?', [now(), alertId, user.id]);
    }
    return reply.send({ ok: true, updated: parsed.data.ids?.length ?? 0 });
  });

  /* ───────────────────── Entretien : planification (§22) ─────────────────── */

  app.post('/api/vehicles/:id/maintenance/plan', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user);
    const schema = z.object({
      odometerKm: z.number().int().nullable().optional(),
      dusty: z.boolean().default(false),
      mostlyCity: z.boolean().default(false),
      heavyHeat: z.boolean().default(false),
      shortTrips: z.boolean().default(false),
      recordUsage: z.boolean().default(false),
    });
    const parsed = schema.safeParse(request.body ?? {});
    const data = parsed.success ? parsed.data : { odometerKm: null, dusty: false, mostlyCity: false, heavyHeat: false, shortTrips: false, recordUsage: false };

    const row = get<Row>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Véhicule introuvable.' } });

    if (data.odometerKm !== null && data.odometerKm !== undefined) {
      run('UPDATE vehicles SET odometer_km = ?, odometer_updated_at = ?, updated_at = ? WHERE id = ?', [data.odometerKm, now(), now(), vehicleId]);
    }

    const { buildMaintenancePlan } = await import('@xamoto/diagnostic');
    const history = all<Row>('SELECT kind, performed_at, odometer_km FROM maintenance WHERE vehicle_id = ?', [vehicleId]).map((m) => ({
      kind: String(m.kind),
      performedAt: String(m.performed_at),
      odometerKm: m.odometer_km === null ? null : Number(m.odometer_km),
    }));
    const plan = buildMaintenancePlan({
      vehicle: {
        fuelType: String(row.fuel_type) as never,
        odometerKm: Number(data.odometerKm ?? row.odometer_km),
        year: Number(row.year),
        engine: String(row.engine),
      },
      spec: null,
      history,
      usage: { dusty: data.dusty, mostlyCity: data.mostlyCity, heavyHeat: data.heavyHeat, shortTrips: data.shortTrips },
    });

    /* Les échéances dépassées deviennent des alertes — jamais des publicités. */
    for (const item of plan) {
      if (item.status !== 'overdue' && item.status !== 'due_soon') continue;
      const existing = get<Row>(
        "SELECT id FROM alerts WHERE vehicle_id = ? AND kind = 'maintenance' AND title_fr = ? AND created_at >= datetime('now', '-14 day')",
        [vehicleId, item.labelFr],
      );
      if (existing) continue;
      run(
        'INSERT INTO alerts (id, user_id, vehicle_id, level, kind, title_fr, title_en, body_fr, body_en, ref_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [
          id('alert'),
          user.id,
          vehicleId,
          item.status === 'overdue' ? 'important' : 'attention',
          'maintenance',
          item.status === 'overdue' ? `Entretien en retard : ${item.labelFr}` : `Entretien à prévoir : ${item.labelFr}`,
          item.status === 'overdue' ? `Overdue service: ${item.labelEn}` : `Upcoming service: ${item.labelEn}`,
          `${item.rangeFr}${item.nextDueKm ? ` — prochaine échéance vers ${item.nextDueKm} km.` : ''} Intervalle issu de ${item.sourceId}; le carnet d’entretien du véhicule reste la référence.`,
          `${item.rangeEn}${item.nextDueKm ? ` — next due around ${item.nextDueKm} km.` : ''} Interval from ${item.sourceId}; the vehicle service book remains the reference.`,
          null,
          now(),
        ],
      );
    }

    audit('maintenance.plan_requested', 'vehicles', vehicleId, user.id, { usage: data });
    return reply.send({
      plan,
      usageFactors: {
        dusty: data.dusty,
        mostlyCity: data.mostlyCity,
        heavyHeat: data.heavyHeat,
        shortTrips: data.shortTrips,
        noteFr:
          'Les facteurs d’usage (poussière, ville, chaleur, trajets courts) sont un CONTEXTE : ils resserrent des intervalles documentés, ils ne créent jamais de panne et ne sont jamais utilisés comme cause de diagnostic.',
      },
    });
  });

  /* ────────────────── Maintenance prédictive (§23) ──────────────────────── */

  app.get('/api/vehicles/:id/predictive', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user);
    const row = get<Row>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Véhicule introuvable.' } });

    const sessions = all<Row>('SELECT id, started_at, source FROM obd_sessions WHERE vehicle_id = ? AND status = ? ORDER BY started_at ASC', [vehicleId, 'completed']);
    const trends: Array<{ key: string; label: string; unit: string; samples: number; first: number; last: number; delta: number; direction: 'up' | 'down' | 'stable'; origin: string; interpretationFr: string }> = [];
    const tracked = ['battery_voltage', 'coolant_temp', 'short_fuel_trim_b1', 'long_fuel_trim_b1', 'o2_b1s1_voltage'];

    for (const key of tracked) {
      const values: number[] = [];
      let label = key;
      let unit = '';
      let origin = 'measured';
      for (const session of sessions) {
        const data = get<Row>('SELECT * FROM obd_data WHERE session_id = ? AND pid_key = ?', [String(session.id), key]);
        if (!data || data.value === null || Number(data.supported) !== 1) continue;
        values.push(Number(data.value));
        label = String(data.label);
        unit = String(data.unit);
        origin = String(data.origin);
      }
      if (values.length < 3) continue;
      const first = values[0] as number;
      const last = values[values.length - 1] as number;
      const delta = Number((last - first).toFixed(2));
      const spread = Math.max(...values) - Math.min(...values);
      const direction: 'up' | 'down' | 'stable' = Math.abs(delta) <= Math.max(0.5, spread * 0.25) ? 'stable' : delta > 0 ? 'up' : 'down';
      trends.push({
        key,
        label,
        unit,
        samples: values.length,
        first,
        last,
        delta,
        direction,
        origin,
        interpretationFr:
          'Tendance observée sur les scans enregistrés. Une tendance n’est pas un diagnostic : elle sert à choisir le bon moment pour vérifier, jamais à affirmer une panne.',
      });
    }

    return reply.send({
      trends,
      basedOnScans: sessions.length,
      noticeFr:
        'La maintenance prédictive XAMOTO est fondée sur l’évolution RÉELLE des mesures du véhicule. Elle affiche une tendance, jamais une prédiction de panne.',
      disclaimerFr: 'Aucune prédiction n’est présentée comme certaine, et aucune pièce n’est recommandée sur la seule base d’une tendance.',
    });
  });
}
