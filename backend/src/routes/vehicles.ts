/**
 * XAMOTO — Véhicules, partage, passeport (§6, §21, §36, §38).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { all, audit, get, id, jsonParse, now, run, type Row } from '../db/index.js';
import { assertVehicleAccess, authenticate, vehiclePermission, type AuthUser } from '../auth/index.js';
import { refreshPassport, vehicleRowToApi } from '../services/scanService.js';
import { buildMaintenancePlan } from '@xamoto/diagnostic';

const vehicleSchema = z.object({
  nickname: z.string().optional(),
  brand: z.string().min(1),
  model: z.string().min(1),
  generation: z.string().optional(),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
  engine: z.string().min(1),
  engineDisplacementCc: z.number().int().optional(),
  fuelType: z.enum(['essence', 'diesel', 'hybride', 'hybride_rechargeable', 'electrique', 'gpl', 'flex']),
  gearbox: z.enum(['manuelle', 'automatique', 'robotisee', 'cvt', 'inconnue']).default('inconnue'),
  powerHp: z.number().int().optional(),
  vin: z.string().max(20).optional(),
  plate: z.string().optional(),
  country: z.string().default('SN'),
  purchaseDate: z.string().optional(),
  odometerKm: z.number().int().min(0).default(0),
});

function specFor(brand: string, model: string, year: number): Row | undefined {
  return get<Row>(
    'SELECT * FROM vehicle_specs WHERE lower(brand) = lower(?) AND lower(model) = lower(?) AND ? BETWEEN year_from AND year_to ORDER BY year_from DESC LIMIT 1',
    [brand, model, year],
  );
}

/** VIN : 17 caractères, sans I, O, Q (ISO 3779). */
function validateVin(vin: string): string | null {
  const normalized = vin.trim().toUpperCase();
  if (normalized.length !== 17) return 'Le VIN doit comporter exactement 17 caractères.';
  if (/[IOQ]/.test(normalized)) return 'Un VIN ne contient jamais les lettres I, O ou Q.';
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) return 'Le VIN contient des caractères invalides.';
  return null;
}

