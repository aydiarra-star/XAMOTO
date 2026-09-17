/**
 * XAMOTO — Base de connaissances DTC (§9).
 *
 * ⚠️ Règle de provenance (§33, §47-9) :
 *  – les libellés techniques proviennent de la nomenclature normalisée SAE J2012,
 *  – les gravités, conséquences et listes de causes proviennent de la
 *    documentation technique publique et de la pratique d'atelier,
 *  – les `baseRate` sont des PONDÉRATIONS D'INGÉNIERIE XAMOTO (fréquence
 *    relative observée en atelier, pas une statistique officielle). Elles
 *    servent uniquement à ORDONNER des hypothèses, jamais à conclure :
 *    le niveau de certitude est calculé par le moteur, pas par la pondération.
 *
 * Aucune cause n'est présentée à l'utilisateur comme certaine du seul fait
 * qu'un code défaut est présent.
 */
import type { DataOrigin, DtcDefinition, DtcSystem, LikelyCause, PidKey, SafetyLevel } from '@xamoto/shared';

export interface DtcKnowledge extends DtcDefinition {
  /** Note de provenance : d'où viennent les pondérations. */
  provenanceNote?: string;
}

const ENGINE_SOURCE = 'src_sae_j2012';
const PRACTICE_SOURCE = 'src_xamoto_practice';

const cause = (
  key: string,
  labelFr: string,
  labelEn: string,
  baseRate: number,
  extra: Partial<LikelyCause> = {},
): LikelyCause => ({ key, labelFr, labelEn, baseRate, ...extra });

function dtc(d: {
  code: string;
  technical: string;
  simpleFr: string;
  simpleEn: string;
  system: DtcSystem;
  severity: SafetyLevel;
  canDriveDefault: DtcDefinition['canDriveDefault'];
  consequences: string[];
  likelyCauses: LikelyCause[];
  relatedPids: PidKey[];
  relatedTests: string[];
  relatedCodes?: string[];
  frequentOn?: string[];
}): DtcKnowledge {
  return {
    ...d,
    sourceId: PRACTICE_SOURCE,
    provenanceNote:
      'Libellé normalisé SAE J2012. Gravité, conséquences et pondérations : documentation technique publique + pratique d’atelier, pondérées par XAMOTO.',
  };
}

/* ────────────────────────────── Allumage / ratés ─────────────────────────── */

const MISFIRE_CONSEQUENCES = [
  'Le carburant non brûlé dégrade le catalyseur.',
  'Risque de surchauffe localisée et de détérioration du moteur si le défaut persiste.',
  'Consommation en hausse et perte de puissance.',
];

const misfireCauses = (cylinder: number): LikelyCause[] => [
  cause(`ignition_coil_${cylinder}`, `Bobine d’allumage cylindre ${cylinder}`, `Ignition coil cylinder ${cylinder}`, 0.28, {
    explainsCodes: [`P030${cylinder}`, 'P0300'],
    confirmedBy: 'test_ignition_spark_check',
    parts: ['bobine_allumage', 'bougie_allumage'],
  }),
  cause(`spark_plug_${cylinder}`, `Bougie d’allumage cylindre ${cylinder}`, `Spark plug cylinder ${cylinder}`, 0.24, {
    explainsCodes: [`P030${cylinder}`, 'P0300'],
    confirmedBy: 'test_ignition_spark_check',
    parts: ['bougie_allumage'],
  }),
  cause(`injector_${cylinder}`, `Injecteur cylindre ${cylinder}`, `Injector cylinder ${cylinder}`, 0.16, {
    explainsCodes: [`P030${cylinder}`, 'P0300', 'P0171'],
    confirmedBy: 'test_injector_balance',
    parts: ['injecteur'],
  }),
  cause('compression_low', 'Compression insuffisante (soupape, segment, joint)', 'Low compression (valve, ring, gasket)', 0.12, {
    explainsCodes: [`P030${cylinder}`, 'P0300'],
    confirmedBy: 'test_compression',
  }),
  cause('vacuum_leak', 'Prise d’air à l’admission', 'Intake vacuum leak', 0.1, {
    explainsCodes: ['P0171', 'P0300', 'P0301'],
    confirmedBy: 'test_vacuum_leak',
  }),
  cause('fuel_pressure_low', 'Pression carburant insuffisante (pompe, filtre)', 'Insufficient fuel pressure (pump, filter)', 0.1, {
    explainsCodes: ['P0087', 'P0171'],
    confirmedBy: 'test_fuel_pressure',
    parts: ['filtre_carburant', 'pompe_carburant'],
  }),
];

const misfirePids: PidKey[] = [
  'engine_rpm',
  'engine_load',
  'coolant_temp',
  'short_fuel_trim_b1',
  'long_fuel_trim_b1',
  'o2_b1s1_voltage',
  'maf_air_flow',
  'misfire_count',
];

const CYLINDER_CODES: Array<{ n: 1 | 2 | 3 | 4; code: string; fr: string; en: string }> = [
  { n: 1, code: 'P0301', fr: 'Ratés d’allumage détectés sur le cylindre 1', en: 'Cylinder 1 misfire detected' },
  { n: 2, code: 'P0302', fr: 'Ratés d’allumage détectés sur le cylindre 2', en: 'Cylinder 2 misfire detected' },
  { n: 3, code: 'P0303', fr: 'Ratés d’allumage détectés sur le cylindre 3', en: 'Cylinder 3 misfire detected' },
  { n: 4, code: 'P0304', fr: 'Ratés d’allumage détectés sur le cylindre 4', en: 'Cylinder 4 misfire detected' },
];

/* ────────────────────────────── Mélange / carburant ──────────────────────── */

