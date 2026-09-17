/**
 * XAMOTO — Symptômes (§17, §12).
 *
 * Un symptôme n'est PAS un diagnostic. Il sert à :
 *  1. orienter les hypothèses (avec le même niveau de prudence qu'un DTC),
 *  2. élever le niveau de sécurité quand le symptôme l'impose,
 *  3. choisir les tests pertinents.
 *
 * Le niveau de sécurité d'un symptôme s'applique même en l'absence de tout DTC :
 * un voyant de pression d'huile allumé est un arrêt immédiat, code défaut ou pas.
 */
import type { SymptomDefinition, SymptomKey } from '@xamoto/shared';

export const SYMPTOM_DEFINITIONS: SymptomDefinition[] = [
  { key: 'no_start', labelFr: 'Le véhicule ne démarre pas', labelEn: 'The vehicle does not start', safety: 'important', systems: ['allumage', 'electrique', 'carburant'] },
  { key: 'hard_start', labelFr: 'Démarrage difficile', labelEn: 'Hard starting', safety: 'attention', systems: ['allumage', 'carburant', 'electrique'] },
  { key: 'rough_idle', labelFr: 'Ralenti instable', labelEn: 'Rough idle', safety: 'attention', systems: ['allumage', 'admission', 'carburant'] },
  { key: 'engine_stall', labelFr: 'Le moteur cale', labelEn: 'Engine stalls', safety: 'critical', systems: ['allumage', 'electrique', 'carburant', 'reseau'] },
  { key: 'loss_of_power', labelFr: 'Perte de puissance', labelEn: 'Loss of power', safety: 'attention', systems: ['admission', 'carburant', 'echappement', 'depollution'] },
  { key: 'hesitation_acceleration', labelFr: 'À-coups à l’accélération', labelEn: 'Hesitation on acceleration', safety: 'attention', systems: ['allumage', 'carburant', 'admission'] },
  { key: 'jerking', labelFr: 'Secousses / soubresauts', labelEn: 'Jerking', safety: 'attention', systems: ['allumage', 'transmission', 'carburant'] },
  { key: 'vibration', labelFr: 'Vibrations anormales', labelEn: 'Abnormal vibration', safety: 'attention', systems: ['allumage', 'transmission', 'moteur'] },
  { key: 'overheating', labelFr: 'Surchauffe moteur', labelEn: 'Engine overheating', safety: 'critical', systems: ['moteur'] },
  { key: 'coolant_loss', labelFr: 'Perte de liquide de refroidissement', labelEn: 'Coolant loss', safety: 'important', systems: ['moteur'] },
  { key: 'oil_light_on', labelFr: 'Voyant de pression d’huile allumé', labelEn: 'Oil pressure light on', safety: 'critical', systems: ['moteur'] },
  { key: 'battery_light_on', labelFr: 'Voyant de batterie allumé', labelEn: 'Battery light on', safety: 'important', systems: ['electrique'] },
  { key: 'brake_noise', labelFr: 'Bruit de freinage', labelEn: 'Braking noise', safety: 'important', systems: ['freinage'] },
  { key: 'brake_soft_pedal', labelFr: 'Pédale de frein molle', labelEn: 'Soft brake pedal', safety: 'critical', systems: ['freinage'] },
  { key: 'metallic_noise', labelFr: 'Bruit métallique', labelEn: 'Metallic noise', safety: 'important', systems: ['moteur', 'transmission'] },
  { key: 'black_smoke', labelFr: 'Fumée noire', labelEn: 'Black smoke', safety: 'attention', systems: ['injection', 'admission', 'depollution'] },
  { key: 'white_smoke', labelFr: 'Fumée blanche', labelEn: 'White smoke', safety: 'important', systems: ['moteur', 'injection'] },
  { key: 'blue_smoke', labelFr: 'Fumée bleue', labelEn: 'Blue smoke', safety: 'important', systems: ['moteur'] },
  { key: 'excessive_fuel_consumption', labelFr: 'Surconsommation de carburant', labelEn: 'Excessive fuel consumption', safety: 'attention', systems: ['carburant', 'depollution', 'moteur'] },
  { key: 'smell_fuel', labelFr: 'Odeur de carburant', labelEn: 'Fuel smell', safety: 'important', systems: ['carburant', 'depollution'] },
  { key: 'smell_burnt', labelFr: 'Odeur de brûlé', labelEn: 'Burning smell', safety: 'important', systems: ['electrique', 'moteur'] },
  { key: 'warning_light_flashing', labelFr: 'Voyant moteur clignotant', labelEn: 'Flashing check-engine light', safety: 'critical', systems: ['allumage', 'depollution'] },
  { key: 'limp_mode', labelFr: 'Mode dégradé (puissance limitée)', labelEn: 'Limp mode (limited power)', safety: 'important', systems: ['moteur', 'transmission', 'admission'] },
  { key: 'ac_not_cold', labelFr: 'Climatisation qui ne refroidit plus', labelEn: 'Air conditioning not cooling', safety: 'normal', systems: ['climatisation'] },
];