export async function vehicleRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/api/vehicles', async (request, reply) => {
    const user = request.user as AuthUser;
    const rows = all<Row>(
      `SELECT DISTINCT v.* FROM vehicles v
       LEFT JOIN vehicle_shares s ON s.vehicle_id = v.id AND s.revoked_at IS NULL
       WHERE v.owner_id = ? OR s.user_id = ? OR (v.organization_id IS NOT NULL AND v.organization_id = ?)
       ORDER BY v.created_at DESC`,
      [user.id, user.id, user.organizationId],
    );
    return reply.send({
      vehicles: rows.map((row) => ({
        ...vehicleRowToApi(row, specFor(String(row.brand), String(row.model), Number(row.year))),
        permission: vehiclePermission(String(row.id), user),
      })),
    });
  });

  app.post('/api/vehicles', async (request, reply) => {
    const parsed = vehicleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Données véhicule invalides.', details: parsed.error.flatten() } });
    const user = request.user as AuthUser;
    const data = parsed.data;

    if (data.vin) {
      const error = validateVin(data.vin);
      if (error) return reply.code(400).send({ error: { code: 'invalid_vin', message: error } });
    }

    const vehicleId = id('veh');
    const timestamp = now();
    run(
      `INSERT INTO vehicles (id, owner_id, nickname, brand, model, generation, year, engine, engine_cc, fuel_type, gearbox, power_hp, vin, plate, country, purchase_date, odometer_km, odometer_updated_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        vehicleId,
        user.id,
        data.nickname ?? null,
        data.brand,
        data.model,
        data.generation ?? null,
        data.year,
        data.engine,
        data.engineDisplacementCc ?? null,
        data.fuelType,
        data.gearbox,
        data.powerHp ?? null,
        data.vin?.toUpperCase() ?? null,
        data.plate ?? null,
        data.country,
        data.purchaseDate ?? null,
        data.odometerKm,
        timestamp,
        timestamp,
        timestamp,
      ],
    );

    run('INSERT INTO vehicle_events (id, vehicle_id, type, title_fr, title_en, detail, occurred_at, origin) VALUES (?,?,?,?,?,?,?,?)', [
      id('evt'),
      vehicleId,
      'vehicle_created',
      'Véhicule ajouté à XAMOTO',
      'Vehicle added to XAMOTO',
      `${data.brand} ${data.model} ${data.year} — ${data.odometerKm} km`,
      timestamp,
      'documented',
    ]);
    refreshPassport(vehicleId);
    audit('vehicle.created', 'vehicles', vehicleId, user.id, { brand: data.brand, model: data.model });

    const row = get<Row>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]) as Row;
    const spec = specFor(data.brand, data.model, data.year);
    return reply.code(201).send({
      vehicle: vehicleRowToApi(row, spec),
      // Information utile : XAMOTO indique s'il possède une fiche technique.
      specAvailable: Boolean(spec),
      specNotice: spec
        ? 'Fiche technique disponible dans la base XAMOTO (plages usuelles, à confirmer par le carnet d’entretien du véhicule).'
        : 'XAMOTO ne dispose pas de fiche technique pour ce modèle : il ne fournira pas de valeurs constructeur inventées.',
    });
  });

  app.get('/api/vehicles/:id', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user);
    const row = get<Row>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Véhicule introuvable.' } });
    return reply.send({
      vehicle: vehicleRowToApi(row, specFor(String(row.brand), String(row.model), Number(row.year))),
      permission: vehiclePermission(vehicleId, user),
    });
  });

  app.patch('/api/vehicles/:id', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user, 'write');
    const parsed = vehicleSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Données invalides.', details: parsed.error.flatten() } });
    const data = parsed.data;

    const fields: Array<[string, unknown]> = [];
    const map: Record<string, string> = {
      nickname: 'nickname', brand: 'brand', model: 'model', generation: 'generation', year: 'year', engine: 'engine',
      engineDisplacementCc: 'engine_cc', fuelType: 'fuel_type', gearbox: 'gearbox', powerHp: 'power_hp', vin: 'vin',
      plate: 'plate', country: 'country', purchaseDate: 'purchase_date', odometerKm: 'odometer_km',
    };
    for (const [key, column] of Object.entries(map)) {
      const value = (data as Record<string, unknown>)[key];
      if (value !== undefined) fields.push([column, value]);
    }
    if (fields.length === 0) return reply.send({ ok: true });

    const previous = get<Row>('SELECT odometer_km FROM vehicles WHERE id = ?', [vehicleId]);
    run(
      `UPDATE vehicles SET ${fields.map(([column]) => `${column} = ?`).join(', ')}, updated_at = ?, odometer_updated_at = ? WHERE id = ?`,
      [...fields.map(([, value]) => value), now(), now(), vehicleId],
    );

    if (data.odometerKm !== undefined && Number(previous?.odometer_km ?? 0) !== data.odometerKm) {
      run('INSERT INTO vehicle_events (id, vehicle_id, type, title_fr, title_en, detail, odometer_km, occurred_at, origin) VALUES (?,?,?,?,?,?,?,?,?)', [
        id('evt'),
        vehicleId,
        'note',
        'Kilométrage mis à jour',
        'Odometer updated',
        `${previous?.odometer_km ?? 0} → ${data.odometerKm} km`,
        data.odometerKm,
        now(),
        'documented',
      ]);
    }
    audit('vehicle.updated', 'vehicles', vehicleId, user.id, { fields: fields.map(([c]) => c) });
    const row = get<Row>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]) as Row;
    return reply.send({ vehicle: vehicleRowToApi(row, specFor(String(row.brand), String(row.model), Number(row.year))) });
  });

  app.delete('/api/vehicles/:id', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    const permission = assertVehicleAccess(vehicleId, user, 'write');
    if (permission !== 'owner' && user.role !== 'admin') {
      return reply.code(403).send({ error: { code: 'forbidden', message: 'Seul le propriétaire peut supprimer le véhicule.' } });
    }
    run('DELETE FROM vehicles WHERE id = ?', [vehicleId]);
    audit('vehicle.deleted', 'vehicles', vehicleId, user.id);
    return reply.send({ ok: true });
  });

  /* ─────────────────────────── Passeport (§21) ──────────────────────────── */

  app.get('/api/vehicles/:id/passport', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user);
    refreshPassport(vehicleId);

    const vehicle = get<Row>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]) as Row;
    const passport = get<Row>('SELECT * FROM vehicle_passport WHERE vehicle_id = ?', [vehicleId]);
    const events = all<Row>('SELECT * FROM vehicle_events WHERE vehicle_id = ? ORDER BY occurred_at DESC LIMIT 200', [vehicleId]).map((row) => ({
      id: row.id,
      type: row.type,
      titleFr: row.title_fr,
      titleEn: row.title_en,
      detail: row.detail,
      refId: row.ref_id,
      odometerKm: row.odometer_km,
      occurredAt: row.occurred_at,
      origin: row.origin,
    }));
    const scans = all<Row>('SELECT * FROM obd_sessions WHERE vehicle_id = ? ORDER BY started_at DESC LIMIT 50', [vehicleId]).map((row) => ({
      id: row.id,
      source: row.source,
      scenario: row.scenario,
      protocol: row.protocol,
      startedAt: row.started_at,
      status: row.status,
      milOn: Number(row.mil_on) === 1,
      pidCount: Number(row.pid_count),
      dtcCount: Number(row.dtc_count),
    }));
    const repairs = all<Row>('SELECT * FROM repairs WHERE vehicle_id = ? ORDER BY performed_at DESC', [vehicleId]).map((row) => ({
      id: row.id,
      description: row.description,
      partsReplaced: jsonParse<Array<{ label: string; quantity: number }>>(row.parts_replaced, []),
      costAmount: row.cost_amount,
      currency: row.currency,
      performedAt: row.performed_at,
      performedBy: row.performed_by,
    }));
    const maintenance = all<Row>('SELECT * FROM maintenance WHERE vehicle_id = ? ORDER BY performed_at DESC', [vehicleId]).map((row) => ({
      id: row.id,
      kind: row.kind,
      labelFr: row.label_fr,
      labelEn: row.label_en,
      performedAt: row.performed_at,
      odometerKm: row.odometer_km,
      status: row.status,
      sourceId: row.source_id,
    }));

    return reply.send({
      vehicle: vehicleRowToApi(vehicle, specFor(String(vehicle.brand), String(vehicle.model), Number(vehicle.year))),
      summary: passport ? jsonParse<Record<string, unknown>>(passport.summary, {}) : {},
      counters: {
        diagnostics: Number(passport?.diagnostics ?? 0),
        repairs: Number(passport?.repairs ?? 0),
        maintenance: Number(passport?.maintenance ?? 0),
        documents: Number(passport?.documents ?? 0),
      },
      firstEventAt: passport?.first_event_at ?? null,
      lastEventAt: passport?.last_event_at ?? null,
      events,
      scans,
      repairs,
      maintenance,
      notice: 'Le passeport XAMOTO rassemble les données réelles du véhicule. Les entrées issues du simulateur sont identifiées par leur origine « simulated ».',
    });
  });

  app.get('/api/vehicles/:id/maintenance', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user);
    const row = get<Row>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]) as Row;
    const history = all<Row>('SELECT kind, performed_at, odometer_km FROM maintenance WHERE vehicle_id = ?', [vehicleId]).map((m) => ({
      kind: String(m.kind),
      performedAt: String(m.performed_at),
      odometerKm: m.odometer_km === null ? null : Number(m.odometer_km),
    }));
    const usage = request.query as { dusty?: string; mostlyCity?: string; heavyHeat?: string; shortTrips?: string };
    const plan = buildMaintenancePlan({
      vehicle: {
        fuelType: String(row.fuel_type) as never,
        odometerKm: Number(row.odometer_km),
        year: Number(row.year),
        engine: String(row.engine),
      },
      spec: null,
      history,
      usage: {
        dusty: usage.dusty === 'true',
        mostlyCity: usage.mostlyCity === 'true',
        heavyHeat: usage.heavyHeat === 'true',
        shortTrips: usage.shortTrips === 'true',
      },
    });
    return reply.send({
      plan,
      notice:
        'Les intervalles affichés sont des PLAGES usuelles attribuées à une source, jamais des valeurs constructeur officielles. Le carnet d’entretien du véhicule reste la référence.',
    });
  });

  app.post('/api/vehicles/:id/maintenance', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user, 'write');
    const schema = z.object({
      kind: z.string(),
      labelFr: z.string(),
      labelEn: z.string(),
      performedAt: z.string().default(() => now()),
      odometerKm: z.number().int().nullable().optional(),
      sourceId: z.string().default('src_maintenance_ranges'),
      notes: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Données d’entretien invalides.' } });
    const maintenanceId = id('maint');
    run(
      'INSERT INTO maintenance (id, vehicle_id, kind, label_fr, label_en, performed_at, odometer_km, status, source_id, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [
        maintenanceId,
        vehicleId,
        parsed.data.kind,
        parsed.data.labelFr,
        parsed.data.labelEn,
        parsed.data.performedAt,
        parsed.data.odometerKm ?? null,
        'ok',
        parsed.data.sourceId,
        parsed.data.notes ?? null,
        now(),
      ],
    );
    run('INSERT INTO vehicle_events (id, vehicle_id, type, title_fr, title_en, detail, ref_id, odometer_km, occurred_at, origin) VALUES (?,?,?,?,?,?,?,?,?,?)', [
      id('evt'),
      vehicleId,
      'maintenance',
      `Entretien : ${parsed.data.labelFr}`,
      `Service: ${parsed.data.labelEn}`,
      parsed.data.notes ?? null,
      maintenanceId,
      parsed.data.odometerKm ?? null,
      parsed.data.performedAt,
      'documented',
    ]);
    refreshPassport(vehicleId);
    return reply.code(201).send({ id: maintenanceId });
  });

  /* ─────────────────────── Partage et permissions (§38) ─────────────────── */

  app.post('/api/vehicles/:id/shares', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    const permission = assertVehicleAccess(vehicleId, user);
    if (permission !== 'owner' && user.role !== 'admin') {
      return reply.code(403).send({ error: { code: 'forbidden', message: 'Seul le propriétaire peut partager le véhicule.' } });
    }
    const schema = z.object({
      email: z.string().email().optional(),
      garageId: z.string().optional(),
      permission: z.enum(['read', 'write', 'diagnose']).default('read'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success || (!parsed.data.email && !parsed.data.garageId)) {
      return reply.code(400).send({ error: { code: 'invalid_input', message: 'Indiquez un email ou un garage.' } });
    }

    let targetUserId: string | null = null;
    if (parsed.data.email) {
      const target = get<Row>('SELECT id FROM users WHERE lower(email) = lower(?)', [parsed.data.email]);
      if (!target) return reply.code(404).send({ error: { code: 'not_found', message: 'Aucun compte XAMOTO avec cette adresse.' } });
      targetUserId = String(target.id);
    }

    const shareId = id('share');
    run('INSERT INTO vehicle_shares (id, vehicle_id, user_id, garage_id, permission, granted_by, granted_at) VALUES (?,?,?,?,?,?,?)', [
      shareId,
      vehicleId,
      targetUserId,
      parsed.data.garageId ?? null,
      parsed.data.permission,
      user.id,
      now(),
    ]);
    audit('vehicle.shared', 'vehicle_shares', shareId, user.id, { vehicleId, permission: parsed.data.permission });
    return reply.code(201).send({ id: shareId, notice: 'Le partage peut être révoqué à tout moment.' });
  });

  app.get('/api/vehicles/:id/shares', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user);
    const shares = all<Row>(
      `SELECT s.*, u.full_name AS user_name, u.email AS user_email, g.name AS garage_name
       FROM vehicle_shares s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN garages g ON g.id = s.garage_id
       WHERE s.vehicle_id = ? ORDER BY s.granted_at DESC`,
      [vehicleId],
    ).map((row) => ({
      id: row.id,
      userName: row.user_name,
      userEmail: row.user_email,
      garageName: row.garage_name,
      permission: row.permission,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
    }));
    return reply.send({ shares });
  });

  app.delete('/api/vehicles/:id/shares/:shareId', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId, shareId } = request.params as { id: string; shareId: string };
    const permission = assertVehicleAccess(vehicleId, user);
    if (permission !== 'owner' && user.role !== 'admin') {
      return reply.code(403).send({ error: { code: 'forbidden', message: 'Seul le propriétaire peut révoquer un partage.' } });
    }
    run('UPDATE vehicle_shares SET revoked_at = ? WHERE id = ? AND vehicle_id = ?', [now(), shareId, vehicleId]);
    audit('vehicle.share_revoked', 'vehicle_shares', shareId, user.id);
    return reply.send({ ok: true });
  });

  /* ─────────────────────── Documents du véhicule (§21) ──────────────────── */

  app.get('/api/vehicles/:id/documents', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user);
    const documents = all<Row>('SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY created_at DESC', [vehicleId]).map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      url: row.url,
      mimeType: row.mime_type,
      issuedAt: row.issued_at,
      createdAt: row.created_at,
    }));
    return reply.send({ documents });
  });

  app.post('/api/vehicles/:id/documents', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: vehicleId } = request.params as { id: string };
    assertVehicleAccess(vehicleId, user, 'write');
    const schema = z.object({
      kind: z.enum(['carte_grise', 'assurance', 'facture', 'rapport_diagnostic', 'rapport_inspection', 'photo', 'autre']),
      title: z.string().min(1),
      url: z.string().optional(),
      mimeType: z.string().optional(),
      issuedAt: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Document invalide.' } });
    const documentId = id('doc');
    run('INSERT INTO vehicle_documents (id, vehicle_id, kind, title, url, mime_type, issued_at, created_at) VALUES (?,?,?,?,?,?,?,?)', [
      documentId,
      vehicleId,
      parsed.data.kind,
      parsed.data.title,
      parsed.data.url ?? null,
      parsed.data.mimeType ?? null,
      parsed.data.issuedAt ?? null,
      now(),
    ]);
    run('INSERT INTO vehicle_events (id, vehicle_id, type, title_fr, title_en, ref_id, occurred_at, origin) VALUES (?,?,?,?,?,?,?,?)', [
      id('evt'),
      vehicleId,
      'document',
      `Document ajouté : ${parsed.data.title}`,
      `Document added: ${parsed.data.title}`,
      documentId,
      now(),
      'documented',
    ]);
    refreshPassport(vehicleId);
    return reply.code(201).send({ id: documentId });
  });
}