export const ENGINE_DTCS: DtcKnowledge[] = [
  dtc({
    code: 'P0300',
    technical: 'Random / multiple cylinder misfire detected',
    simpleFr:
      'Le calculateur détecte des ratés d’allumage sur plusieurs cylindres sans pouvoir les attribuer à un cylindre précis. Le mélange ne brûle pas correctement.',
    simpleEn:
      'The ECU detects misfires on several cylinders without attributing them to one specific cylinder. The mixture is not burning correctly.',
    system: 'allumage',
    severity: 'important',
    canDriveDefault: 'limited',
    consequences: MISFIRE_CONSEQUENCES,
    likelyCauses: [
      ...misfireCauses(1),
      cause('fuel_quality', 'Carburant de qualité inadaptée ou présence d’eau', 'Poor fuel quality or water in fuel', 0.14, {
        explainsCodes: ['P0300', 'P0171'],
        confirmedBy: 'test_fuel_quality',
      }),
      cause('maf_dirty', 'Capteur de débit d’air encrassé', 'Dirty mass air flow sensor', 0.12, {
        explainsCodes: ['P0171', 'P0300'],
        parts: ['capteur_debit_air'],
      }),
      cause('egr_stuck_open', 'Vanne EGR bloquée ouverte', 'EGR valve stuck open', 0.09, {
        explainsCodes: ['P0401', 'P0300'],
        confirmedBy: 'test_egr_operation',
      }),
    ],
    relatedPids: misfirePids,
    relatedTests: ['test_ignition_spark_check', 'test_vacuum_leak', 'test_fuel_pressure', 'test_compression'],
    relatedCodes: ['P0301', 'P0302', 'P0303', 'P0304', 'P0171'],
    frequentOn: ['véhicules essence fortement kilométrés'],
  }),
  ...CYLINDER_CODES.map((c) =>
    dtc({
      code: c.code,
      technical: `Cylinder ${c.n} misfire detected`,
      simpleFr: `${c.fr}. Le cylindre concerné ne participe pas correctement à la combustion.`,
      simpleEn: `${c.en}. The affected cylinder does not contribute correctly to combustion.`,
      system: 'allumage',
      severity: 'important',
      canDriveDefault: 'limited',
      consequences: MISFIRE_CONSEQUENCES,
      likelyCauses: misfireCauses(c.n),
      relatedPids: [...misfirePids, 'compression' as PidKey].filter((p) => p !== ('compression' as PidKey)),
      relatedTests: ['test_ignition_spark_check', 'test_injector_balance', 'test_compression', 'test_vacuum_leak'],
      relatedCodes: ['P0300', 'P0171', 'P0420'],
    }),
  ),
  dtc({
    code: 'P0171',
    technical: 'System too lean (Bank 1)',
    simpleFr:
      'Le mélange air/carburant est trop pauvre sur la banque 1 : trop d’air pour la quantité de carburant injectée. Le calculateur corrige au maximum sans réussir à rétablir l’équilibre.',
    simpleEn:
      'The air/fuel mixture is too lean on bank 1: too much air for the injected fuel. The ECU corrects to its limit without restoring the balance.',
    system: 'carburant',
    severity: 'important',
    canDriveDefault: 'with_caution',
    consequences: [
      'Surchauffe possible de la chambre de combustion.',
      'Ratés d’allumage et à-coups.',
      'Dégradation du catalyseur à terme.',
    ],
    likelyCauses: [
      cause('vacuum_leak', 'Prise d’air à l’admission (durite, joint, collecteur)', 'Intake vacuum leak (hose, gasket, manifold)', 0.34, {
        confirmedBy: 'test_vacuum_leak',
        parts: ['joint_admission', 'durite_admission'],
      }),
      cause('maf_dirty', 'Capteur de débit d’air sale ou défaillant', 'Dirty or faulty mass air flow sensor', 0.2, {
        explainsCodes: ['P0171', 'P0101'],
        confirmedBy: 'test_maf_reading',
        parts: ['capteur_debit_air'],
      }),
      cause('fuel_pressure_low', 'Pression carburant trop basse (pompe, filtre, régulateur)', 'Fuel pressure too low (pump, filter, regulator)', 0.18, {
        explainsCodes: ['P0171', 'P0087'],
        confirmedBy: 'test_fuel_pressure',
        parts: ['filtre_carburant', 'pompe_carburant', 'regulateur_pression'],
      }),
      cause('o2_sensor_biased', 'Sonde O2 amont faussée', 'Biased upstream O2 sensor', 0.14, {
        explainsCodes: ['P0171', 'P0134'],
        confirmedBy: 'test_o2_sensor_activity',
        parts: ['sonde_o2_amont'],
      }),
      cause('injectors_clogged', 'Injecteurs encrassés', 'Clogged injectors', 0.1, {
        confirmedBy: 'test_injector_balance',
        parts: ['injecteur'],
      }),
      cause('exhaust_leak_before_o2', 'Fuite d’échappement avant la sonde O2', 'Exhaust leak before the O2 sensor', 0.08, {
        confirmedBy: 'test_exhaust_leak',
      }),
    ],
    relatedPids: ['long_fuel_trim_b1', 'short_fuel_trim_b1', 'o2_b1s1_voltage', 'maf_air_flow', 'map_pressure', 'fuel_pressure', 'engine_rpm'],
    relatedTests: ['test_vacuum_leak', 'test_maf_reading', 'test_fuel_pressure', 'test_o2_sensor_activity'],
    relatedCodes: ['P0174', 'P0300', 'P0420', 'P0134'],
  }),
  dtc({
    code: 'P0172',
    technical: 'System too rich (Bank 1)',
    simpleFr:
      'Le mélange est trop riche sur la banque 1 : trop de carburant pour l’air admis. Le calculateur réduit l’injection au maximum sans retrouver l’équilibre.',
    simpleEn:
      'The mixture is too rich on bank 1: too much fuel for the intake air. The ECU reduces injection to its limit without restoring balance.',
    system: 'carburant',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Encrassement des bougies et du catalyseur.', 'Consommation excessive.', 'Ratés d’allumage possibles.'],
    likelyCauses: [
      cause('injector_leaking', 'Injecteur qui fuit', 'Leaking injector', 0.26, {
        confirmedBy: 'test_injector_balance',
        parts: ['injecteur'],
      }),
      cause('fuel_pressure_high', 'Pression carburant trop élevée', 'Fuel pressure too high', 0.22, {
        explainsCodes: ['P0172', 'P0088'],
        confirmedBy: 'test_fuel_pressure',
        parts: ['regulateur_pression'],
      }),
      cause('maf_dirty', 'Capteur de débit d’air surestimant le débit', 'MAF sensor over-reporting air flow', 0.2, {
        confirmedBy: 'test_maf_reading',
        parts: ['capteur_debit_air'],
      }),
      cause('o2_sensor_biased', 'Sonde O2 amont faussée (bloquée haute)', 'Biased upstream O2 sensor (stuck high)', 0.16, {
        confirmedBy: 'test_o2_sensor_activity',
        parts: ['sonde_o2_amont'],
      }),
      cause('air_filter_clogged', 'Filtre à air très encrassé', 'Heavily clogged air filter', 0.14, {
        parts: ['filtre_air'],
      }),
      cause('thermostat_stuck_open', 'Thermostat bloqué ouvert (moteur froid permanent)', 'Thermostat stuck open (engine never warm)', 0.1, {
        explainsCodes: ['P0172', 'P0128'],
        parts: ['thermostat'],
      }),
    ],
    relatedPids: ['long_fuel_trim_b1', 'short_fuel_trim_b1', 'o2_b1s1_voltage', 'maf_air_flow', 'coolant_temp', 'fuel_pressure'],
    relatedTests: ['test_injector_balance', 'test_fuel_pressure', 'test_maf_reading', 'test_o2_sensor_activity'],
    relatedCodes: ['P0175', 'P0128', 'P0420'],
  }),
  dtc({
    code: 'P0087',
    technical: 'Fuel rail / system pressure — too low',
    simpleFr:
      'La pression de carburant dans la rampe est inférieure à la valeur attendue. Le moteur peut manquer de carburant, surtout en accélération.',
    simpleEn:
      'Fuel rail pressure is below the expected value. The engine may be starved of fuel, especially under acceleration.',
    system: 'carburant',
    severity: 'important',
    canDriveDefault: 'limited',
    consequences: [
      'Coupures d’injection et perte de puissance.',
      'Ratés d’allumage.',
      'Risque d’arrêt moteur en circulation.',
    ],
    likelyCauses: [
      cause('fuel_filter_clogged', 'Filtre à carburant colmaté', 'Clogged fuel filter', 0.32, {
        confirmedBy: 'test_fuel_pressure',
        parts: ['filtre_carburant'],
      }),
      cause('fuel_pump_weak', 'Pompe à carburant faible', 'Weak fuel pump', 0.28, {
        confirmedBy: 'test_fuel_pressure',
        parts: ['pompe_carburant'],
      }),
      cause('pressure_regulator_faulty', 'Régulateur de pression défaillant', 'Faulty pressure regulator', 0.16, {
        parts: ['regulateur_pression'],
      }),
      cause('leak_in_fuel_line', 'Fuite sur le circuit d’alimentation', 'Leak in the fuel supply line', 0.12, {
        parts: ['durite_carburant'],
      }),
      cause('fuel_quality', 'Carburant de qualité inadaptée ou présence d’eau', 'Poor fuel quality or water in fuel', 0.12, {}),
    ],
    relatedPids: ['fuel_pressure', 'long_fuel_trim_b1', 'engine_rpm', 'engine_load'],
    relatedTests: ['test_fuel_pressure', 'test_fuel_quality'],
    relatedCodes: ['P0171', 'P0300', 'P0088'],
  }),
  dtc({
    code: 'P0088',
    technical: 'Fuel rail / system pressure — too high',
    simpleFr: 'La pression de carburant est supérieure à la valeur attendue. Le moteur reçoit trop de carburant.',
    simpleEn: 'Fuel pressure is above the expected value. The engine receives too much fuel.',
    system: 'carburant',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Mélange trop riche.', 'Encrassement des bougies.', 'Surcharge du catalyseur.'],
    likelyCauses: [
      cause('pressure_regulator_faulty', 'Régulateur de pression bloqué fermé', 'Pressure regulator stuck closed', 0.45, {
        confirmedBy: 'test_fuel_pressure',
        parts: ['regulateur_pression'],
      }),
      cause('return_line_blocked', 'Conduite de retour bouchée', 'Blocked return line', 0.3, {}),
      cause('fuel_pressure_sensor_faulty', 'Capteur de pression carburant défaillant', 'Faulty fuel pressure sensor', 0.25, {
        parts: ['capteur_pression_carburant'],
      }),
    ],
    relatedPids: ['fuel_pressure', 'long_fuel_trim_b1'],
    relatedTests: ['test_fuel_pressure'],
    relatedCodes: ['P0172'],
  }),
];

