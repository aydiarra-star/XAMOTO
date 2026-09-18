/**
 * XAMOTO — Ce que la lecture OBD permet réellement, système par système (§15, §33).
 *
 * Le cahier des charges impose de distinguer systématiquement une donnée
 * DISPONIBLE d'une donnée INDISPONIBLE (§8). Cette table est la réponse, écrite
 * une fois pour toutes, par système :
 *
 *   • ce que la lecture embarquée donne réellement ;
 *   • ce que XAMOTO ne peut PAS en déduire, même avec un scan complet ;
 *   • les tests qui restent utiles sans équipement professionnel ;
 *   • la source de cette affirmation.
 *
 * Règle : aucune ligne de cette table ne décrit une valeur constructeur. Elle
 * décrit des MOYENS D'ACCÈS. Un système « non accessible » n'est pas un système
 * « sain » : cela veut dire que XAMOTO ne peut pas le contrôler par ce moyen, et
 * il le dira dans le diagnostic.
 */
import type { DtcSystem } from '@xamoto/shared';

export type ObdReadability =
  /** Codes défaut ET mesures disponibles par l'OBD standard. */
  | 'codes_and_data'
  /** Codes défaut disponibles, mesures partielles ou absentes. */
  | 'codes_only'
  /** Accessible seulement sur certains véhicules ou certaines interfaces. */
  | 'limited'
  /** Hors de portée de l'OBD standard : protocole constructeur ou mesure physique. */
  | 'not_accessible';

export interface SystemCoverage {
  system: DtcSystem;
  readability: ObdReadability;
  whatObdGivesFr: string;
  whatObdGivesEn: string;
  limitsFr: string;
  limitsEn: string;
  /** Tests guidés utiles sur ce système (sans équipement constructeur). */
  tests: string[];
  sourceId: string;
}

const SAE_J1979 = 'src_sae_j1979';
const SAE_J2012 = 'src_sae_j2012';
const UDS = 'src_iso_14229';
const PRACTICE = 'src_xamoto_practice';
const METHODS = 'src_workshop_methods';
const AFRICA = 'src_african_context';

const NOT_READABLE_NOTICE_FR =
  'Un système non accessible par l’OBD n’est pas un système en bon état : c’est un système que XAMOTO ne peut pas contrôler par ce moyen.';
const NOT_READABLE_NOTICE_EN =
  'A system that OBD cannot reach is not a healthy system: it is a system XAMOTO cannot check by this means.';

