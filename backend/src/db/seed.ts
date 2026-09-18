/**
 * XAMOTO — Amorçage de la base (§15, §30, §31).
 *
 * Trois niveaux, exécutables séparément :
 *   1. `seedKnowledge()`  : sources, documents RAG, codes défaut ;
 *   2. `seedReferenceData()` : véhicules de référence, garages, pièces ;
 *   3. `seedDemo()` : compte de démonstration, véhicules et scans SIMULÉS.
 *
 * Aucune donnée de démonstration n'est présentée comme réelle : les scans du
 * compte démo portent l'origine `simulated` et le libellé « MODE SIMULATION ».
 */
import { ALL_DTC_KNOWLEDGE, KNOWLEDGE_SOURCES } from '@xamoto/diagnostic';
import { RAG_DOCUMENTS } from '@xamoto/ai';
import { all, get, id, jsonParse, now, run, transaction, type Row } from './index.js';
import { GARAGES, PARTS, VEHICLE_SPECS } from './seed-data.js';
import { createUser, hashPassword } from '../auth/index.js';

export const DEMO_CREDENTIALS = {
  email: 'demo@xamoto.app',
  password: 'xamoto2026',
  fullName: 'Compte de démonstration XAMOTO',
};

export const KNOWLEDGE_VERSION = '2026.09';

export function seedKnowledge(): { sources: number; documents: number; dtcs: number } {
  return transaction(() => {
    for (const source of KNOWLEDGE_SOURCES) {
      run(
        `INSERT INTO knowledge_sources (id, title, publisher, reliability, version, date, url, licence)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, publisher = excluded.publisher, reliability = excluded.reliability,
           version = excluded.version, date = excluded.date, url = excluded.url, licence = excluded.licence`,
        [source.id, source.title, source.publisher, source.reliability, source.version, source.date, source.url ?? null, source.licence ?? null],
      );
    }

    for (const document of RAG_DOCUMENTS) {
      run(
        `INSERT INTO knowledge_documents (id, source_id, title_fr, title_en, content_fr, content_en, tags, relates_to, version, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET title_fr = excluded.title_fr, title_en = excluded.title_en, content_fr = excluded.content_fr,
           content_en = excluded.content_en, tags = excluded.tags, relates_to = excluded.relates_to, version = excluded.version, updated_at = excluded.updated_at`,
        [
          document.id,
          document.sourceId,
          document.titleFr,
          document.titleEn,
          document.contentFr,
          document.contentEn,
          JSON.stringify(document.tags),
          JSON.stringify(document.relatesTo ?? {}),
          document.version,
          document.updatedAt,
        ],
      );
    }

    for (const dtc of ALL_DTC_KNOWLEDGE) {
      run(
        `INSERT INTO dtc_codes (code, technical, simple_fr, simple_en, system, severity, can_drive_default, consequences, likely_causes, related_pids, related_tests, related_codes, source_id, version, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(code) DO UPDATE SET technical = excluded.technical, simple_fr = excluded.simple_fr, simple_en = excluded.simple_en,
           system = excluded.system, severity = excluded.severity, can_drive_default = excluded.can_drive_default,
           consequences = excluded.consequences, likely_causes = excluded.likely_causes, related_pids = excluded.related_pids,
           related_tests = excluded.related_tests, related_codes = excluded.related_codes, source_id = excluded.source_id,
           version = excluded.version, updated_at = excluded.updated_at`,
        [
          dtc.code,
          dtc.technical,
          dtc.simpleFr,
          dtc.simpleEn,
          dtc.system,
          dtc.severity,
          dtc.canDriveDefault,
          JSON.stringify(dtc.consequences),
          JSON.stringify(dtc.likelyCauses),
          JSON.stringify(dtc.relatedPids),
          JSON.stringify(dtc.relatedTests),
          JSON.stringify(dtc.relatedCodes ?? []),
          dtc.sourceId,
          KNOWLEDGE_VERSION,
          now(),
        ],
      );
    }

    return { sources: KNOWLEDGE_SOURCES.length, documents: RAG_DOCUMENTS.length, dtcs: ALL_DTC_KNOWLEDGE.length };
  });
}