/* ─────────────────────────── Admission / suralimentation ────────────────── */

export const INTAKE_DTCS: DtcKnowledge[] = [
  dtc({
    code: 'P0101',
    technical: 'Mass air flow (MAF) circuit — range/performance problem',
    simpleFr:
      'La valeur mesurée par le capteur de débit d’air n’est pas cohérente avec ce que le calculateur attend du moteur (régime et charge).',
    simpleEn:
      'The air flow sensor reading is inconsistent with what the ECU expects from the engine (rpm and load).',
    system: 'admission',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Mélange mal dosé.', 'Consommation anormale.', 'À-coups et perte de réactivité.'],
    likelyCauses: [
      cause('maf_dirty', 'Capteur de débit d’air encrassé', 'Dirty mass air flow sensor', 0.42, {
        confirmedBy: 'test_maf_reading',
        parts: ['capteur_debit_air'],
      }),
      cause('air_leak_after_maf', 'Prise d’air entre le capteur et le moteur', 'Air leak between sensor and engine', 0.28, {
        confirmedBy: 'test_vacuum_leak',
        parts: ['durite_admission'],
      }),
      cause('air_filter_clogged', 'Filtre à air colmaté', 'Clogged air filter', 0.18, {
        parts: ['filtre_air'],
      }),
      cause('maf_wiring', 'Câblage ou connecteur de capteur défectueux', 'Faulty sensor wiring or connector', 0.12, {
        confirmedBy: 'test_wiring_visual',
      }),
    ],
    relatedPids: ['maf_air_flow', 'engine_load', 'engine_rpm', 'long_fuel_trim_b1', 'throttle_position'],
    relatedTests: ['test_maf_reading', 'test_vacuum_leak', 'test_wiring_visual'],
    relatedCodes: ['P0171', 'P0102'],
  }),
  dtc({
    code: 'P0102',
    technical: 'Mass air flow (MAF) circuit — low input',
    simpleFr: 'Le signal du capteur de débit d’air est anormalement bas (ou absent).',
    simpleEn: 'The air flow sensor signal is abnormally low (or absent).',
    system: 'admission',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Mélange mal dosé.', 'Mode dégradé possible.'],
    likelyCauses: [
      cause('maf_wiring', 'Circuit ouvert ou connecteur débranché', 'Open circuit or disconnected connector', 0.4, {
        confirmedBy: 'test_wiring_visual',
      }),
      cause('maf_faulty', 'Capteur de débit d’air défaillant', 'Faulty mass air flow sensor', 0.36, {
        parts: ['capteur_debit_air'],
      }),
      cause('air_leak_after_maf', 'Prise d’air importante après le capteur', 'Major air leak after the sensor', 0.14, {
        confirmedBy: 'test_vacuum_leak',
      }),
      cause('ecm_connector', 'Connecteur calculateur oxydé', 'Corroded ECU connector', 0.1, {}),
    ],
    relatedPids: ['maf_air_flow', 'engine_load', 'engine_rpm'],
    relatedTests: ['test_wiring_visual', 'test_maf_reading', 'test_vacuum_leak'],
  }),
  dtc({
    code: 'P0106',
    technical: 'Manifold absolute pressure (MAP) — range/performance problem',
    simpleFr: 'La pression mesurée dans le collecteur d’admission est incohérente avec le régime et la charge du moteur.',
    simpleEn: 'Intake manifold pressure does not match engine speed and load.',
    system: 'admission',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Calcul de charge moteur erroné.', 'Consommation et puissance affectées.'],
    likelyCauses: [
      cause('map_sensor_faulty', 'Capteur MAP défaillant', 'Faulty MAP sensor', 0.38, { parts: ['capteur_map'] }),
      cause('map_hose_blocked', 'Durite de capteur MAP bouchée ou percée', 'Blocked or split MAP sensor hose', 0.3, {}),
      cause('map_wiring', 'Câblage du capteur MAP', 'MAP sensor wiring', 0.2, { confirmedBy: 'test_wiring_visual' }),
      cause('vacuum_leak', 'Prise d’air à l’admission', 'Intake vacuum leak', 0.12, { confirmedBy: 'test_vacuum_leak' }),
    ],
    relatedPids: ['map_pressure', 'engine_load', 'engine_rpm', 'barometric_pressure'],
    relatedTests: ['test_map_reading', 'test_vacuum_leak', 'test_wiring_visual'],
  }),
  dtc({
    code: 'P0234',
    technical: 'Turbocharger overboost condition',
    simpleFr: 'Le turbocompresseur produit une pression supérieure à la consigne. Le calculateur protège le moteur en réduisant la puissance.',
    simpleEn: 'The turbocharger produces more boost than commanded. The ECU protects the engine by reducing power.',
    system: 'admission',
    severity: 'important',
    canDriveDefault: 'limited',
    consequences: ['Coupure de puissance.', 'Risque mécanique sur le moteur si répété.'],
    likelyCauses: [
      cause('wastegate_stuck', 'Wastegate bloquée fermée', 'Wastegate stuck closed', 0.4, { parts: ['wastegate'] }),
      cause('boost_control_valve', 'Électrovanne de suralimentation défaillante', 'Faulty boost control solenoid', 0.3, {
        parts: ['electrovanne_suralimentation'],
      }),
      cause('map_sensor_faulty', 'Capteur MAP défaillant (mesure fausse)', 'Faulty MAP sensor (false reading)', 0.2, {
        parts: ['capteur_map'],
      }),
      cause('boost_hose_leak', 'Durite de suralimentation percée', 'Split boost hose', 0.1, {}),
    ],
    relatedPids: ['map_pressure', 'engine_load', 'engine_rpm'],
    relatedTests: ['test_boost_control', 'test_map_reading'],
    relatedCodes: ['P0299'],
    frequentOn: ['diesel à géométrie variable'],
  }),
  dtc({
    code: 'P0299',
    technical: 'Turbocharger underboost condition',
    simpleFr: 'Le turbocompresseur ne fournit pas la pression attendue. Le moteur manque de puissance, surtout dans les montées.',
    simpleEn: 'The turbocharger does not deliver expected boost. The engine lacks power, especially on inclines.',
    system: 'admission',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Perte de puissance marquée.', 'Mode dégradé fréquent.', 'Fumée noire possible.'],
    likelyCauses: [
      cause('boost_hose_leak', 'Fuite sur le circuit de suralimentation (durite, échangeur)', 'Leak in the boost circuit (hose, intercooler)', 0.34, {
        parts: ['durite_suralimentation', 'echangeur_air'],
      }),
      cause('wastegate_stuck', 'Wastegate ou géométrie variable bloquée', 'Wastegate or VNT mechanism stuck', 0.26, {
        parts: ['wastegate'],
      }),
      cause('turbo_worn', 'Usure du turbocompresseur', 'Worn turbocharger', 0.14, { parts: ['turbo'] }),
      cause('boost_control_valve', 'Électrovanne de suralimentation', 'Boost control solenoid', 0.14, {
        parts: ['electrovanne_suralimentation'],
      }),
      cause('air_filter_clogged', 'Filtre à air très colmaté', 'Heavily clogged air filter', 0.12, { parts: ['filtre_air'] }),
    ],
    relatedPids: ['map_pressure', 'maf_air_flow', 'engine_load'],
    relatedTests: ['test_boost_leak', 'test_boost_control', 'test_maf_reading'],
    relatedCodes: ['P0234', 'P2463'],
    frequentOn: ['diesel HDi, dCi, TDCi fortement kilométrés'],
  }),
];

/* ───────────────────────────── Refroidissement ──────────────────────────── */

