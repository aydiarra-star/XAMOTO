/**
 * XAMOTO — Réseau de garages et devis (§26, §27).
 *
 * Le devis est présenté dans un tableau FACTUEL. XAMOTO n'indique jamais qu'un
 * devis est « bon » ou « mauvais » : il affiche ce qui est prévu, ce qui est
 * lié aux données mesurées, et ce qui ne l'est pas.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { all, audit, get, id, jsonParse, now, run, type Row } from '../db/index.js';
import { assertVehicleAccess, authenticate, type AuthUser } from '../auth/index.js';
import { loadContextAndResult } from './diagnostic.js';

function garageWithDistance(row: Row, lat?: number, lon?: number): Record<string, unknown> {
  const base = {
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    phone: row.phone,
    whatsapp: row.whatsapp,
    brands: jsonParse<string[]>(row.brands, []),
    specialties: jsonParse<string[]>(row.specialties, []),
    equipment: jsonParse<string[]>(row.equipment, []),
    services: jsonParse<string[]>(row.services, []),
    openingHours: row.opening_hours,
    verified: Number(row.verified) === 1,
    rating: row.rating === null ? null : Number(row.rating),
    acceptsXamotoDiagnostics: Number(row.accepts_xamoto) === 1,
    lat: row.lat === null ? null : Number(row.lat),
    lon: row.lon === null ? null : Number(row.lon),
  };
  if (lat !== undefined && lon !== undefined && row.lat !== null && row.lon !== null) {
    return { ...base, distanceKm: haversine(lat, lon, Number(row.lat), Number(row.lon)) };
  }
  return base;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Number((2 * R * Math.asin(Math.sqrt(a))).toFixed(1));
}

export async function garageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/api/garages', async (request, reply) => {
    const query = request.query as { city?: string; specialty?: string; brand?: string; lat?: string; lon?: string; verified?: string; xamoto?: string };
    let rows = all<Row>('SELECT * FROM garages ORDER BY verified DESC, rating DESC');
    if (query.city) rows = rows.filter((row) => String(row.city).toLowerCase().includes(query.city!.toLowerCase()));
    if (query.verified === 'true') rows = rows.filter((row) => Number(row.verified) === 1);
    if (query.xamoto === 'true') rows = rows.filter((row) => Number(row.accepts_xamoto) === 1);
    if (query.specialty) {
      const needle = query.specialty.toLowerCase();
      rows = rows.filter((row) => jsonParse<string[]>(row.specialties, []).some((s) => s.toLowerCase().includes(needle)));
    }
    if (query.brand) {
      const needle = query.brand.toLowerCase();
      rows = rows.filter((row) => jsonParse<string[]>(row.brands, []).some((b) => b.toLowerCase().includes(needle)));
    }
    const lat = query.lat ? Number(query.lat) : undefined;
    const lon = query.lon ? Number(query.lon) : undefined;
    const garages = rows.map((row) => garageWithDistance(row, lat, lon));
    if (lat !== undefined && lon !== undefined) {
      garages.sort((a, b) => Number(a.distanceKm ?? 9999) - Number(b.distanceKm ?? 9999));
    }
    return reply.send({
      garages,
      total: garages.length,
      noticeFr:
        'Les informations affichées proviennent des garages et de relevés terrain XAMOTO. Aucun garage n’est classé par XAMOTO sur la qualité de son travail : seuls les équipements et les spécialités déclarés sont montrés.',
      attribution: 'Fond de carte : OpenStreetMap (© OpenStreetMap contributors).',
    });
  });

  app.get('/api/garages/:id', async (request, reply) => {
    const { id: garageId } = request.params as { id: string };
    const row = get<Row>('SELECT * FROM garages WHERE id = ?', [garageId]);
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Garage introuvable.' } });
    const services = all<Row>('SELECT * FROM garage_services WHERE garage_id = ?', [garageId]).map((service) => ({
      service: service.service,
      priceFrom: service.price_from === null ? null : Number(service.price_from),
      currency: service.currency,
      durationH: service.duration_h === null ? null : Number(service.duration_h),
    }));
    return reply.send({ garage: garageWithDistance(row), services });
  });

  /** L'utilisateur choisit explicitement ce qu'il transmet (§38). */
  app.post('/api/garages/:id/share-diagnostic', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: garageId } = request.params as { id: string };
    const schema = z.object({
      vehicleId: z.string(),
      diagnosticSessionId: z.string(),
      includeMeasurements: z.boolean().default(true),
      includeDtcList: z.boolean().default(true),
      includeHistory: z.boolean().default(false),
      message: z.string().max(600).optional(),
      consent: z.literal(true, { errorMap: () => ({ message: 'Le consentement explicite est obligatoire pour partager un diagnostic.' }) }),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'consent_required', message: 'Le consentement explicite est obligatoire.', details: parsed.error.flatten() } });
    assertVehicleAccess(parsed.data.vehicleId, user, 'diagnose');

    const garage = get<Row>('SELECT * FROM garages WHERE id = ?', [garageId]);
    if (!garage) return reply.code(404).send({ error: { code: 'not_found', message: 'Garage introuvable.' } });
    const diagnosticRow = get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ? AND vehicle_id = ?', [parsed.data.diagnosticSessionId, parsed.data.vehicleId]);
    if (!diagnosticRow) return reply.code(404).send({ error: { code: 'not_found', message: 'Diagnostic introuvable pour ce véhicule.' } });

    const { context, result } = loadContextAndResult(diagnosticRow);
    const shareId = id('share');
    const bundle = {
      vehicleId: parsed.data.vehicleId,
      garageId,
      diagnosticSessionId: parsed.data.diagnosticSessionId,
      message: parsed.data.message ?? null,
      measurements: parsed.data.includeMeasurements
        ? context.readings.map((reading) => ({ key: reading.key, label: reading.label, value: reading.value, unit: reading.unit, supported: reading.supported, origin: reading.origin }))
        : [],
      dtcs: parsed.data.includeDtcList ? context.dtcs.map((dtc) => ({ code: dtc.code, status: dtc.status, origin: dtc.origin })) : [],
      history: parsed.data.includeHistory ? context.history ?? null : null,
      conclusion: { fr: result.conclusionFr, en: result.conclusionEn },
      certainty: result.certainty,
      safety: result.safety,
      dataOrigin: result.dataOrigin,
      generatedAt: now(),
    };

    run(
      'INSERT INTO sync_operations (id, user_id, client_id, entity, action, payload, status, applied_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [shareId, user.id, 'server', 'garage_share', 'create', JSON.stringify(bundle), 'applied', now(), now()],
    );
    audit('garage.diagnostic_shared', 'garages', garageId, user.id, {
      vehicleId: parsed.data.vehicleId,
      diagnosticSessionId: parsed.data.diagnosticSessionId,
      fields: { measurements: parsed.data.includeMeasurements, dtcs: parsed.data.includeDtcList, history: parsed.data.includeHistory },
    });

    return reply.code(201).send({
      id: shareId,
      shared: bundle,
      noticeFr:
        'Le diagnostic a été transmis au garage avec votre accord, et uniquement pour les éléments que vous avez cochés. Vous pouvez retirer cet accès à tout moment.',
      privacyFr: 'Aucune donnée n’est transmise sans consentement explicite. Le partage est journalisé dans votre historique.',
    });
  });

  /* ──────────────────────────── Devis (§27) ─────────────────────────────── */

  app.post('/api/quotes', async (request, reply) => {
    const user = request.user as AuthUser;
    const schema = z.object({
      vehicleId: z.string(),
      garageId: z.string(),
      diagnosticSessionId: z.string().nullable().optional(),
      title: z.string().min(3),
      status: z.enum(['draft', 'requested', 'received', 'accepted', 'declined']).default('draft'),
      lines: z
        .array(z.object({ label: z.string(), partReference: z.string().optional(), quantity: z.number().default(1), unitAmount: z.number(), currency: z.string().default('XOF') }))
        .default([]),
      warrantyMonths: z.number().int().nullable().optional(),
      delayDays: z.number().int().nullable().optional(),
      factualSummary: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Devis invalide.', details: parsed.error.flatten() } });
    const data = parsed.data;
    assertVehicleAccess(data.vehicleId, user);

    const garage = get<Row>('SELECT * FROM garages WHERE id = ?', [data.garageId]);
    if (!garage) return reply.code(404).send({ error: { code: 'not_found', message: 'Garage introuvable.' } });

    const quoteId = id('quote');
    run(
      `INSERT INTO quotes (id, user_id, vehicle_id, diagnostic_session_id, garage_id, status, lines, warranty_months, delay_days, factual_summary, requested_at, received_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        quoteId,
        user.id,
        data.vehicleId,
        data.diagnosticSessionId ?? null,
        data.garageId,
        data.status,
        JSON.stringify(data.lines),
        data.warrantyMonths ?? null,
        data.delayDays ?? null,
        data.factualSummary ?? null,
        now(),
        data.status === 'received' ? now() : null,
      ],
    );
    return reply.code(201).send({ id: quoteId });
  });

  /**
   * Analyse d'un devis (§27) : XAMOTO met en regard chaque ligne du devis et les
   * données réelles du véhicule. Aucun jugement « bon / mauvais », aucune
   * estimation de prix : uniquement des faits et des questions à poser.
   */
  app.post('/api/quotes/:id/analysis', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: quoteId } = request.params as { id: string };
    const quote = get<Row>('SELECT * FROM quotes WHERE id = ? AND user_id = ?', [quoteId, user.id]);
    if (!quote) return reply.code(404).send({ error: { code: 'not_found', message: 'Devis introuvable.' } });

    const lines = jsonParse<Array<{ label: string; quantity?: number; unitAmount?: number; currency?: string }>>(quote.lines, []);
    const diagnosticRow = quote.diagnostic_session_id
      ? get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ?', [String(quote.diagnostic_session_id)])
      : get<Row>('SELECT * FROM diagnostic_sessions WHERE vehicle_id = ? ORDER BY started_at DESC LIMIT 1', [String(quote.vehicle_id)]);

    const { context, result } = diagnosticRow
      ? loadContextAndResult(diagnosticRow)
      : { context: null, result: null };

    const relevantLabels = new Set<string>();
    for (const hypothesis of result?.hypotheses ?? []) {
      for (const part of hypothesis.parts) relevantLabels.add(part.toLowerCase());
      for (const test of hypothesis.discriminatingTests) relevantLabels.add(test.toLowerCase());
    }
    for (const dtc of context?.dtcs ?? []) relevantLabels.add(dtc.code.toLowerCase());

    const analysis = lines.map((line) => {
      const label = line.label.toLowerCase();
      const linked = [...relevantLabels].filter((token) => token.length > 3 && label.includes(token.replace(/_/g, ' ')));
      const matchesHypothesis = linked.length > 0;
      return {
        label: line.label,
        quantity: line.quantity ?? 1,
        unitAmount: line.unitAmount ?? null,
        currency: line.currency ?? quote.currency ?? 'XOF',
        linkedToMeasuredData: matchesHypothesis,
        matchedElements: linked,
        questionToAsk: matchesHypothesis
          ? null
          : 'Sur quelles mesures ce poste est-il fondé ? XAMOTO ne dispose pas de donnée liée à cette ligne.',
      };
    });

    const measuredCount = analysis.filter((line) => line.linkedToMeasuredData).length;
    return reply.send({
      quote: {
        id: quote.id,
        status: quote.status,
        garageId: quote.garage_id,
        diagnosticSessionId: quote.diagnostic_session_id,
        receivedAt: quote.received_at,
        warrantyMonths: quote.warranty_months,
        delayDays: quote.delay_days,
      },
      analysis,
      summary: {
        totalLines: analysis.length,
        linesLinkedToMeasuredData: measuredCount,
        linesNotLinked: analysis.length - measuredCount,
        dataOrigin: result?.dataOrigin ?? 'unknown',
        certainty: result?.certainty ?? 'unavailable',
      },
      noticeFr:
        'XAMOTO ne juge pas le devis et ne compare pas les prix : il indique seulement quelles lignes sont soutenues par des données mesurées sur votre véhicule, et quelles questions poser. Un devis sans lien avec les données n’est pas forcément injustifié — des éléments non lisibles en OBD existent.',
      questionsFr: [
        'Quelles mesures ont conduit à ce poste ?',
        'Le remplacement proposé fait-il suite à un test documenté ?',
        'Quelles pièces sont remplacées, avec quelle référence ?',
        'Quelle garantie s’applique sur la pièce et sur la main-d’œuvre ?',
        'Le devis distingue-t-il diagnostic, pièces et main-d’œuvre ?',
      ],
    });
  });

  app.get('/api/quotes', async (request, reply) => {
    const user = request.user as AuthUser;
    const query = request.query as { vehicleId?: string };
    const rows = query.vehicleId
      ? (assertVehicleAccess(query.vehicleId, user), all<Row>('SELECT * FROM quotes WHERE vehicle_id = ? ORDER BY requested_at DESC', [query.vehicleId]))
      : all<Row>('SELECT * FROM quotes WHERE user_id = ? ORDER BY requested_at DESC LIMIT 100', [user.id]);
    return reply.send({
      quotes: rows.map((row) => ({
        id: row.id,
        vehicleId: row.vehicle_id,
        garageId: row.garage_id,
        diagnosticSessionId: row.diagnostic_session_id,
        status: row.status,
        lines: jsonParse<unknown[]>(row.lines, []),
        warrantyMonths: row.warranty_months,
        delayDays: row.delay_days,
        factualSummary: row.factual_summary,
        requestedAt: row.requested_at,
        receivedAt: row.received_at,
      })),
    });
  });

  /* ─────────────────── Parts graph (§28) ────────────────────────────────── */

  app.get('/api/parts', async (request, reply) => {
    const query = request.query as { search?: string; system?: string; brand?: string; vehicleId?: string };
    let rows = all<Row>('SELECT * FROM parts ORDER BY name_fr');
    if (query.search) {
      const needle = query.search.toLowerCase();
      rows = rows.filter(
        (row) =>
          String(row.name_fr).toLowerCase().includes(needle) ||
          String(row.name_en).toLowerCase().includes(needle) ||
          jsonParse<string[]>(row.oem_references, []).some((ref) => ref.toLowerCase().includes(needle)) ||
          jsonParse<string[]>(row.equivalents, []).some((ref) => ref.toLowerCase().includes(needle)),
      );
    }
    if (query.system) rows = rows.filter((row) => String(row.category) === query.system);
    if (query.brand) rows = rows.filter((row) => jsonParse<string[]>(row.fits_brands, []).some((b) => b.toLowerCase() === query.brand!.toLowerCase()));
    return reply.send({
      parts: rows.map((row) => ({
        id: row.id,
        partKey: row.part_key,
        nameFr: row.name_fr,
        nameEn: row.name_en,
        category: row.category,
        oemReferences: jsonParse<string[]>(row.oem_references, []),
        equivalents: jsonParse<string[]>(row.equivalents, []),
        brands: jsonParse<string[]>(row.fits_brands, []),
        engines: jsonParse<string[]>(row.fits_engines, []),
        fitsYearFrom: row.fits_year_from,
        fitsYearTo: row.fits_year_to,
        availabilitySn: row.availability_sn,
        typicalPriceXof: row.typical_price_xof === null ? null : Number(row.typical_price_xof),
        sourceId: row.source_id,
        updatedAt: row.updated_at,
      })),
      noticeFr:
        'Les références proviennent de la base XAMOTO. Une référence absente est annoncée comme absente : XAMOTO n’invente jamais une référence constructeur.',
    });
  });
}