export function seedReferenceData(): { specs: number; garages: number; parts: number } {
  return transaction(() => {
    for (const spec of VEHICLE_SPECS) {
      const existing = get<Row>('SELECT id FROM vehicle_specs WHERE brand = ? AND model = ? AND year_from = ? AND year_to = ?', [
        spec.brand,
        spec.model,
        spec.yearFrom,
        spec.yearTo,
      ]);
      if (existing) continue;
      run(
        `INSERT INTO vehicle_specs (id, brand, model, year_from, year_to, engine, fuel_type, oil_spec, oil_capacity_l, coolant_spec, timing_type, timing_interval_km, spark_plug_spec, spark_plug_interval_km, common_issues, source_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id('spec'),
          spec.brand,
          spec.model,
          spec.yearFrom,
          spec.yearTo,
          spec.engine,
          spec.fuelType,
          spec.oilSpec,
          spec.oilCapacityL,
          spec.coolantSpec,
          spec.timingType,
          spec.timingIntervalKm,
          spec.sparkPlugSpec,
          spec.sparkPlugIntervalKm,
          JSON.stringify(spec.commonIssues),
          'src_maintenance_ranges',
        ],
      );
    }

    for (const garage of GARAGES) {
      const existing = get<Row>('SELECT id FROM garages WHERE name = ?', [garage.name]);
      if (existing) continue;
      const garageId = id('garage');
      run(
        `INSERT INTO garages (id, name, city, country, lat, lon, phone, whatsapp, email, brands, specialties, equipment, services, opening_hours, verified, rating, accepts_xamoto, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          garageId,
          garage.name,
          garage.city,
          garage.country,
          garage.lat,
          garage.lon,
          garage.phone,
          garage.whatsapp,
          garage.email,
          JSON.stringify(garage.brands),
          JSON.stringify(garage.specialties),
          JSON.stringify(garage.equipment),
          JSON.stringify(garage.services),
          garage.openingHours,
          garage.verified ? 1 : 0,
          typeof garage.rating === 'number' ? garage.rating : null,
          garage.acceptsXamoto ? 1 : 0,
          now(),
        ],
      );
      if (garage.sampleService) {
        run('INSERT INTO garage_services (id, garage_id, service, price_from, currency, duration_h) VALUES (?,?,?,?,?,?)', [
          id('gservice'),
          garageId,
          garage.sampleService.service,
          garage.sampleService.priceFrom,
          'XOF',
          null,
        ]);
      }
    }

    for (const part of PARTS) {
      run(
        `INSERT INTO parts (id, part_key, name_fr, name_en, category, oem_references, equivalents, fits_brands, fits_engines, fits_year_from, fits_year_to, availability_sn, typical_price_xof, source_id, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(part_key) DO UPDATE SET name_fr = excluded.name_fr, name_en = excluded.name_en, category = excluded.category,
           availability_sn = excluded.availability_sn, typical_price_xof = excluded.typical_price_xof, updated_at = excluded.updated_at`,
        [
          id('part'),
          part.partKey,
          part.nameFr,
          part.nameEn,
          part.category,
          JSON.stringify(part.oemReferences),
          JSON.stringify(part.equivalents),
          JSON.stringify(part.fitsBrands),
          JSON.stringify(part.fitsEngines),
          null,
          null,
          part.availabilitySn,
          part.typicalPriceXof,
          'src_garage_partner',
          now(),
        ],
      );
    }

    return { specs: VEHICLE_SPECS.length, garages: GARAGES.length, parts: PARTS.length };
  });
}

/**
 * Compte de démonstration (§31) : l'utilisateur découvre XAMOTO sans véhicule et
 * sans adaptateur. Les données proviennent du SIMULATEUR — c'est écrit partout.
 */