export const COOLING_DTCS: DtcKnowledge[] = [
  dtc({
    code: 'P0217',
    technical: 'Engine over temperature condition',
    simpleFr: 'Le moteur a dépassé sa température normale de fonctionnement. C’est un défaut à traiter immédiatement.',
    simpleEn: 'The engine exceeded its normal operating temperature. This fault must be addressed immediately.',
    system: 'moteur',
    severity: 'critical',
    canDriveDefault: 'no',
    consequences: [
      'Déformation de culasse et destruction du joint de culasse.',
      'Serrage moteur possible.',
      'Risque d’incendie par projection de liquide chaud.',
    ],
    likelyCauses: [
      cause('coolant_level_low', 'Niveau de liquide de refroidissement insuffisant (fuite)', 'Low coolant level (leak)', 0.34, {
        parts: ['liquide_refroidissement', 'durite_refroidissement'],
      }),
      cause('fan_not_working', 'Ventilateur de refroidissement non fonctionnel', 'Cooling fan not working', 0.22, {
        confirmedBy: 'test_fan_operation',
        parts: ['moto_ventilateur'],
      }),
      cause('thermostat_stuck_closed', 'Thermostat bloqué fermé', 'Thermostat stuck closed', 0.18, { parts: ['thermostat'] }),
      cause('water_pump_weak', 'Pompe à eau faible ou défaillante', 'Weak or failed water pump', 0.14, { parts: ['pompe_a_eau'] }),
      cause('radiator_clogged', 'Radiateur entartré ou obstrué', 'Clogged or blocked radiator', 0.12, {
        parts: ['radiateur'],
        confirmedBy: 'test_radiator_flow',
      }),
      cause('head_gasket', 'Joint de culasse défaillant', 'Failed head gasket', 0.08, { confirmedBy: 'test_combustion_gases_coolant' }),
    ],
    relatedPids: ['coolant_temp', 'intake_air_temp', 'engine_rpm', 'engine_load'],
    relatedTests: ['test_coolant_level', 'test_fan_operation', 'test_radiator_flow', 'test_combustion_gases_coolant'],
    relatedCodes: ['P0128', 'P0117', 'P0118'],
    frequentOn: ['usage urbain, embouteillages, climat chaud, poussière'],
  }),
  dtc({
    code: 'P0128',
    technical: 'Coolant thermostat — coolant temperature below regulating temperature',
    simpleFr:
      'Le moteur n’atteint pas sa température normale dans le délai attendu. Le plus souvent, le thermostat reste ouvert.',
    simpleEn:
      'The engine does not reach normal temperature within the expected time. Most often the thermostat stays open.',
    system: 'moteur',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Surconsommation de carburant.', 'Usure accélérée du moteur (graissage imparfait).', 'Chauffage inefficace.'],
    likelyCauses: [
      cause('thermostat_stuck_open', 'Thermostat bloqué ouvert', 'Thermostat stuck open', 0.55, { parts: ['thermostat'] }),
      cause('coolant_temp_sensor_faulty', 'Sonde de température moteur faussée', 'Faulty coolant temperature sensor', 0.22, {
        parts: ['sonde_temperature_moteur'],
      }),
      cause('coolant_level_low', 'Niveau de liquide insuffisant', 'Low coolant level', 0.13, {}),
      cause('fan_always_on', 'Ventilateur actif en permanence', 'Fan running permanently', 0.1, { confirmedBy: 'test_fan_operation' }),
    ],
    relatedPids: ['coolant_temp', 'intake_air_temp', 'runtime_since_start', 'ambient_temp'],
    relatedTests: ['test_warm_up_curve', 'test_coolant_level', 'test_fan_operation'],
    relatedCodes: ['P0217', 'P0116'],
  }),
  dtc({
    code: 'P0117',
    technical: 'Engine coolant temperature sensor 1 circuit — low input',
    simpleFr:
      'Le signal de la sonde de température moteur est incohérent (très bas ou en court-circuit). Le calculateur peut enrichir à tort le mélange.',
    simpleEn:
      'The engine coolant temperature sensor signal is inconsistent (very low or shorted). The ECU may wrongly enrich the mixture.',
    system: 'moteur',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Démarrage difficile à chaud.', 'Surconsommation.', 'Fonctionnement du ventilateur erroné.'],
    likelyCauses: [
      cause('coolant_temp_sensor_faulty', 'Sonde de température défaillante', 'Faulty temperature sensor', 0.45, {
        parts: ['sonde_temperature_moteur'],
      }),
      cause('sensor_wiring_short', 'Câblage en court-circuit', 'Short circuit in wiring', 0.3, { confirmedBy: 'test_wiring_visual' }),
      cause('coolant_temp_connector', 'Connecteur oxydé ou débranché', 'Corroded or disconnected connector', 0.25, {
        confirmedBy: 'test_wiring_visual',
      }),
    ],
    relatedPids: ['coolant_temp', 'ambient_temp', 'intake_air_temp'],
    relatedTests: ['test_coolant_sensor_compare', 'test_wiring_visual'],
    relatedCodes: ['P0118', 'P0128'],
  }),
  dtc({
    code: 'P0118',
    technical: 'Engine coolant temperature sensor 1 circuit — high input',
    simpleFr: 'Le signal de la sonde de température moteur est anormalement haut (circuit ouvert ou sonde débranchée).',
    simpleEn: 'The engine coolant temperature signal is abnormally high (open circuit or unplugged sensor).',
    system: 'moteur',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Enrichissement excessif.', 'Ventilateur déclenché à tort.', 'Surconsommation.'],
    likelyCauses: [
      cause('coolant_temp_sensor_faulty', 'Sonde de température défaillante', 'Faulty temperature sensor', 0.4, {
        parts: ['sonde_temperature_moteur'],
      }),
      cause('sensor_wiring_open', 'Circuit ouvert dans le faisceau', 'Open circuit in the harness', 0.35, { confirmedBy: 'test_wiring_visual' }),
      cause('coolant_temp_connector', 'Connecteur débranché', 'Disconnected connector', 0.25, { confirmedBy: 'test_wiring_visual' }),
    ],
    relatedPids: ['coolant_temp', 'ambient_temp'],
    relatedTests: ['test_coolant_sensor_compare', 'test_wiring_visual'],
    relatedCodes: ['P0117'],
  }),
];

/* ───────────────────────────── Dépollution / échappement ────────────────── */