export const SYMPTOM_BY_KEY = new Map<SymptomKey, SymptomDefinition>(SYMPTOM_DEFINITIONS.map((s) => [s.key, s]));

/**
 * Orientation d'hypothèse par symptôme, utilisée UNIQUEMENT lorsqu'aucun code
 * défaut n'est disponible ou en complément. Le niveau de certitude d'une
 * hypothèse fondée sur un seul symptôme ne peut jamais dépasser « possible ».
 */
export interface SymptomHypothesisSeed {
  symptom: SymptomKey;
  causeKey: string;
  labelFr: string;
  labelEn: string;
  /** Poids relatif de départ (ordonnancement, aucun caractère conclusif). */
  weight: number;
  parts: string[];
  tests: string[];
}

export const SYMPTOM_HYPOTHESES: SymptomHypothesisSeed[] = [
  { symptom: 'rough_idle', causeKey: 'ignition_coil_1', labelFr: 'Allumage d’un cylindre défaillant', labelEn: 'Faulty ignition on one cylinder', weight: 0.3, parts: ['bobine_allumage', 'bougie_allumage'], tests: ['test_ignition_spark_check'] },
  { symptom: 'rough_idle', causeKey: 'vacuum_leak', labelFr: 'Prise d’air à l’admission', labelEn: 'Intake air leak', weight: 0.25, parts: ['joint_admission'], tests: ['test_vacuum_leak'] },
  { symptom: 'rough_idle', causeKey: 'injectors_clogged', labelFr: 'Injecteurs encrassés', labelEn: 'Clogged injectors', weight: 0.2, parts: ['injecteur'], tests: ['test_injector_balance'] },
  { symptom: 'rough_idle', causeKey: 'throttle_dirty', labelFr: 'Boîtier papillon encrassé', labelEn: 'Dirty throttle body', weight: 0.15, parts: ['boitier_papillon'], tests: ['test_wiring_visual'] },
  { symptom: 'rough_idle', causeKey: 'egr_clogged', labelFr: 'Vanne EGR encrassée', labelEn: 'Clogged EGR valve', weight: 0.1, parts: ['vanne_egr'], tests: ['test_egr_operation'] },

  { symptom: 'no_start', causeKey: 'battery_worn', labelFr: 'Batterie insuffisamment chargée', labelEn: 'Insufficiently charged battery', weight: 0.3, parts: ['batterie'], tests: ['test_battery_rest_voltage', 'test_charging_voltage'] },
  { symptom: 'no_start', causeKey: 'crank_sensor_faulty', labelFr: 'Capteur de vilebrequin', labelEn: 'Crankshaft position sensor', weight: 0.25, parts: ['capteur_vilebrequin'], tests: ['test_crank_sensor_signal'] },
  { symptom: 'no_start', causeKey: 'fuel_pressure_low', labelFr: 'Alimentation en carburant insuffisante', labelEn: 'Insufficient fuel supply', weight: 0.25, parts: ['pompe_carburant', 'filtre_carburant'], tests: ['test_fuel_pressure'] },
  { symptom: 'no_start', causeKey: 'starter_faulty', labelFr: 'Démarreur ou circuit de démarrage', labelEn: 'Starter or starting circuit', weight: 0.2, parts: ['demarreur'], tests: ['test_battery_rest_voltage'] },

  { symptom: 'loss_of_power', causeKey: 'fuel_filter_clogged', labelFr: 'Filtre à carburant colmaté', labelEn: 'Clogged fuel filter', weight: 0.3, parts: ['filtre_carburant'], tests: ['test_fuel_pressure'] },
  { symptom: 'loss_of_power', causeKey: 'boost_hose_leak', labelFr: 'Fuite sur le circuit de suralimentation', labelEn: 'Boost circuit leak', weight: 0.25, parts: ['durite_suralimentation'], tests: ['test_boost_leak'] },
  { symptom: 'loss_of_power', causeKey: 'maf_dirty', labelFr: 'Capteur de débit d’air encrassé', labelEn: 'Dirty MAF sensor', weight: 0.2, parts: ['capteur_debit_air'], tests: ['test_maf_reading'] },
  { symptom: 'loss_of_power', causeKey: 'air_filter_clogged', labelFr: 'Filtre à air très colmaté', labelEn: 'Heavily clogged air filter', weight: 0.15, parts: ['filtre_air'], tests: [] },
  { symptom: 'loss_of_power', causeKey: 'dpf_partially_clogged', labelFr: 'Filtre à particules chargé', labelEn: 'Loaded particulate filter', weight: 0.1, parts: ['filtre_particules'], tests: ['test_dpf_soot_load'] },

  { symptom: 'black_smoke', causeKey: 'injectors_worn', labelFr: 'Injecteurs encrassés ou usés', labelEn: 'Clogged or worn injectors', weight: 0.3, parts: ['injecteur'], tests: ['test_injector_balance'] },
  { symptom: 'black_smoke', causeKey: 'air_filter_clogged', labelFr: 'Filtre à air colmaté', labelEn: 'Clogged air filter', weight: 0.25, parts: ['filtre_air'], tests: [] },
  { symptom: 'black_smoke', causeKey: 'egr_clogged', labelFr: 'EGR / admission encrassée', labelEn: 'Clogged EGR / intake', weight: 0.2, parts: ['vanne_egr'], tests: ['test_egr_operation'] },
  { symptom: 'black_smoke', causeKey: 'boost_hose_leak', labelFr: 'Fuite de suralimentation', labelEn: 'Boost leak', weight: 0.15, parts: ['durite_suralimentation'], tests: ['test_boost_leak'] },
  { symptom: 'black_smoke', causeKey: 'fuel_quality', labelFr: 'Carburant de qualité inadaptée', labelEn: 'Unsuitable fuel quality', weight: 0.1, parts: [], tests: ['test_fuel_quality'] },

  { symptom: 'white_smoke', causeKey: 'head_gasket', labelFr: 'Joint de culasse', labelEn: 'Head gasket', weight: 0.35, parts: ['joint_culasse'], tests: ['test_combustion_gases_coolant'] },
  { symptom: 'white_smoke', causeKey: 'injector_leaking', labelFr: 'Injecteur qui fuit', labelEn: 'Leaking injector', weight: 0.3, parts: ['injecteur'], tests: ['test_injector_balance'] },
  { symptom: 'white_smoke', causeKey: 'egr_cooler', labelFr: 'Refroidisseur EGR (moteurs diesel)', labelEn: 'EGR cooler (diesel engines)', weight: 0.2, parts: ['refroidisseur_egr'], tests: [] },

  { symptom: 'blue_smoke', causeKey: 'oil_consumption', labelFr: 'Consommation d’huile (segments, guides de soupapes)', labelEn: 'Oil consumption (rings, valve guides)', weight: 0.5, parts: [], tests: ['test_compression'] },
  { symptom: 'blue_smoke', causeKey: 'turbo_worn', labelFr: 'Turbocompresseur usé (fuite d’huile)', labelEn: 'Worn turbocharger (oil leak)', weight: 0.3, parts: ['turbo'], tests: [] },
  { symptom: 'blue_smoke', causeKey: 'pcv_valve', labelFr: 'Valve de recyclage des vapeurs d’huile', labelEn: 'PCV valve', weight: 0.2, parts: ['valve_pcv'], tests: [] },

  { symptom: 'overheating', causeKey: 'coolant_level_low', labelFr: 'Manque de liquide de refroidissement', labelEn: 'Low coolant level', weight: 0.3, parts: ['liquide_refroidissement'], tests: ['test_coolant_level'] },
  { symptom: 'overheating', causeKey: 'fan_not_working', labelFr: 'Ventilateur de refroidissement', labelEn: 'Cooling fan', weight: 0.25, parts: ['moto_ventilateur'], tests: ['test_fan_operation'] },
  { symptom: 'overheating', causeKey: 'thermostat_stuck_closed', labelFr: 'Thermostat bloqué fermé', labelEn: 'Thermostat stuck closed', weight: 0.2, parts: ['thermostat'], tests: ['test_warm_up_curve'] },
  { symptom: 'overheating', causeKey: 'radiator_clogged', labelFr: 'Radiateur obstrué (poussière, calcaire)', labelEn: 'Blocked radiator (dust, scale)', weight: 0.15, parts: ['radiateur'], tests: ['test_radiator_flow'] },
  { symptom: 'overheating', causeKey: 'head_gasket', labelFr: 'Joint de culasse', labelEn: 'Head gasket', weight: 0.1, parts: ['joint_culasse'], tests: ['test_combustion_gases_coolant'] },

  { symptom: 'brake_noise', causeKey: 'brake_pads_worn', labelFr: 'Plaquettes de frein usées', labelEn: 'Worn brake pads', weight: 0.45, parts: ['plaquettes_frein'], tests: ['test_brake_visual'] },
  { symptom: 'brake_noise', causeKey: 'disc_worn', labelFr: 'Disques usés ou voilés', labelEn: 'Worn or warped discs', weight: 0.3, parts: ['disque_frein'], tests: ['test_brake_visual'] },
  { symptom: 'brake_noise', causeKey: 'brake_dust_debris', labelFr: 'Corps étranger entre plaquette et disque (sable, poussière)', labelEn: 'Foreign body between pad and disc (sand, dust)', weight: 0.25, parts: [], tests: ['test_brake_visual'] },

  { symptom: 'battery_light_on', causeKey: 'alternator_weak', labelFr: 'Alternateur / circuit de charge', labelEn: 'Alternator / charging circuit', weight: 0.4, parts: ['alternateur', 'courroie_accessoires'], tests: ['test_charging_voltage'] },
  { symptom: 'battery_light_on', causeKey: 'belt_tension', labelFr: 'Courroie d’accessoires détendue', labelEn: 'Loose accessory belt', weight: 0.3, parts: ['courroie_accessoires'], tests: ['test_charging_voltage'] },
  { symptom: 'battery_light_on', causeKey: 'battery_worn', labelFr: 'Batterie en fin de vie', labelEn: 'Battery at end of life', weight: 0.3, parts: ['batterie'], tests: ['test_battery_rest_voltage'] },

  { symptom: 'ac_not_cold', causeKey: 'ac_gas_low', labelFr: 'Charge de gaz insuffisante (fuite)', labelEn: 'Low refrigerant charge (leak)', weight: 0.4, parts: ['gaz_climatisation'], tests: [] },
  { symptom: 'ac_not_cold', causeKey: 'ac_compressor', labelFr: 'Compresseur de climatisation', labelEn: 'A/C compressor', weight: 0.3, parts: ['compresseur_climatisation'], tests: [] },
  { symptom: 'ac_not_cold', causeKey: 'ac_filter_dirty', labelFr: 'Filtre habitacle / condenseur encrassé', labelEn: 'Cabin filter / clogged condenser', weight: 0.3, parts: ['filtre_habitacle'], tests: [] },

  { symptom: 'excessive_fuel_consumption', causeKey: 'o2_upstream_faulty', labelFr: 'Sonde O2 amont en dérive', labelEn: 'Drifting upstream O2 sensor', weight: 0.25, parts: ['sonde_o2_amont'], tests: ['test_o2_sensor_activity'] },
  { symptom: 'excessive_fuel_consumption', causeKey: 'thermostat_stuck_open', labelFr: 'Thermostat bloqué ouvert', labelEn: 'Thermostat stuck open', weight: 0.2, parts: ['thermostat'], tests: ['test_warm_up_curve'] },
  { symptom: 'excessive_fuel_consumption', causeKey: 'air_filter_clogged', labelFr: 'Filtre à air colmaté', labelEn: 'Clogged air filter', weight: 0.2, parts: ['filtre_air'], tests: [] },
  { symptom: 'excessive_fuel_consumption', causeKey: 'tyre_pressure', labelFr: 'Pression des pneus insuffisante', labelEn: 'Insufficient tyre pressure', weight: 0.2, parts: [], tests: [] },
  { symptom: 'excessive_fuel_consumption', causeKey: 'brake_drag', labelFr: 'Frein qui reste légèrement serré', labelEn: 'Brake dragging', weight: 0.15, parts: ['etrier_frein'], tests: ['test_brake_visual'] },

  { symptom: 'smell_fuel', causeKey: 'fuel_cap_seal', labelFr: 'Bouchon / joint de réservoir', labelEn: 'Fuel cap / tank seal', weight: 0.35, parts: ['bouchon_reservoir'], tests: ['test_fuel_cap'] },
  { symptom: 'smell_fuel', causeKey: 'leak_in_fuel_line', labelFr: 'Fuite sur le circuit d’alimentation', labelEn: 'Leak in the fuel supply line', weight: 0.45, parts: ['durite_carburant'], tests: ['test_exhaust_leak'] },
  { symptom: 'smell_fuel', causeKey: 'injector_leaking', labelFr: 'Injecteur qui fuit', labelEn: 'Leaking injector', weight: 0.2, parts: ['injecteur'], tests: ['test_injector_balance'] },

  { symptom: 'engine_stall', causeKey: 'crank_sensor_faulty', labelFr: 'Capteur de vilebrequin (calage à chaud)', labelEn: 'Crankshaft sensor (hot stall)', weight: 0.35, parts: ['capteur_vilebrequin'], tests: ['test_crank_sensor_signal'] },
  { symptom: 'engine_stall', causeKey: 'fuel_pressure_low', labelFr: 'Alimentation carburant', labelEn: 'Fuel supply', weight: 0.25, parts: ['pompe_carburant'], tests: ['test_fuel_pressure'] },
  { symptom: 'engine_stall', causeKey: 'ground_strap', labelFr: 'Masse moteur ou châssis défectueuse', labelEn: 'Faulty engine or chassis ground', weight: 0.2, parts: [], tests: ['test_wiring_visual'] },
  { symptom: 'engine_stall', causeKey: 'ecm_issue', labelFr: 'Calculateur ou alimentation calculateur', labelEn: 'ECU or ECU supply', weight: 0.2, parts: [], tests: ['test_charging_voltage'] },
];

export function symptomHypothesesFor(keys: SymptomKey[]): SymptomHypothesisSeed[] {
  return SYMPTOM_HYPOTHESES.filter((h) => keys.includes(h.symptom));
}