export async function seedDemo(): Promise<{ userId: string; vehicleIds: string[]; scanIds: string[] } | null> {
  const existing = get<Row>('SELECT id FROM users WHERE email = ?', [DEMO_CREDENTIALS.email]);
  if (existing) return null;

  const user = createUser({
    email: DEMO_CREDENTIALS.email,
    password: DEMO_CREDENTIALS.password,
    fullName: DEMO_CREDENTIALS.fullName,
    country: 'SN',
    locale: 'fr',
    plan: 'premium',
  });

  const vehicles = [
    {
      nickname: 'Ma Corolla (démo)',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2016,
      engine: '1.6 VVT-i',
      fuelType: 'essence',
      plate: 'DK-1234-AB',
      vin: 'JTDBR32E60J012345',
      odometerKm: 128400,
      scenario: 'engine_fault' as const,
      symptoms: ['jerking', 'loss_of_power'],
    },
    {
      nickname: 'Le pick-up (démo)',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2014,
      engine: '2.5 D-4D',
      fuelType: 'diesel',
      plate: 'DK-8890-CD',
      vin: null,
      odometerKm: 245800,
      scenario: 'diesel_egr_dpf' as const,
      symptoms: ['loss_of_power', 'black_smoke', 'limp_mode'],
    },
    {
      nickname: 'Voiture de ville (démo)',
      brand: 'Peugeot',
      model: 'Partner',
      year: 2013,
      engine: '1.6 HDi',
      fuelType: 'diesel',
      plate: 'DK-4471-EF',
      vin: null,
      odometerKm: 189300,
      scenario: 'no_start' as const,
      symptoms: ['no_start'],
    },
  ];

  const vehicleIds: string[] = [];
  const scanIds: string[] = [];
  /** Véhicule propriétaire de chaque scan, dans le même ordre que `scanIds`. */
  const scanVehicles: string[] = [];
  for (const vehicle of vehicles) {
    const vehicleId = id('veh');
    run(
      `INSERT INTO vehicles (id, owner_id, nickname, brand, model, year, engine, fuel_type, gearbox, plate, vin, country, odometer_km, odometer_updated_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        vehicleId,
        user.id,
        vehicle.nickname,
        vehicle.brand,
        vehicle.model,
        vehicle.year,
        vehicle.engine,
        vehicle.fuelType,
        'manuelle',
        vehicle.plate,
        vehicle.vin,
        'SN',
        vehicle.odometerKm,
        now(),
        now(),
        now(),
      ],
    );
    vehicleIds.push(vehicleId);
    run('INSERT INTO vehicle_events (id, vehicle_id, type, title_fr, title_en, detail, odometer_km, occurred_at, origin) VALUES (?,?,?,?,?,?,?,?,?)', [
      id('evt'),
      vehicleId,
      'vehicle_created',
      'Véhicule ajouté au compte de démonstration',
      'Vehicle added to the demo account',
      `${vehicle.brand} ${vehicle.model} — données de démonstration (simulateur)`,
      vehicle.odometerKm,
      now(),
      'documented',
    ]);
  }

  // Les scans de démonstration sont produits par le SIMULATEUR, jamais saisis à
  // la main : le mode démo traverse donc exactement le même moteur que le réel.
  const { runScan } = await import('../services/scanService.js');
  const scans: Array<{ vehicleIndex: number; scenario: typeof vehicles[number]['scenario']; symptoms: string[] }> = [
    { vehicleIndex: 0, scenario: 'engine_fault', symptoms: ['jerking', 'loss_of_power'] },
    { vehicleIndex: 1, scenario: 'diesel_egr_dpf', symptoms: ['loss_of_power', 'black_smoke', 'limp_mode'] },
    { vehicleIndex: 2, scenario: 'no_start', symptoms: ['no_start'] },
  ];
  for (const scan of scans) {
    try {
      const outcome = await runScan({
        userId: user.id,
        vehicleId: vehicleIds[scan.vehicleIndex] as string,
        mode: 'simulator',
        scenario: scan.scenario,
        samples: 6,
        symptoms: scan.symptoms.map((key) => ({ key: key as never, present: true, intensity: 'moderate' as const })),
      });
      scanIds.push(outcome.diagnosticSessionId);
      scanVehicles.push(vehicleIds[scan.vehicleIndex] as string);
    } catch (error) {
      console.warn('[xamoto][seed] scan de démonstration ignoré :', (error as Error).message);
    }
  }

  /*
   * Un devis de démonstration PAR véhicule diagnostiqué.
   *
   * Trois raisons de les amorcer :
   *   1. sans devis, l'écran « Devis » (§27) est vide en mode découverte, et un
   *      écran vide n'apprend rien au lecteur ;
   *   2. les postes viennent des pièces réellement citées par le diagnostic du
   *      véhicule : l'analyse a donc quelque chose de vrai à confronter ;
   *   3. l'écran est accessible depuis n'importe quel véhicule sélectionné.
   *
   * Les montants sont explicitement annoncés comme fictifs : un prix inventé qui
   * passerait pour réel serait exactement ce que le §47-1 interdit.
   */
  const garage = get<Row>('SELECT id, name FROM garages ORDER BY name LIMIT 1');

  if (garage) {
    scanIds.forEach((scanId, index) => {
      const vehicleId = scanVehicles[index];
      if (!vehicleId) return;

      const citedParts = all<Row>('SELECT parts FROM hypotheses WHERE session_id = ? ORDER BY score DESC LIMIT 2', [scanId])
        .flatMap((row) => jsonParse<string[]>(row.parts, []))
        .map((part) => part.replace(/_/g, ' '))
        .slice(0, 2);

      const lines = [
        ...citedParts.map((label) => ({ label, quantity: 1, unitAmount: 45000, currency: 'XOF' })),
        // Un poste que l'OBD ne peut PAS relier à une mesure : c'est le cas le
        // plus utile à montrer, puisqu'il déclenche une question à poser au
        // garage au lieu d'un soupçon.
        { label: 'Vidange moteur et filtres', quantity: 1, unitAmount: 25000, currency: 'XOF' },
        { label: 'Main-d’œuvre (2 h)', quantity: 2, unitAmount: 10000, currency: 'XOF' },
      ];

      run(
        // Pas de colonne `currency` dans la table : la devise est portée par
        // chaque ligne du devis, telle que le garage l'a écrite.
        `INSERT INTO quotes (id, user_id, vehicle_id, diagnostic_session_id, garage_id, status, lines, warranty_months, delay_days, factual_summary, requested_at, received_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id('quote'),
          user.id,
          vehicleId,
          scanId,
          String(garage.id),
          'received',
          JSON.stringify(lines),
          3,
          2,
          'Devis de démonstration : les montants sont fictifs et servent uniquement à montrer l’analyse factuelle. Aucun prix réel n’est suggéré.',
          now(),
          now(),
        ],
      );
    });
  }

  return { userId: user.id, vehicleIds, scanIds };
}