export const EMISSION_DTCS: DtcKnowledge[] = [
  dtc({
    code: 'P0420',
    technical: 'Catalyst system efficiency below threshold (Bank 1)',
    simpleFr:
      'Le véhicule signale une efficacité insuffisante du système catalytique. Plusieurs causes peuvent produire ce défaut : le catalyseur lui-même, mais aussi une sonde O2, une fuite d’échappement ou un autre défaut moteur non encore corrigé.',
    simpleEn:
      'The vehicle reports insufficient catalytic system efficiency. Several causes may produce this fault: the catalyst itself, but also an O2 sensor, an exhaust leak or another uncorrected engine fault.',
    system: 'depollution',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: [
      'Défaut de contrôle technique (pollution) probable.',
      'Surconsommation légère.',
      'Aucun danger immédiat dans la plupart des cas, mais le défaut masque parfois un autre problème moteur.',
    ],
    likelyCauses: [
      cause('catalyst_worn', 'Catalyseur usé ou endommagé', 'Worn or damaged catalytic converter', 0.38, {
        parts: ['catalyseur'],
        confirmedBy: 'test_o2_downstream_activity',
      }),
      cause('o2_downstream_faulty', 'Sonde O2 aval défaillante', 'Faulty downstream O2 sensor', 0.24, {
        parts: ['sonde_o2_aval'],
        confirmedBy: 'test_o2_sensor_activity',
      }),
      cause('exhaust_leak', 'Fuite d’échappement en amont de la sonde aval', 'Exhaust leak upstream of the downstream sensor', 0.14, {
        confirmedBy: 'test_exhaust_leak',
      }),
      cause('upstream_issue_hidden', 'Défaut moteur masqué (mélange, ratés, consommation d’huile)', 'Hidden engine fault (mixture, misfire, oil consumption)', 0.14, {
        explainsCodes: ['P0171', 'P0300', 'P0420'],
        confirmedBy: 'test_engine_baseline_scan',
      }),
      cause('oil_or_coolant_burning', 'Consommation d’huile ou de liquide dans l’échappement', 'Oil or coolant burning in the exhaust', 0.1, {}),
    ],
    relatedPids: ['o2_b1s1_voltage', 'o2_b1s2_voltage', 'long_fuel_trim_b1', 'short_fuel_trim_b1', 'coolant_temp', 'misfire_count'],
    relatedTests: ['test_o2_sensor_activity', 'test_o2_downstream_activity', 'test_exhaust_leak', 'test_engine_baseline_scan'],
    relatedCodes: ['P0430', 'P0171', 'P0300', 'P0134'],
    frequentOn: ['véhicules essence urbains, traversées de gués, carburant soufré'],
  }),
  dtc({
    code: 'P0134',
    technical: 'O2 sensor circuit — no activity detected (Bank 1, Sensor 1)',
    simpleFr:
      'La sonde O2 amont ne produit plus de variation de signal. Le calculateur ne peut plus réguler le mélange correctement.',
    simpleEn:
      'The upstream O2 sensor no longer produces a varying signal. The ECU can no longer regulate the mixture correctly.',
    system: 'depollution',
    severity: 'important',
    canDriveDefault: 'with_caution',
    consequences: ['Mélange non régulé.', 'Surconsommation.', 'Dégradation du catalyseur.'],
    likelyCauses: [
      cause('o2_upstream_faulty', 'Sonde O2 amont en fin de vie', 'Upstream O2 sensor at end of life', 0.44, {
        parts: ['sonde_o2_amont'],
        confirmedBy: 'test_o2_sensor_activity',
      }),
      cause('o2_wiring', 'Câblage ou connecteur de sonde O2', 'O2 sensor wiring or connector', 0.24, { confirmedBy: 'test_wiring_visual' }),
      cause('exhaust_leak_before_o2', 'Fuite d’échappement avant la sonde', 'Exhaust leak before the sensor', 0.18, { confirmedBy: 'test_exhaust_leak' }),
      cause('sensor_contamination', 'Sonde contaminée (silicone, additifs, liquide de refroidissement)', 'Contaminated sensor (silicone, additives, coolant)', 0.14, {
        parts: ['sonde_o2_amont'],
      }),
    ],
    relatedPids: ['o2_b1s1_voltage', 'long_fuel_trim_b1', 'short_fuel_trim_b1'],
    relatedTests: ['test_o2_sensor_activity', 'test_exhaust_leak', 'test_wiring_visual'],
    relatedCodes: ['P0420', 'P0171'],
  }),
  dtc({
    code: 'P0401',
    technical: 'Exhaust gas recirculation (EGR) flow — insufficient detected',
    simpleFr:
      'Le calculateur constate que la vanne de recirculation des gaz d’échappement ne laisse pas passer le débit attendu : elle est probablement encrassée ou bloquée.',
    simpleEn:
      'The ECU detects that the exhaust gas recirculation valve does not flow the expected amount: it is probably clogged or stuck.',
    system: 'depollution',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Cliquetis (cliquetis moteur) et surchauffe locale.', 'À-coups à bas régime.', 'Voyant moteur permanent.'],
    likelyCauses: [
      cause('egr_clogged', 'Vanne EGR et conduits encrassés (suie)', 'Clogged EGR valve and passages (soot)', 0.46, {
        parts: ['vanne_egr'],
        confirmedBy: 'test_egr_operation',
      }),
      cause('egr_valve_faulty', 'Vanne EGR défaillante (moteur de commande)', 'Faulty EGR valve actuator', 0.22, { parts: ['vanne_egr'] }),
      cause('egr_wiring', 'Câblage ou connecteur de la vanne EGR', 'EGR valve wiring or connector', 0.12, {}),
      cause('dpf_partially_clogged', 'Filtre à particules partiellement colmaté', 'Partially clogged particulate filter', 0.1, {
        explainsCodes: ['P0401', 'P2463', 'P2002'],
      }),
      cause('map_sensor_faulty', 'Capteur MAP/MAF faussant le calcul de débit', 'MAP/MAF sensor corrupting the flow calculation', 0.1, {
        confirmedBy: 'test_map_reading',
      }),
    ],
    relatedPids: ['egr_command', 'map_pressure', 'maf_air_flow', 'engine_load'],
    relatedTests: ['test_egr_operation', 'test_maf_reading', 'test_dpf_soot_load'],
    relatedCodes: ['P0402', 'P2463', 'P2002'],
    frequentOn: ['diesel, usage urbain et embouteillages, carburant de qualité variable'],
  }),
  dtc({
    code: 'P2002',
    technical: 'Particulate filter efficiency below threshold (Bank 1)',
    simpleFr: 'Le filtre à particules laisse passer davantage de suie que ce qui est attendu. Le filtre est probablement usé ou fissuré.',
    simpleEn: 'The particulate filter passes more soot than expected. The filter is probably worn or cracked.',
    system: 'depollution',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Refus au contrôle technique.', 'Régénérations plus fréquentes.'],
    likelyCauses: [
      cause('dpf_cracked', 'Filtre à particules fissuré ou percé', 'Cracked or punctured DPF', 0.4, { parts: ['filtre_particules'] }),
      cause('dpf_sensor_faulty', 'Capteur de pression différentielle défaillant', 'Faulty differential pressure sensor', 0.3, {
        parts: ['capteur_pression_differentielle'],
        confirmedBy: 'test_dpf_pressure_sensor',
      }),
      cause('dpf_hoses', 'Durites de capteur bouchées ou percées', 'Blocked or split sensor hoses', 0.18, {}),
      cause('egr_excess_soot', 'Excès de suie dû à l’EGR ou à l’injection', 'Excess soot from EGR or injection', 0.12, {
        explainsCodes: ['P2002', 'P0401', 'P2463'],
      }),
    ],
    relatedPids: ['dpf_pressure_delta', 'egr_command', 'engine_load'],
    relatedTests: ['test_dpf_soot_load', 'test_dpf_pressure_sensor', 'test_egr_operation'],
    relatedCodes: ['P2463', 'P0401'],
    frequentOn: ['diesel'],
  }),
  dtc({
    code: 'P2463',
    technical: 'Particulate filter — soot accumulation (Bank 1)',
    simpleFr:
      'Le filtre à particules est très chargé en suie. Le véhicule n’a probablement pas pu réaliser ses cycles de régénération (trajets courts, embouteillages, ville).',
    simpleEn:
      'The particulate filter is heavily loaded with soot. The vehicle has probably not been able to complete its regeneration cycles (short trips, traffic, city).',
    system: 'depollution',
    severity: 'important',
    canDriveDefault: 'limited',
    consequences: [
      'Mode dégradé et perte de puissance.',
      'Risque de colmatage définitif du filtre.',
      'Une régénération forcée en atelier peut être nécessaire.',
    ],
    likelyCauses: [
      cause('dpf_soot_short_trips', 'Usage urbain / trajets courts empêchant la régénération', 'Urban use / short trips preventing regeneration', 0.42, {
        confirmedBy: 'test_driving_profile_review',
      }),
      cause('egr_clogged', 'EGR encrassée augmentant la production de suie', 'Clogged EGR increasing soot production', 0.22, {
        explainsCodes: ['P2463', 'P0401'],
        confirmedBy: 'test_egr_operation',
      }),
      cause('injectors_worn', 'Injecteurs encrassés (injection excessive)', 'Clogged injectors (excess fuelling)', 0.16, {
        confirmedBy: 'test_injector_balance',
      }),
      cause('air_filter_clogged', 'Filtre à air colmaté', 'Clogged air filter', 0.1, { parts: ['filtre_air'] }),
      cause('dpf_additive_low', 'Additif FAP/AdBlue insuffisant (selon système)', 'Low DPF/AdBlue additive (depending on system)', 0.1, {}),
    ],
    relatedPids: ['dpf_pressure_delta', 'egr_command', 'engine_load', 'coolant_temp'],
    relatedTests: ['test_dpf_soot_load', 'test_driving_profile_review', 'test_egr_operation'],
    relatedCodes: ['P2002', 'P0401'],
    frequentOn: ['diesel urbain, Sénégal / Afrique de l’Ouest — usage stop-and-go'],
  }),
  dtc({
    code: 'P0442',
    technical: 'Evaporative emission system — small leak detected',
    simpleFr:
      'Une petite fuite est détectée dans le circuit de récupération des vapeurs de carburant. Cela n’affecte généralement pas la conduite.',
    simpleEn: 'A small leak is detected in the fuel vapour recovery system. This generally does not affect driving.',
    system: 'depollution',
    severity: 'normal',
    canDriveDefault: 'yes',
    consequences: ['Voyant moteur allumé.', 'Problème de contrôle technique pollution.', 'Odeur de carburant possible.'],
    likelyCauses: [
      cause('fuel_cap_seal', 'Bouchon de réservoir mal fermé ou joint usé', 'Loose or worn fuel cap seal', 0.52, {
        parts: ['bouchon_reservoir'],
        confirmedBy: 'test_fuel_cap',
      }),
      cause('evap_hose_cracked', 'Durite de canister fendue', 'Cracked canister hose', 0.2, { parts: ['durite_canister'] }),
      cause('purge_valve_faulty', 'Électrovanne de purge défaillante', 'Faulty purge solenoid', 0.16, { parts: ['electrovanne_purge'] }),
      cause('charcoal_canister', 'Canister endommagé', 'Damaged charcoal canister', 0.12, { parts: ['canister'] }),
    ],
    relatedPids: ['long_fuel_trim_b1', 'fuel_level'],
    relatedTests: ['test_fuel_cap', 'test_wiring_visual'],
    relatedCodes: ['P0455', 'P0456'],
  }),
  dtc({
    code: 'P0455',
    technical: 'Evaporative emission system — large leak detected',
    simpleFr: 'Une fuite importante est détectée dans le circuit de récupération des vapeurs de carburant (ou bouchon ouvert).',
    simpleEn: 'A large leak is detected in the fuel vapour recovery system (or the cap is open).',
    system: 'depollution',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['Émissions non conformes.', 'Odeur de carburant.', 'Voyant moteur permanent.'],
    likelyCauses: [
      cause('fuel_cap_missing', 'Bouchon absent, mal fermé ou joint détérioré', 'Cap missing, loose or damaged seal', 0.58, {
        parts: ['bouchon_reservoir'],
        confirmedBy: 'test_fuel_cap',
      }),
      cause('evap_hose_disconnected', 'Durite débranchée ou percée', 'Disconnected or punctured hose', 0.24, {}),
      cause('fuel_tank_seal', 'Joint de jauge ou de réservoir', 'Fuel gauge or tank seal', 0.18, {}),
    ],
    relatedPids: ['fuel_level'],
    relatedTests: ['test_fuel_cap', 'test_wiring_visual'],
    relatedCodes: ['P0442'],
  }),
];