export const SYSTEM_COVERAGE: SystemCoverage[] = [
  {
    system: 'moteur',
    readability: 'codes_and_data',
    whatObdGivesFr:
      'Régime, charge calculée, température de liquide de refroidissement, température d’admission, débit d’air, pression de collecteur, position de papillon, tension du réseau.',
    whatObdGivesEn:
      'Engine speed, calculated load, coolant temperature, intake air temperature, air flow, manifold pressure, throttle position, system voltage.',
    limitsFr:
      'La pression d’huile n’est mesurée par aucun PID standard : sur la plupart des véhicules, le voyant d’huile correspond à un contact tout-ou-rien, pas à une mesure. Aucun PID ne dit si un joint de culasse fuit, si la compression est bonne ou si un bruit mécanique est anormal.',
    limitsEn:
      'Oil pressure is not measured by any standard PID: on most vehicles the oil light is a switch, not a measurement. No PID tells whether a head gasket leaks, whether compression is good or whether a mechanical noise is abnormal.',
    tests: ['test_engine_baseline_scan', 'test_oil_pressure', 'test_compression', 'test_combustion_gases_coolant'],
    sourceId: SAE_J1979,
  },
  {
    system: 'allumage',
    readability: 'codes_and_data',
    whatObdGivesFr:
      'Compteur de ratés par cylindre ou par groupe, régime, corrections de carburant, et l’état du voyant (allumé, clignotant).',
    whatObdGivesEn:
      'Misfire counter per cylinder or group, engine speed, fuel trims, and warning light status (steady, flashing).',
    limitsFr:
      'XAMOTO ne voit ni l’étincelle, ni la résistance d’une bobine, ni l’état d’une bougie. Un raté d’allumage peut venir d’un injecteur, d’une soupape ou d’une prise d’air : le compteur de ratés localise le cylindre, jamais la pièce.',
    limitsEn:
      'XAMOTO cannot see the spark, a coil resistance or a spark plug condition. A misfire may come from an injector, a valve or an air leak: the misfire counter locates the cylinder, never the part.',
    tests: ['test_ignition_spark_check', 'test_injector_balance', 'test_compression'],
    sourceId: SAE_J1979,
  },
  {
    system: 'injection',
    readability: 'codes_and_data',
    whatObdGivesFr:
      'Corrections de carburant courtes et longues, pression de rampe sur les véhicules qui l’exposent, temps d’injection sur certains moteurs.',
    whatObdGivesEn:
      'Short and long fuel trims, rail pressure on vehicles exposing it, injection timing on some engines.',
    limitsFr:
      'Le débit réel d’un injecteur n’est pas mesurable par l’OBD : une correction de carburant élevée signale un déséquilibre, pas l’injecteur fautif. Le test des injecteurs se fait par comparaison (équilibrage, retour de fuite).',
    limitsEn:
      'Actual injector flow cannot be measured through OBD: a high fuel trim indicates an imbalance, not the faulty injector. Injectors are tested by comparison (balance, return flow).',
    tests: ['test_injector_balance', 'test_fuel_pressure', 'test_fuel_quality'],
    sourceId: SAE_J1979,
  },
  {
    system: 'carburant',
    readability: 'codes_and_data',
    whatObdGivesFr:
      'Pression de carburant (si exposée), niveau de réservoir, corrections de carburant, et les codes de circuit liés à la pompe ou au régulateur.',
    whatObdGivesEn:
      'Fuel pressure (when exposed), fuel level, fuel trims, and circuit codes related to the pump or regulator.',
    limitsFr:
      'Le niveau de réservoir est souvent approximatif et peut être faussé par la pente ou un capteur usé. La qualité du carburant (eau, impuretés) n’est jamais mesurée par le calculateur : elle se contrôle physiquement.',
    limitsEn:
      'Fuel level is often approximate and can be skewed by slope or a worn sensor. Fuel quality (water, impurities) is never measured by the ECU: it is checked physically.',
    tests: ['test_fuel_pressure', 'test_fuel_quality', 'test_fuel_cap'],
    sourceId: SAE_J1979,
  },
  {
    system: 'admission',
    readability: 'codes_and_data',
    whatObdGivesFr:
      'Débit d’air, pression de collecteur, température d’admission, position et commande du papillon, pression de suralimentation sur les moteurs équipés.',
    whatObdGivesEn:
      'Air flow, manifold pressure, intake temperature, throttle position and command, boost pressure on turbocharged engines.',
    limitsFr:
      'Une prise d’air n’est pas mesurée : elle est déduite d’une incohérence entre le débit, la pression et les corrections de carburant. Un encrassement de collecteur ou de soupapes ne produit aucun PID.',
    limitsEn:
      'An air leak is not measured: it is inferred from an inconsistency between flow, pressure and fuel trims. Intake or valve deposits produce no PID.',
    tests: ['test_vacuum_leak', 'test_maf_reading', 'test_map_reading', 'test_boost_leak', 'test_boost_control'],
    sourceId: SAE_J1979,
  },
  {
    system: 'echappement',
    readability: 'codes_and_data',
    whatObdGivesFr:
      'Tensions des sondes O2 amont et aval, et l’état des moniteurs d’échappement dans les tests de disponibilité.',
    whatObdGivesEn:
      'Upstream and downstream O2 sensor voltages, and exhaust monitor readiness states.',
    limitsFr:
      'Aucun PID ne mesure une fuite d’échappement, une contre-pression ni la température réelle du catalyseur. Une fuite avant la sonde aval produit exactement le même code qu’un catalyseur usé.',
    limitsEn:
      'No PID measures an exhaust leak, back pressure or actual catalyst temperature. A leak upstream of the downstream sensor produces exactly the same code as a worn catalyst.',
    tests: ['test_exhaust_leak', 'test_o2_sensor_activity', 'test_o2_downstream_activity'],
    sourceId: SAE_J1979,
  },
  {
    system: 'depollution',
    readability: 'codes_and_data',
    whatObdGivesFr:
      'Codes des circuits de dépollution (catalyseur, circuit de vapeurs, EGR) et l’état des moniteurs correspondants.',
    whatObdGivesEn:
      'Emission control circuit codes (catalyst, vapour circuit, EGR) and the readiness state of the matching monitors.',
    limitsFr:
      'La charge de suie d’un filtre à particules et l’encrassement d’une vanne EGR ne font pas partie des PID standard : ils dépendent du constructeur et du véhicule. XAMOTO ne les affichera pas s’ils ne sont pas réellement disponibles.',
    limitsEn:
      'Particulate filter soot load and EGR fouling are not part of the standard PID set: they depend on the manufacturer and the vehicle. XAMOTO will not display them if they are not genuinely available.',
    tests: ['test_dpf_soot_load', 'test_dpf_pressure_sensor', 'test_egr_operation', 'test_o2_downstream_activity'],
    sourceId: SAE_J2012,
  },
  {
    system: 'transmission',
    readability: 'limited',
    whatObdGivesFr:
      'Les codes de groupe motopropulseur liés à la boîte (par exemple un code de demande d’allumage du voyant émis par le calculateur de boîte, ou un code de capteur de vitesse d’entrée).',
    whatObdGivesEn:
      'Powertrain codes related to the transmission (for example a MIL request issued by the transmission module, or an input speed sensor code).',
    limitsFr:
      'Les données réelles de la boîte (pression de ligne, températures, glissement des embrayages, historique de passages) sont dans le calculateur de boîte et ne sortent pas par l’OBD standard. Un code de boîte indique qu’un défaut existe, jamais quelle pièce changer.',
    limitsEn:
      'Actual transmission data (line pressure, temperatures, clutch slip, shift history) lives in the transmission module and is not exposed through standard OBD. A transmission code says a fault exists, never which part to replace.',
    tests: ['test_transmission_fluid', 'test_driving_profile_review'],
    sourceId: UDS,
  },
  {
    system: 'freinage',
    readability: 'limited',
    whatObdGivesFr:
      'Des codes de châssis (famille C) sur les véhicules et les interfaces qui les exposent : capteurs de vitesse de roue, circuits d’alimentation des calculateurs de freinage.',
    whatObdGivesEn:
      'Chassis codes (C family) on vehicles and interfaces that expose them: wheel speed sensors, braking module supply circuits.',
    limitsFr:
      'L’usure des plaquettes, l’état du liquide de frein, une fuite au maître-cylindre ou un disque voilé ne se lisent pas. Un code de capteur de roue n’autorise jamais à remplacer le calculateur ABS : l’ordre de vérification commence par la roue, le câblage et la masse.',
    limitsEn:
      'Pad wear, brake fluid condition, a master cylinder leak or a warped disc cannot be read. A wheel sensor code never justifies replacing the ABS module: the check order starts at the wheel, the wiring and the ground.',
    tests: ['test_brake_visual', 'test_wheel_sensor_signal'],
    sourceId: METHODS,
  },
  {
    system: 'abs',
    readability: 'limited',
    whatObdGivesFr:
      'Les codes déclarés par le calculateur ABS lorsque l’interface y accède, et l’état du voyant ABS au tableau de bord.',
    whatObdGivesEn:
      'Codes reported by the ABS module when the interface reaches it, and the ABS warning light state on the dashboard.',
    limitsFr:
      'Le comportement hydraulique (course de pédale, purge, déclenchement) ne se mesure pas par l’OBD. Après une intervention sur le circuit, certains véhicules exigent une procédure de purge pilotée par le constructeur : XAMOTO le signale au lieu de promettre un résultat.',
    limitsEn:
      'Hydraulic behaviour (pedal travel, bleeding, activation) is not measured through OBD. After work on the circuit, some vehicles require a manufacturer-driven bleed procedure: XAMOTO flags it instead of promising an outcome.',
    tests: ['test_wheel_sensor_signal', 'test_brake_visual'],
    sourceId: METHODS,
  },
  {
    system: 'airbag',
    readability: 'not_accessible',
    whatObdGivesFr: 'Rien par l’OBD standard : les codes de carrosserie (famille B) ne font pas partie des modes OBD-II d’émissions.',
    whatObdGivesEn: 'Nothing through standard OBD: body codes (B family) are not part of the OBD-II emissions modes.',
    limitsFr:
      'Un circuit d’airbag contient des éléments pyrotechniques. Les règles de sécurité sont absolues : ne jamais mesurer un circuit déployeur avec un ohmmètre, respecter le délai de décharge des condensateurs indiqué par le constructeur avant toute intervention, ne pas travailler sous tension. XAMOTO n’accompagne pas ces opérations : elles reviennent à un professionnel équipé.',
    limitsEn:
      'An airbag circuit contains pyrotechnic elements. Safety rules are absolute: never measure a deployer circuit with an ohmmeter, respect the manufacturer capacitor discharge delay before any work, never work on a live circuit. XAMOTO does not guide these operations: they belong to an equipped professional.',
    tests: [],
    sourceId: METHODS,
  },
  {
    system: 'climatisation',
    readability: 'not_accessible',
    whatObdGivesFr:
      'Aucune donnée par l’OBD standard. Sur certains véhicules, une pression de fluide frigorigène est exposée par un PID constructeur — XAMOTO ne l’affiche que si elle est réellement transmise.',
    whatObdGivesEn:
      'No data through standard OBD. On some vehicles a refrigerant pressure is exposed by a manufacturer PID — XAMOTO displays it only when it is genuinely transmitted.',
    limitsFr:
      'La charge de fluide, une fuite, l’embrayage du compresseur et l’encrassement du condenseur se contrôlent physiquement. La manipulation du fluide frigorigène est réservée à un professionnel équipé : XAMOTO décrit la vérification, il ne la remplace pas.',
    limitsEn:
      'Refrigerant charge, a leak, compressor clutch and condenser fouling are checked physically. Handling refrigerant is reserved for an equipped professional: XAMOTO describes the check, it does not replace it.',
    tests: ['test_ac_visual', 'test_ac_pressure_pro'],
    sourceId: AFRICA,
  },
  {
    system: 'electrique',
    readability: 'codes_and_data',
    whatObdGivesFr:
      'Tension du calculateur, codes de tension trop basse ou trop haute, codes de circuit des capteurs et actionneurs surveillés.',
    whatObdGivesEn:
      'Module voltage, low or high voltage codes, circuit codes for monitored sensors and actuators.',
    limitsFr:
      'Aucun PID ne mesure la résistance d’une masse, l’état d’un fusible ou la consommation d’un accessoire. Une chute de tension à la masse moteur provoque souvent les mêmes codes qu’un calculateur défaillant : l’ordre de vérification commence par le câblage, jamais par le boîtier.',
    limitsEn:
      'No PID measures ground resistance, fuse condition or accessory current draw. Engine ground voltage drop often produces the same codes as a faulty module: the check order starts with wiring, never with the box.',
    tests: ['test_battery_rest_voltage', 'test_charging_voltage', 'test_parasitic_drain', 'test_wiring_visual', 'test_fuse_continuity'],
    sourceId: SAE_J1979,
  },
  {
    system: 'reseau',
    readability: 'limited',
    whatObdGivesFr:
      'Des codes de perte de communication (famille U) lorsque les calculateurs les publient : un module qui ne répond plus, un bus perturbé.',
    whatObdGivesEn:
      'Communication loss codes (U family) when modules publish them: a module no longer answering, a disturbed bus.',
    limitsFr:
      'Un oscilloscope (ou un outil constructeur) est nécessaire pour mesurer réellement un bus CAN : niveaux, terminaison, perturbations. XAMOTO s’interdit de conclure « calculateur à remplacer » à partir d’un code U.',
    limitsEn:
      'An oscilloscope (or a manufacturer tool) is required to actually measure a CAN bus: levels, termination, interference. XAMOTO refuses to conclude “replace the module” from a U code.',
    tests: ['test_battery_rest_voltage', 'test_charging_voltage', 'test_wiring_visual'],
    sourceId: METHODS,
  },
  {
    system: 'carrosserie',
    readability: 'not_accessible',
    whatObdGivesFr: 'Rien par l’OBD standard : les codes de carrosserie (famille B) ne sont pas exposés par les modes d’émissions.',
    whatObdGivesEn: 'Nothing through standard OBD: body codes (B family) are not exposed by the emissions modes.',
    limitsFr:
      'Éclairage, vitres, serrures, capteurs de choc et confort relèvent de mesures électriques et physiques. XAMOTO ne les inventera pas : il explique ce qui peut être vérifié sans outil constructeur.',
    limitsEn:
      'Lighting, windows, locks, crash sensors and comfort features require electrical and physical checks. XAMOTO will not invent them: it explains what can be checked without a manufacturer tool.',
    tests: ['test_wiring_visual', 'test_fuse_continuity'],
    sourceId: PRACTICE,
  },
];

export const COVERAGE_BY_SYSTEM = new Map<DtcSystem, SystemCoverage>(SYSTEM_COVERAGE.map((c) => [c.system, c]));

/** Tous les systèmes de la nomenclature, y compris ceux qu'aucun code ne cite. */
export const ALL_SYSTEMS: DtcSystem[] = SYSTEM_COVERAGE.map((c) => c.system);

export function coverageOf(system: DtcSystem): SystemCoverage | null {
  return COVERAGE_BY_SYSTEM.get(system) ?? null;
}

/** Rappel utilisé partout où XAMOTO explique ce qu'il ne peut pas lire. */
export const NOT_READABLE_NOTICE = { fr: NOT_READABLE_NOTICE_FR, en: NOT_READABLE_NOTICE_EN };
