/**
 * XAMOTO — Authentification (§37).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { audit, all, get, id, now, run } from '../db/index.js';
import {
  authenticate,
  createSession,
  createUser,
  findUserByEmail,
  revokeSession,
  verifyPassword,
  type AuthUser,
} from '../auth/index.js';
import { runScan } from '../services/scanService.js';
import { seedAll, DEMO_CREDENTIALS } from '../db/seed.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  country: z.string().default('SN'),
  locale: z.string().default('fr'),
  plan: z.enum(['free', 'premium', 'pro', 'fleet']).default('free'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'invalid_input', message: 'Données invalides.', details: parsed.error.flatten() } });
    }
    if (findUserByEmail(parsed.data.email)) {
      return reply.code(409).send({ error: { code: 'email_taken', message: 'Un compte existe déjà avec cette adresse.' } });
    }
    const user = createUser(parsed.data);
    const session = createSession(user.id, request.headers['user-agent'] as string | undefined);
    return reply.code(201).send({ user, token: session.token, expiresAt: session.expiresAt });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'invalid_input', message: 'Adresse ou mot de passe manquant.' } });
    }
    const row = findUserByEmail(parsed.data.email);
    if (!row || !verifyPassword(parsed.data.password, String(row.password_hash))) {
      // Message volontairement identique dans les deux cas (pas d'énumération de comptes).
      return reply.code(401).send({ error: { code: 'invalid_credentials', message: 'Adresse ou mot de passe incorrect.' } });
    }
    const session = createSession(String(row.id), request.headers['user-agent'] as string | undefined);
    const user = {
      id: String(row.id),
      email: String(row.email),
      fullName: String(row.full_name),
      role: String(row.role),
      locale: String(row.locale),
      country: String(row.country),
      plan: String(row.plan),
      organizationId: row.organization_id ? String(row.organization_id) : null,
    };
    audit('auth.login', 'users', String(row.id), String(row.id), {}, request.ip);
    return reply.send({ user, token: session.token, expiresAt: session.expiresAt });
  });

  app.post('/api/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    if (request.sessionId) revokeSession(request.sessionId);
    audit('auth.logout', 'users', request.user?.id ?? null, request.user?.id ?? null);
    return reply.send({ ok: true });
  });

  app.get('/api/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as AuthUser;
    const stats = {
      vehicles: Number(get<{ c: number }>('SELECT COUNT(*) AS c FROM vehicles WHERE owner_id = ?', [user.id])?.c ?? 0),
      scans: Number(
        get<{ c: number }>('SELECT COUNT(*) AS c FROM obd_sessions s JOIN vehicles v ON v.id = s.vehicle_id WHERE v.owner_id = ?', [user.id])?.c ?? 0,
      ),
      diagnostics: Number(
        get<{ c: number }>('SELECT COUNT(*) AS c FROM diagnostic_sessions d JOIN vehicles v ON v.id = d.vehicle_id WHERE v.owner_id = ?', [user.id])?.c ?? 0,
      ),
      alerts: Number(get<{ c: number }>('SELECT COUNT(*) AS c FROM alerts WHERE user_id = ? AND read_at IS NULL', [user.id])?.c ?? 0),
    };
    return reply.send({ user, stats });
  });

  app.post('/api/auth/change-password', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Nouveau mot de passe trop court (8 caractères minimum).' } });
    const user = request.user as AuthUser;
    const row = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [user.id]);
    if (!row || !verifyPassword(parsed.data.currentPassword, row.password_hash)) {
      return reply.code(401).send({ error: { code: 'invalid_credentials', message: 'Mot de passe actuel incorrect.' } });
    }
    const { hashPassword } = await import('../auth/index.js');
    run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hashPassword(parsed.data.newPassword), now(), user.id]);
    audit('auth.password_changed', 'users', user.id, user.id);
    return reply.send({ ok: true });
  });

  /* ─────────────── Compte de démonstration (§31, mode démo) ─────────────── */

  app.post('/api/auth/demo', async (request, reply) => {
    // Le compte de démonstration est créé à la demande s'il n'existe pas :
    // XAMOTO reste testable immédiatement, sans véhicule réel.
    let row = findUserByEmail(DEMO_CREDENTIALS.email);
    if (!row) {
      await seedAll({ withDemo: true });
      row = findUserByEmail(DEMO_CREDENTIALS.email);
    }
    if (!row) {
      return reply.code(500).send({ error: { code: 'demo_unavailable', message: 'Le compte de démonstration n’a pas pu être préparé.' } });
    }
    const session = createSession(String(row.id), request.headers['user-agent'] as string | undefined);
    return reply.send({
      user: {
        id: String(row.id),
        email: String(row.email),
        fullName: String(row.full_name),
        role: String(row.role),
        locale: String(row.locale),
        country: String(row.country),
        plan: String(row.plan),
        organizationId: null,
      },
      token: session.token,
      expiresAt: session.expiresAt,
      notice: 'MODE DÉMONSTRATION : les véhicules et diagnostics de ce compte proviennent du simulateur XAMOTO, jamais d’un véhicule réel.',
    });
  });

  /* ────────────────────── Mode démo : véhicule prêt (§31) ────────────────── */

  app.post('/api/demo/vehicle', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      scenario: z.enum(['normal_engine', 'weak_battery', 'high_temperature', 'engine_fault', 'multiple_dtc', 'intermittent_fault', 'no_start', 'diesel_egr_dpf']).default('engine_fault'),
    });
    const parsed = schema.safeParse(request.body ?? {});
    const scenario = parsed.success ? parsed.data.scenario : 'engine_fault';
    const user = request.user as AuthUser;

    const { SCENARIO_BY_ID } = await import('@xamoto/obd');
    const definition = SCENARIO_BY_ID.get(scenario);
    if (!definition) return reply.code(400).send({ error: { code: 'unknown_scenario', message: 'Scénario inconnu.' } });

    const vehicleId = id('veh');
    const timestamp = now();
    run(
      `INSERT INTO vehicles (id, owner_id, nickname, brand, model, year, engine, fuel_type, gearbox, plate, country, odometer_km, odometer_updated_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        vehicleId,
        user.id,
        `${definition.demoVehicle.brand} ${definition.demoVehicle.model} — Simulation`,
        definition.demoVehicle.brand,
        definition.demoVehicle.model,
        definition.demoVehicle.year,
        definition.demoVehicle.engine,
        definition.demoVehicle.fuelType,
        'manuelle',
        definition.demoVehicle.plate ?? null,
        'SN',
        scenario === 'no_start' ? 187000 : 145000,
        timestamp,
        timestamp,
        timestamp,
      ],
    );

    const outcome = await runScan({ userId: user.id, vehicleId, mode: 'simulator', scenario, samples: 6 });
    return reply.code(201).send({
      vehicleId,
      diagnosticSessionId: outcome.diagnosticSessionId,
      scenario,
      notice: 'MODE SIMULATION — les données de ce véhicule proviennent du simulateur XAMOTO.',
      summary: {
        dtcCount: outcome.scan.dtcs.length,
        certainty: outcome.diagnostic.certainty,
        safety: outcome.diagnostic.safety,
        conclusionFr: outcome.diagnostic.conclusionFr,
      },
    });
  });

  app.get('/api/demo/scenarios', async (_request, reply) => {
    const { SCENARIOS } = await import('@xamoto/obd');
    return reply.send({
      scenarios: SCENARIOS.map((scenario) => ({
        id: scenario.id,
        labelFr: scenario.labelFr,
        labelEn: scenario.labelEn,
        descriptionFr: scenario.descriptionFr,
        descriptionEn: scenario.descriptionEn,
        vehicle: scenario.demoVehicle,
        dtcCodes: scenario.dtcs.map((d) => d.code),
        symptoms: scenario.defaultSymptoms,
      })),
      notice: 'Les données produites par ces scénarios sont SIMULÉES et toujours identifiées comme telles.',
    });
  });

  app.get('/api/health/db', async (_request, reply) => {
    const tables = all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    return reply.send({ tables: tables.map((t) => t.name), count: tables.length });
  });
}