/* ───────────────────────── Batterie / charge / réseau ───────────────────── */

export const ELECTRICAL_DTCS: DtcKnowledge[] = [
  dtc({
    code: 'P0562',
    technical: 'System voltage — low',
    simpleFr:
      'La tension du réseau électrique du véhicule est trop basse. L’origine peut être la batterie, l’alternateur, la courroie d’accessoires ou les connexions.',
    simpleEn:
      'Vehicle system voltage is too low. The cause may be the battery, the alternator, the accessory belt or the connections.',
    system: 'electrique',
    severity: 'important',
    canDriveDefault: 'with_caution',
    consequences: [
      'Démarrages difficiles puis impossibles.',
      'Défaillances électroniques en cascade (capteurs, calculateurs).',
      'Risque d’arrêt moteur en circulation sur les véhicules récents.',
    ],
    likelyCauses: [
      cause('battery_worn', 'Batterie en fin de vie', 'Battery at end of life', 0.36, {
        parts: ['batterie'],
        confirmedBy: 'test_battery_rest_voltage',
      }),
      cause('alternator_weak', 'Alternateur faible ou défaillant', 'Weak or failed alternator', 0.26, {
        parts: ['alternateur'],
        confirmedBy: 'test_charging_voltage',
      }),
      cause('belt_tension', 'Courroie d’accessoires détendue ou usée', 'Loose or worn accessory belt', 0.14, {
        parts: ['courroie_accessoires'],
      }),
      cause('battery_terminals', 'Bornes et cosses oxydées ou desserrées', 'Corroded or loose battery terminals', 0.12, {}),
      cause('parasitic_drain', 'Consommateur parasite (décharge à l’arrêt)', 'Parasitic drain (discharge when parked)', 0.08, {
        confirmedBy: 'test_parasitic_drain',
      }),
      cause('ground_strap', 'Masse moteur ou châssis défectueuse', 'Faulty engine or chassis ground', 0.04, {}),
    ],
    relatedPids: ['battery_voltage', 'engine_rpm', 'coolant_temp'],
    relatedTests: ['test_battery_rest_voltage', 'test_charging_voltage', 'test_parasitic_drain', 'test_wiring_visual'],
    relatedCodes: ['P0563', 'P0335'],
    frequentOn: ['climat chaud, poussière, trajets courts répétés'],
  }),
  dtc({
    code: 'P0563',
    technical: 'System voltage — high',
    simpleFr: 'La tension du réseau est trop élevée, ce qui suggère un problème de régulation de l’alternateur.',
    simpleEn: 'System voltage is too high, suggesting an alternator regulation problem.',
    system: 'electrique',
    severity: 'important',
    canDriveDefault: 'limited',
    consequences: ['Surcharge de la batterie.', 'Détérioration des ampoules et des calculateurs.'],
    likelyCauses: [
      cause('alternator_regulator', 'Régulateur d’alternateur défaillant', 'Faulty alternator regulator', 0.5, {
        parts: ['alternateur'],
        confirmedBy: 'test_charging_voltage',
      }),
      cause('alternator_wiring', 'Câblage de régulation', 'Regulation wiring', 0.3, {}),
      cause('battery_faulty', 'Batterie défaillante (ne lisse plus la tension)', 'Failed battery (no longer smoothing voltage)', 0.2, {
        parts: ['batterie'],
      }),
    ],
    relatedPids: ['battery_voltage', 'engine_rpm'],
    relatedTests: ['test_charging_voltage', 'test_battery_rest_voltage'],
    relatedCodes: ['P0562'],
  }),
  dtc({
    code: 'P0335',
    technical: 'Crankshaft position sensor A circuit malfunction',
    simpleFr:
      'Le calculateur ne reçoit plus correctement l’information de position du vilebrequin. Sans cette information, il ne peut pas gérer l’allumage ni l’injection : le moteur peut caler ou ne pas démarrer.',
    simpleEn:
      'The ECU no longer receives a correct crankshaft position signal. Without it, ignition and injection cannot be managed: the engine may stall or fail to start.',
    system: 'allumage',
    severity: 'critical',
    canDriveDefault: 'no',
    consequences: [
      'Moteur qui cale sans prévenir, éventuellement en circulation.',
      'Démarrage impossible.',
      'Un calage en circulation présente un risque immédiat.',
    ],
    likelyCauses: [
      cause('crank_sensor_faulty', 'Capteur de position vilebrequin défaillant', 'Faulty crankshaft position sensor', 0.46, {
        parts: ['capteur_vilebrequin'],
        confirmedBy: 'test_crank_sensor_signal',
      }),
      cause('crank_sensor_wiring', 'Câblage ou connecteur du capteur', 'Sensor wiring or connector', 0.24, { confirmedBy: 'test_wiring_visual' }),
      cause('crank_target_ring', 'Couronne dentée abîmée ou encrassée', 'Damaged or dirty reluctor ring', 0.14, {}),
      cause('voltage_instability', 'Tension d’alimentation instable (batterie/alternateur)', 'Unstable supply voltage (battery/alternator)', 0.1, {
        explainsCodes: ['P0335', 'P0562'],
        confirmedBy: 'test_battery_rest_voltage',
      }),
      cause('ecm_issue', 'Défaut interne du calculateur', 'Internal ECU fault', 0.06, {}),
    ],
    relatedPids: ['engine_rpm', 'battery_voltage', 'coolant_temp'],
    relatedTests: ['test_crank_sensor_signal', 'test_battery_rest_voltage', 'test_wiring_visual'],
    relatedCodes: ['P0340', 'P0562'],
  }),
  dtc({
    code: 'P0340',
    technical: 'Camshaft position sensor A circuit malfunction (Bank 1)',
    simpleFr:
      'Le calculateur ne reçoit plus correctement l’information de position de l’arbre à cames, ce qui perturbe la synchronisation de l’injection et de l’allumage.',
    simpleEn:
      'The ECU no longer receives a correct camshaft position signal, disturbing injection and ignition synchronisation.',
    system: 'allumage',
    severity: 'important',
    canDriveDefault: 'limited',
    consequences: ['Démarrages difficiles.', 'Perte de puissance.', 'Mode dégradé.'],
    likelyCauses: [
      cause('cam_sensor_faulty', 'Capteur d’arbre à cames défaillant', 'Faulty camshaft position sensor', 0.42, {
        parts: ['capteur_arbre_a_cames'],
        confirmedBy: 'test_cam_sensor_signal',
      }),
      cause('cam_sensor_wiring', 'Câblage ou connecteur', 'Wiring or connector', 0.24, { confirmedBy: 'test_wiring_visual' }),
      cause('timing_stretched', 'Chaîne ou courroie de distribution détendue / décalée', 'Stretched or jumped timing chain or belt', 0.2, {
        explainsCodes: ['P0340', 'P0016'],
        confirmedBy: 'test_timing_alignment',
      }),
      cause('oil_sludge', 'Dépôts d’huile sur le déphaseur (moteurs à calage variable)', 'Oil deposits on the phaser (variable timing engines)', 0.14, {
        parts: ['huile_moteur', 'filtre_huile'],
      }),
    ],
    relatedPids: ['engine_rpm', 'coolant_temp', 'oil_temp'],
    relatedTests: ['test_cam_sensor_signal', 'test_timing_alignment', 'test_wiring_visual'],
    relatedCodes: ['P0016', 'P0335'],
  }),
  dtc({
    code: 'P0016',
    technical: 'Crankshaft/camshaft position correlation (Bank 1, Sensor A)',
    simpleFr:
      'La position de l’arbre à cames ne correspond plus à celle du vilebrequin : la distribution est probablement décalée.',
    simpleEn:
      'Camshaft position no longer matches crankshaft position: valve timing is probably shifted.',
    system: 'moteur',
    severity: 'important',
    canDriveDefault: 'limited',
    consequences: [
      'Perte de puissance et à-coups.',
      'Risque de contact soupape/piston sur moteur à distribution critique.',
      'Dégradation rapide si la distribution est détendue.',
    ],
    likelyCauses: [
      cause('timing_stretched', 'Chaîne ou courroie de distribution détendue ou sautée d’une dent', 'Stretched or jumped timing chain or belt', 0.44, {
        parts: ['kit_distribution'],
        confirmedBy: 'test_timing_alignment',
      }),
      cause('vvt_solenoid', 'Électrovanne de calage variable encrassée', 'Clogged variable valve timing solenoid', 0.24, {
        parts: ['electrovanne_calage'],
      }),
      cause('cam_sensor_faulty', 'Capteur d’arbre à cames faussé', 'Faulty camshaft sensor', 0.16, { parts: ['capteur_arbre_a_cames'] }),
      cause('oil_pressure_low', 'Pression d’huile insuffisante', 'Insufficient oil pressure', 0.1, {
        explainsCodes: ['P0016'],
        confirmedBy: 'test_oil_pressure',
      }),
      cause('phaser_worn', 'Déphaseur usé', 'Worn phaser', 0.06, { parts: ['dephaseur'] }),
    ],
    relatedPids: ['engine_rpm', 'oil_temp', 'coolant_temp', 'timing_advance'],
    relatedTests: ['test_timing_alignment', 'test_oil_pressure', 'test_cam_sensor_signal'],
    relatedCodes: ['P0340', 'P0011'],
  }),
  dtc({
    code: 'P0351',
    technical: 'Ignition coil A primary/secondary circuit malfunction',
    simpleFr: 'Le circuit de la bobine d’allumage A est défaillant : le ou les cylindres concernés ne reçoivent plus d’étincelle fiable.',
    simpleEn: 'Ignition coil A circuit is faulty: the affected cylinder(s) no longer receive a reliable spark.',
    system: 'allumage',
    severity: 'important',
    canDriveDefault: 'limited',
    consequences: ['Ratés d’allumage.', 'Catalyseur exposé au carburant non brûlé.', 'Perte de puissance.'],
    likelyCauses: [
      cause('ignition_coil_1', 'Bobine d’allumage défaillante', 'Failed ignition coil', 0.5, {
        parts: ['bobine_allumage'],
        confirmedBy: 'test_ignition_spark_check',
      }),
      cause('coil_wiring', 'Câblage ou connecteur de bobine', 'Coil wiring or connector', 0.24, { confirmedBy: 'test_wiring_visual' }),
      cause('spark_plug_worn', 'Bougies très usées surchargeant la bobine', 'Worn spark plugs overloading the coil', 0.16, { parts: ['bougie_allumage'] }),
      cause('ecm_driver', 'Étage de commande du calculateur', 'ECU driver stage', 0.1, {}),
    ],
    relatedPids: ['engine_rpm', 'misfire_count', 'engine_load'],
    relatedTests: ['test_ignition_spark_check', 'test_wiring_visual'],
    relatedCodes: ['P0300', 'P0301'],
  }),
];