/**
 * Amorçage complet, idempotent : peut être appelé à chaque démarrage.
 * Les données déjà présentes ne sont jamais dupliquées.
 */
export async function seedAll(options: { withDemo?: boolean } = {}): Promise<{
  knowledge: ReturnType<typeof seedKnowledge>;
  reference: ReturnType<typeof seedReferenceData>;
  demo: Awaited<ReturnType<typeof seedDemo>>;
}> {
  const knowledge = seedKnowledge();
  const reference = seedReferenceData();
  const demo = options.withDemo === false ? null : await seedDemo();
  return { knowledge, reference, demo };
}

/** Supprime toutes les données sauf la base de connaissances. */
export function resetApplicationData(): void {
  const tables = [
    'ai_messages',
    'ai_conversations',
    'alerts',
    'notifications',
    'sync_operations',
    'reports',
    'inspections',
    'repairs_verification',
    'repairs',
    'maintenance',
    'vehicle_documents',
    'vehicle_events',
    'vehicle_passport',
    'diagnostic_test_results',
    'diagnostic_tests',
    'hypotheses',
    'diagnostic_findings',
    'diagnostic_sessions',
    'dtc_events',
    'obd_data',
    'obd_sessions',
    'obd_devices',
    'quotes',
    'vehicle_shares',
    'part_compatibility',
    'parts',
    'garage_services',
    'garages',
    'vehicle_specs',
    'vehicles',
    'sessions',
    'users',
    'organizations',
  ];
  transaction(() => {
    for (const table of tables) {
      if (!get<Row>('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', ['table', table])) continue;
      run(`DELETE FROM ${table}`);
    }
  });
}

/** Diagnostic d'amorçage, affiché par la commande `npm run seed`. */
export function seedStatus(): Record<string, number> {
  return {
    sources: Number(get<Row>('SELECT COUNT(*) AS c FROM knowledge_sources')?.c ?? 0),
    documents: Number(get<Row>('SELECT COUNT(*) AS c FROM knowledge_documents')?.c ?? 0),
    dtcCodes: Number(get<Row>('SELECT COUNT(*) AS c FROM dtc_codes')?.c ?? 0),
    vehicleSpecs: Number(get<Row>('SELECT COUNT(*) AS c FROM vehicle_specs')?.c ?? 0),
    garages: Number(get<Row>('SELECT COUNT(*) AS c FROM garages')?.c ?? 0),
    parts: Number(get<Row>('SELECT COUNT(*) AS c FROM parts')?.c ?? 0),
    users: Number(get<Row>('SELECT COUNT(*) AS c FROM users')?.c ?? 0),
    vehicles: Number(get<Row>('SELECT COUNT(*) AS c FROM vehicles')?.c ?? 0),
    scans: Number(get<Row>('SELECT COUNT(*) AS c FROM obd_sessions')?.c ?? 0),
    diagnostics: Number(get<Row>('SELECT COUNT(*) AS c FROM diagnostic_sessions')?.c ?? 0),
    hypotheses: Number(get<Row>('SELECT COUNT(*) AS c FROM hypotheses')?.c ?? 0),
    alerts: Number(get<Row>('SELECT COUNT(*) AS c FROM alerts')?.c ?? 0),
    auditLogs: Number(get<Row>('SELECT COUNT(*) AS c FROM audit_logs')?.c ?? 0),
  };
}

/** Vérifie que la base est prête (utilisé au démarrage et dans les tests). */
export function databaseHealthy(): boolean {
  try {
    const tableCount = Number(get<Row>("SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table'")?.c ?? 0);
    return tableCount >= 30;
  } catch {
    return false;
  }
}

export { hashPassword };