/* ─────────────────────────── Réseau / sécurité / transmission ───────────── */

export const NETWORK_DTCS: DtcKnowledge[] = [
  dtc({
    code: 'U0100',
    technical: 'Lost communication with ECM/PCM "A"',
    simpleFr:
      'Le calculateur moteur a cessé de communiquer sur le réseau du véhicule. Cela peut provoquer un mode dégradé sévère.',
    simpleEn: 'The engine control module stopped communicating on the vehicle network. This can cause a severe limp mode.',
    system: 'reseau',
    severity: 'important',
    canDriveDefault: 'limited',
    consequences: ['Mode dégradé.', 'Instruments incohérents.', 'Démarrage impossible selon les cas.'],
    likelyCauses: [
      cause('can_wiring', 'Câblage CAN ouvert ou en court-circuit', 'Open or shorted CAN wiring', 0.36, {}),
      cause('connector_oxidation', 'Connecteur oxydé (humidité, poussière)', 'Corroded connector (moisture, dust)', 0.3, { confirmedBy: 'test_wiring_visual' }),
      cause('ground_fault', 'Masse défectueuse', 'Faulty ground', 0.2, {}),
      cause('module_fault', 'Calculateur défaillant', 'Failed control module', 0.14, {}),
    ],
    relatedPids: ['battery_voltage'],
    relatedTests: ['test_wiring_visual', 'test_battery_rest_voltage'],
    relatedCodes: ['U0121', 'P0562'],
  }),
  dtc({
    code: 'U0121',
    technical: 'Lost communication with ABS control module',
    simpleFr:
      'XAMOTO ne reçoit plus d’information du calculateur ABS. Les fonctions d’antiblocage et parfois de répartition de freinage sont dégradées.',
    simpleEn:
      'XAMOTO no longer receives information from the ABS control module. Anti-lock and sometimes brake distribution functions are degraded.',
    system: 'freinage',
    severity: 'important',
    canDriveDefault: 'with_caution',
    consequences: [
      'Perte de l’antiblocage : freinage d’urgence dégradé.',
      'Voyants ABS et parfois frein allumés.',
      'Le freinage classique reste généralement disponible, mais l’assistance électronique non.',
    ],
    likelyCauses: [
      cause('can_wiring', 'Câblage CAN du calculateur ABS', 'ABS module CAN wiring', 0.34, {}),
      cause('abs_module_fault', 'Calculateur ABS défaillant', 'Failed ABS module', 0.28, {}),
      cause('abs_fuse', 'Fusible d’alimentation ABS', 'ABS power fuse', 0.2, { parts: ['fusible'] }),
      cause('connector_oxidation', 'Connecteur oxydé', 'Corroded connector', 0.18, { confirmedBy: 'test_wiring_visual' }),
    ],
    relatedPids: ['battery_voltage'],
    relatedTests: ['test_wiring_visual', 'test_brake_visual'],
    relatedCodes: ['U0100', 'C0035'],
  }),
  dtc({
    code: 'C0035',
    technical: 'Left front wheel speed sensor circuit',
    simpleFr:
      'Le signal du capteur de vitesse de roue avant gauche est absent ou incohérent. L’ABS et l’antipatinage peuvent être désactivés.',
    simpleEn:
      'Left front wheel speed signal is missing or inconsistent. ABS and traction control may be disabled.',
    system: 'freinage',
    severity: 'important',
    canDriveDefault: 'with_caution',
    consequences: ['ABS indisponible.', 'Voyant ABS allumé.', 'Compteur ou antipatinage affectés.'],
    likelyCauses: [
      cause('wheel_sensor_faulty', 'Capteur de roue défaillant', 'Faulty wheel speed sensor', 0.42, {
        parts: ['capteur_abs'],
        confirmedBy: 'test_wheel_sensor_signal',
      }),
      cause('sensor_ring_dirty', 'Couronne ou bague magnétique encrassée / abîmée', 'Dirty or damaged reluctor ring', 0.26, {}),
      cause('wheel_sensor_wiring', 'Câblage du capteur (souvent près de la roue)', 'Sensor wiring (often near the wheel)', 0.2, {}),
      cause('wheel_bearing_play', 'Jeu dans le roulement de roue', 'Wheel bearing play', 0.12, { parts: ['roulement_roue'] }),
    ],
    relatedPids: ['vehicle_speed', 'battery_voltage'],
    relatedTests: ['test_wheel_sensor_signal', 'test_brake_visual'],
    relatedCodes: ['U0121'],
  }),
  dtc({
    code: 'P0700',
    technical: 'Transmission control system (MIL request)',
    simpleFr:
      'Le calculateur de boîte de vitesses a détecté un défaut et demande l’allumage du voyant moteur. Le détail se trouve dans le calculateur de boîte.',
    simpleEn:
      'The transmission control module detected a fault and requested the check-engine light. Details are stored in the transmission module.',
    system: 'transmission',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: [
      'Passages de rapports dégradés ou mode secours.',
      'Usure accélérée si le défaut est ignoré.',
      'XAMOTO a besoin des codes de la boîte (souvent hors OBD standard) pour aller plus loin.',
    ],
    likelyCauses: [
      cause('transmission_fluid', 'Huile de boîte dégradée ou niveau incorrect', 'Degraded transmission fluid or incorrect level', 0.34, {
        parts: ['huile_boite'],
      }),
      cause('solenoid_faulty', 'Électrovanne de boîte défaillante', 'Faulty transmission solenoid', 0.26, {}),
      cause('sensor_faulty', 'Capteur de boîte (vitesse, température)', 'Transmission sensor (speed, temperature)', 0.2, {}),
      cause('transmission_wiring', 'Câblage / connecteur de boîte', 'Transmission wiring / connector', 0.2, { confirmedBy: 'test_wiring_visual' }),
    ],
    relatedPids: ['vehicle_speed', 'coolant_temp', 'battery_voltage'],
    relatedTests: ['test_transmission_fluid', 'test_wiring_visual'],
    relatedCodes: ['P0715'],
  }),
  dtc({
    code: 'P0715',
    technical: 'Input/turbine speed sensor A circuit malfunction',
    simpleFr:
      'Le capteur de vitesse d’entrée de boîte ne renvoie pas un signal correct. La boîte peut passer les rapports de façon erratique.',
    simpleEn:
      'The transmission input speed sensor does not return a correct signal. Gear changes may become erratic.',
    system: 'transmission',
    severity: 'attention',
    canDriveDefault: 'with_caution',
    consequences: ['À-coups de transmission.', 'Mode secours.', 'Surconsommation.'],
    likelyCauses: [
      cause('sensor_faulty', 'Capteur de vitesse d’entrée défaillant', 'Faulty input speed sensor', 0.42, { parts: ['capteur_boite'] }),
      cause('transmission_wiring', 'Câblage du capteur', 'Sensor wiring', 0.26, {}),
      cause('transmission_fluid', 'Huile de boîte dégradée', 'Degraded transmission fluid', 0.2, { parts: ['huile_boite'] }),
      cause('internal_wear', 'Usure interne (embrayages, convertisseur)', 'Internal wear (clutches, converter)', 0.12, {}),
    ],
    relatedPids: ['vehicle_speed', 'engine_rpm'],
    relatedTests: ['test_transmission_fluid', 'test_wiring_visual'],
    relatedCodes: ['P0700'],
  }),
  dtc({
    code: 'P0606',
    technical: 'ECM/PCM processor fault',
    simpleFr: 'Le calculateur signale une anomalie interne. Ce n’est pas une pièce mécanique : l’information doit être vérifiée avant toute intervention.',
    simpleEn: 'The control module reports an internal fault. This is not a mechanical part: the information must be verified before any intervention.',
    system: 'electrique',
    severity: 'important',
    canDriveDefault: 'limited',
    consequences: ['Comportement erratique.', 'Mode dégradé.', 'Un défaut de tension ou de masse produit souvent le même code.'],
    likelyCauses: [
      cause('voltage_instability', 'Alimentation instable (tension, masse) simulant un défaut calculateur', 'Unstable supply (voltage, ground) simulating an ECU fault', 0.42, {
        confirmedBy: 'test_charging_voltage',
      }),
      cause('ecm_software', 'Version logicielle du calculateur à mettre à jour', 'ECU software requiring an update', 0.24, {}),
      cause('ecm_fault', 'Calculateur réellement défaillant', 'Genuinely failed control module', 0.2, {}),
      cause('connector_oxidation', 'Connecteur calculateur oxydé', 'Corroded ECU connector', 0.14, { confirmedBy: 'test_wiring_visual' }),
    ],
    relatedPids: ['battery_voltage', 'coolant_temp'],
    relatedTests: ['test_charging_voltage', 'test_battery_rest_voltage', 'test_wiring_visual'],
    relatedCodes: ['P0562', 'U0100'],
  }),
];

export const ALL_DTC_KNOWLEDGE: DtcKnowledge[] = [
  ...ENGINE_DTCS,
  ...INTAKE_DTCS,
  ...COOLING_DTCS,
  ...EMISSION_DTCS,
  ...ELECTRICAL_DTCS,
  ...NETWORK_DTCS,
];

/** Origine déclarée pour les définitions issues de la nomenclature SAE. */
export const ENGINE_SOURCE_ID = ENGINE_SOURCE;

export function findDtcKnowledge(code: string): DtcKnowledge | undefined {
  const normalized = code.trim().toUpperCase();
  return ALL_DTC_KNOWLEDGE.find((d) => d.code === normalized);
}

/**
 * Détecte la famille d'un code inconnu de la base, sans inventer de contenu :
 * on explique la nomenclature, jamais la panne (§16).
 */
export function describeUnknownDtc(code: string): { familyFr: string; familyEn: string; system: DtcSystem } | null {
  const m = /^([PCBU])([0-3])/.exec(code.trim().toUpperCase());
  if (!m) return null;
  const letter = m[1] as string;
  const generic = m[2] === '0';
  const map: Record<string, { fr: string; en: string; system: DtcSystem }> = {
    P: { fr: 'groupe motopropulseur (moteur, injection, allumage, dépollution, transmission)', en: 'powertrain (engine, injection, ignition, emission, transmission)', system: 'moteur' },
    C: { fr: 'châssis (freinage, ABS, direction, suspension)', en: 'chassis (braking, ABS, steering, suspension)', system: 'freinage' },
    B: { fr: 'carrosserie (airbags, vitres, éclairage, confort)', en: 'body (airbags, windows, lighting, comfort)', system: 'carrosserie' },
    U: { fr: 'réseau de communication entre calculateurs', en: 'communication network between control modules', system: 'reseau' },
  };
  const info = map[letter];
  if (!info) return null;
  return {
    familyFr: `${info.fr}. ${generic ? 'Code générique normalisé, identique chez tous les constructeurs.' : 'Code spécifique au constructeur : sa signification exacte dépend de la marque.'}`,
    familyEn: `${info.en}. ${generic ? 'Generic standardized code, identical across manufacturers.' : 'Manufacturer-specific code: exact meaning depends on the brand.'}`,
    system: info.system,
  };
}

export type { DataOrigin };
