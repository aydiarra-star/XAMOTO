/**
 * XAMOTO — Simulateur OBD (§30).
 *
 * Objectif : permettre le développement, les tests et les démonstrations
 * sans véhicule. Les données produites portent TOUJOURS l'origine
 * `simulated`, et l'interface doit afficher « MODE SIMULATION » (§30, §47-2).
 *
 * Le simulateur n'est pas un générateur aléatoire : chaque scénario possède un
 * modèle d'évolution (montée en température, chute de tension de batterie,
 * ratés d'allumage…) fondé sur des ordres de grandeur automobiles usuels.
 */
import type { DataOrigin, PidKey } from '@xamoto/shared';

export type SimulationScenarioId =
  | 'normal_engine'
  | 'weak_battery'
  | 'high_temperature'
  | 'engine_fault'
  | 'multiple_dtc'
  | 'intermittent_fault'
  | 'no_start'
  | 'diesel_egr_dpf'
  | 'abs_fault';

export interface ScenarioDtcSpec {
  code: string;
  status: 'active' | 'pending' | 'stored';
  /** Apparition à partir de N secondes de simulation. */
  appearsAtSeconds: number;
  /** Le défaut disparaît après N secondes (panne intermittente). */
  disappearsAtSeconds?: number;
  occurrences: number;
  freezeFrame?: Record<string, number | string | null>;
}

export interface SimulationScenario {
  id: SimulationScenarioId;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
  /** Symptômes typiques associés — utiles en démo et pour les tests. */
  defaultSymptoms: string[];
  dtcs: ScenarioDtcSpec[];
  /** PID non supportés par le véhicule simulé (véhicule ancien / bas de gamme). */
  unsupportedPids: PidKey[];
  /** PID réellement mesurés par des capteurs (sinon : calculés / estimés). */
  calculatedPids?: PidKey[];
  /** Marque / modèle suggérés pour le mode démo (§31). */
  demoVehicle: { brand: string; model: string; year: number; engine: string; fuelType: 'essence' | 'diesel' | 'hybride'; plate?: string; vin?: string };
}

export const SCENARIOS: SimulationScenario[] = [
  {
    id: 'normal_engine',
    labelFr: 'Moteur normal',
    labelEn: 'Normal engine',
    descriptionFr: 'Véhicule sain : montée en température normale, régime stable, alternateur correct.',
    descriptionEn: 'Healthy vehicle: normal warm-up, stable idle, correct charging.',
    defaultSymptoms: [],
    dtcs: [],
    unsupportedPids: ['dpf_pressure_delta', 'oil_temp'],
    calculatedPids: ['engine_load'],
    demoVehicle: {
      brand: 'Toyota',
      model: 'Corolla',
      year: 2016,
      engine: '1.6 VVT-i',
      fuelType: 'essence',
      plate: 'DK-1234-AB',
      vin: 'JTDBR32E60J012345',
    },
  },
  {
    id: 'weak_battery',
    labelFr: 'Batterie faible',
    labelEn: 'Weak battery',
    descriptionFr: 'Tension de repos basse, charge insuffisante, démarrage difficile.',
    descriptionEn: 'Low rest voltage, insufficient charging, hard starting.',
    defaultSymptoms: ['hard_start', 'battery_light_on'],
    dtcs: [
      { code: 'P0562', status: 'active', appearsAtSeconds: 0, occurrences: 3, freezeFrame: { battery_voltage: 11.4 } },
    ],
    unsupportedPids: ['oil_temp', 'dpf_pressure_delta', 'egr_command'],
    demoVehicle: { brand: 'Peugeot', model: '308', year: 2013, engine: '1.6 VTi', fuelType: 'essence', plate: 'DK-4471-CD' },
  },
  {
    id: 'high_temperature',
    labelFr: 'Température élevée',
    labelEn: 'High temperature',
    descriptionFr: 'Surchauffe progressive : liquide de refroidissement au-delà de la plage normale.',
    descriptionEn: 'Progressive overheating: coolant above normal range.',
    defaultSymptoms: ['overheating', 'coolant_loss'],
    dtcs: [
      { code: 'P0217', status: 'active', appearsAtSeconds: 90, occurrences: 1, freezeFrame: { coolant_temp: 112 } },
    ],
    unsupportedPids: ['oil_temp', 'dpf_pressure_delta'],
    demoVehicle: { brand: 'Hyundai', model: 'Accent', year: 2011, engine: '1.6', fuelType: 'essence', plate: 'DK-8890-EF' },
  },
  {
    id: 'engine_fault',
    labelFr: 'Défaut moteur (ratés d’allumage)',
    labelEn: 'Engine fault (misfire)',
    descriptionFr: 'Ratés d’allumage sur le cylindre 1 : régime instable, sonde O2 perturbée.',
    descriptionEn: 'Cylinder 1 misfire: unstable idle, disturbed O2 signal.',
    defaultSymptoms: ['rough_idle', 'loss_of_power', 'vibration', 'warning_light_flashing'],
    dtcs: [
      { code: 'P0301', status: 'active', appearsAtSeconds: 30, occurrences: 5, freezeFrame: { engine_rpm: 812, coolant_temp: 88, engine_load: 32 } },
      { code: 'P0300', status: 'pending', appearsAtSeconds: 45, occurrences: 2 },
    ],
    unsupportedPids: ['oil_temp', 'dpf_pressure_delta'],
    demoVehicle: { brand: 'Toyota', model: 'Corolla', year: 2016, engine: '1.6 VVT-i', fuelType: 'essence', plate: 'DK-1234-AB' },
  },
  {
    id: 'multiple_dtc',
    labelFr: 'Plusieurs DTC simultanés',
    labelEn: 'Multiple simultaneous DTCs',
    descriptionFr: 'Mélange pauvre avec défaut de catalyseur et ratés : cas volontairement ambigu.',
    descriptionEn: 'Lean mixture with catalyst and misfire faults: deliberately ambiguous case.',
    defaultSymptoms: ['loss_of_power', 'jerking', 'excessive_fuel_consumption'],
    dtcs: [
      { code: 'P0171', status: 'active', appearsAtSeconds: 0, occurrences: 7, freezeFrame: { long_fuel_trim_b1: 18.7, engine_rpm: 780 } },
      { code: 'P0420', status: 'stored', appearsAtSeconds: 0, occurrences: 4 },
      { code: 'P0300', status: 'pending', appearsAtSeconds: 120, occurrences: 1 },
      { code: 'P0134', status: 'active', appearsAtSeconds: 60, occurrences: 2 },
    ],
    unsupportedPids: ['oil_temp', 'dpf_pressure_delta'],
    calculatedPids: ['engine_load'],
    demoVehicle: { brand: 'Nissan', model: 'Sunny', year: 2014, engine: '1.5', fuelType: 'essence', plate: 'DK-2210-GH' },
  },
  {
    id: 'intermittent_fault',
    labelFr: 'Panne intermittente',
    labelEn: 'Intermittent fault',
    descriptionFr: 'Défaut qui apparaît puis disparaît : impose de ne pas conclure trop vite.',
    descriptionEn: 'Fault appearing then disappearing: requires not concluding too quickly.',
    defaultSymptoms: ['jerking', 'engine_stall'],
    dtcs: [
      {
        code: 'P0335',
        status: 'pending',
        appearsAtSeconds: 20,
        disappearsAtSeconds: 140,
        occurrences: 3,
        freezeFrame: { engine_rpm: 0 },
      },
    ],
    unsupportedPids: ['oil_temp', 'dpf_pressure_delta'],
    demoVehicle: { brand: 'Renault', model: 'Duster', year: 2015, engine: '1.6 SCe', fuelType: 'essence', plate: 'DK-5567-IJ' },
  },
  {
    id: 'no_start',
    labelFr: 'Véhicule qui ne démarre pas',
    labelEn: 'Vehicle that does not start',
    descriptionFr: 'Contact mis, aucun démarrage : régime à 0, tension qui s’écroule au démarrage.',
    descriptionEn: 'Ignition on, no start: RPM at 0, voltage collapsing on cranking.',
    defaultSymptoms: ['no_start', 'hard_start'],
    dtcs: [
      { code: 'P0335', status: 'active', appearsAtSeconds: 0, occurrences: 6, freezeFrame: { engine_rpm: 0, battery_voltage: 9.8 } },
      { code: 'P0562', status: 'active', appearsAtSeconds: 0, occurrences: 4 },
    ],
    unsupportedPids: ['oil_temp', 'dpf_pressure_delta', 'maf_air_flow'],
    demoVehicle: { brand: 'Ford', model: 'Focus', year: 2012, engine: '1.6 Ti-VCT', fuelType: 'essence', plate: 'DK-9901-KL' },
  },
  {
    id: 'diesel_egr_dpf',
    labelFr: 'Diesel — EGR / FAP',
    labelEn: 'Diesel — EGR / DPF',
    descriptionFr: 'Diesel fortement kilométré : EGR encrassée et filtre à particules chargé.',
    descriptionEn: 'High-mileage diesel: clogged EGR and loaded particulate filter.',
    defaultSymptoms: ['loss_of_power', 'black_smoke', 'limp_mode'],
    dtcs: [
      { code: 'P0401', status: 'active', appearsAtSeconds: 0, occurrences: 9, freezeFrame: { egr_command: 62.4, engine_rpm: 1850 } },
      { code: 'P2002', status: 'stored', appearsAtSeconds: 60, occurrences: 3 },
      { code: 'P2463', status: 'active', appearsAtSeconds: 90, occurrences: 2 },
    ],
    unsupportedPids: ['o2_b1s2_voltage', 'fuel_pressure'],
    demoVehicle: { brand: 'Peugeot', model: 'Partner', year: 2014, engine: '1.6 HDi', fuelType: 'diesel', plate: 'DK-3388-MN' },
  },
  {
    /*
     * Scénario de freinage : le véhicule roule, le moteur est sain, mais un code
     * de châssis est présent. C'est le cas typique où un outil générique annonce
     * « capteur à remplacer » — XAMOTO, lui, impose l'ordre de vérification et
     * plafonne la certitude, parce que l'OBD ne donne AUCUNE mesure de roue.
     */
    id: 'abs_fault',
    labelFr: 'Freinage — code de châssis (ABS)',
    labelEn: 'Braking — chassis code (ABS)',
    descriptionFr:
      'Véhicule qui roule normalement mais avec un voyant ABS : code C0035 côté roue avant gauche. Aucune mesure de vitesse de roue n’est disponible par l’OBD : XAMOTO devra le dire.',
    descriptionEn:
      'Vehicle driving normally but with the ABS light on: code C0035 at the front-left wheel. No wheel-speed measurement is available over OBD: XAMOTO must say so.',
    defaultSymptoms: ['brake_soft_pedal'],
    dtcs: [
      { code: 'C0035', status: 'active', appearsAtSeconds: 0, occurrences: 7 },
      { code: 'C0040', status: 'stored', appearsAtSeconds: 30, occurrences: 2 },
    ],
    unsupportedPids: ['oil_temp', 'dpf_pressure_delta', 'egr_command'],
    demoVehicle: { brand: 'Hyundai', model: 'Accent', year: 2015, engine: '1.4 MPI', fuelType: 'essence', plate: 'DK-5522-QR' },
  },
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));

/* ───────────────────────── Modèle physique simplifié ─────────────────────── */

export interface SimulationReading {
  key: PidKey;
  value: number | null;
  supported: boolean;
  origin: DataOrigin;
}

export interface SimulatedState {
  elapsedSeconds: number;
  engineRunning: boolean;
  readings: SimulationReading[];
  dtcCodes: Array<{ code: string; status: 'active' | 'pending' | 'stored'; occurrences: number; freezeFrame?: Record<string, number | string | null> }>;
  /** Message lisible décrivant l'état courant (utile en démo). */
  narrativeFr: string;
  narrativeEn: string;
}

/** PRNG déterministe (mulberry32) — garantit des tests reproductibles. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, digits = 1) => Number(v.toFixed(digits));

/**
 * Simulateur d'état véhicule. `tick()` avance d'un pas de simulation et
 * renvoie une image complète des données disponibles.
 */
export class ObdSimulator {
  readonly scenario: SimulationScenario;
  private elapsed = 0;
  private rng: () => number;
  private misfireCount = 0;
  private startAttempt = 0;

  constructor(scenarioId: SimulationScenarioId = 'normal_engine', seed = 42) {
    const scenario = SCENARIO_BY_ID.get(scenarioId);
    if (!scenario) throw new Error(`Scénario inconnu : ${scenarioId}`);
    this.scenario = scenario;
    this.rng = makeRng(seed);
  }

  private noise(amplitude: number): number {
    return (this.rng() - 0.5) * 2 * amplitude;
  }

  /** Température de liquide : montée asymptotique vers la consigne du scénario. */
  private coolantTemp(): number {
    const target =
      this.scenario.id === 'high_temperature' ? 114 + this.noise(2)
      : this.scenario.id === 'no_start' ? 24
      : 89 + this.noise(1.5);
    const tau = 240; // constante de temps de chauffe en secondes
    const progress = 1 - Math.exp(-this.elapsed / tau);
    const ambient = 26;
    return round(ambient + (target - ambient) * progress, 1);
  }

  private batteryVoltage(engineRunning: boolean): number {
    const base = this.scenario.id === 'weak_battery' ? 11.55 : this.scenario.id === 'no_start' ? 11.2 : 12.55;
    if (!engineRunning) {
      if (this.scenario.id === 'normal_engine') return round(clamp(base - this.elapsed * 0.0008, 12.2, 12.8), 2);
      return round(base - Math.min(this.elapsed * 0.002, 0.5) + this.noise(0.05), 2);
    }
    const charging = this.scenario.id === 'weak_battery' ? 12.9 : 14.25;
    return round(charging + this.noise(0.12), 2);
  }

  private rpm(engineRunning: boolean): number {
    if (!engineRunning) return 0;
    if (this.scenario.id === 'no_start') return round(this.startAttempt % 4 === 0 ? 180 + this.noise(40) : 0, 0);
    const base = 760;
    const misfireAmplitude = this.scenario.id === 'engine_fault' ? 55 : this.scenario.id === 'multiple_dtc' ? 25 : 12;
    return round(clamp(base + this.noise(misfireAmplitude), 480, 1100), 0);
  }

  private fuelTrim(fuelType: string): number {
    if (this.scenario.id === 'multiple_dtc') return round(18.5 + this.noise(2), 1);
    if (this.scenario.id === 'diesel_egr_dpf') return round(6.5 + this.noise(1.5), 1);
    return round((fuelType === 'diesel' ? 1.2 : -2) + this.noise(2.5), 1);
  }

  /** Avance la simulation de `seconds` (par défaut 5 s). */
  tick(seconds = 5): SimulatedState {
    this.elapsed += seconds;
    const engineRunning = !(this.scenario.id === 'no_start' && this.elapsed < 40);
    if (this.scenario.id === 'no_start') this.startAttempt += 1;

    const coolant = this.coolantTemp();
    const rpm = this.rpm(engineRunning);
    const voltage = this.batteryVoltage(engineRunning);
    const load =
      this.scenario.id === 'high_temperature' ? 42 + this.noise(5)
      : this.scenario.id === 'engine_fault' ? 34 + this.noise(8)
      : 22 + this.noise(6);

    const readings: SimulationReading[] = [
      { key: 'engine_rpm', value: rpm, supported: true, origin: 'measured' },
      { key: 'vehicle_speed', value: 0, supported: true, origin: 'measured' },
      { key: 'coolant_temp', value: coolant, supported: true, origin: 'measured' },
      { key: 'intake_air_temp', value: round(28 + this.noise(3), 0), supported: true, origin: 'measured' },
      { key: 'engine_load', value: round(load, 1), supported: true, origin: 'calculated' },
      { key: 'throttle_position', value: round(clamp(rpm / 100, 3, 20), 1), supported: true, origin: 'measured' },
      { key: 'battery_voltage', value: voltage, supported: true, origin: 'measured' },
      { key: 'maf_air_flow', value: round(engineRunning ? (rpm / 100) * 0.22 + this.noise(0.4) : 0, 2), supported: true, origin: 'measured' },
      { key: 'map_pressure', value: round(engineRunning ? 38 + this.noise(4) : 99, 0), supported: true, origin: 'measured' },
      { key: 'fuel_pressure', value: round(engineRunning ? 330 + this.noise(15) : 0, 0), supported: true, origin: 'measured' },
      { key: 'fuel_level', value: round(clamp(62 - this.elapsed * 0.002, 0, 100), 1), supported: true, origin: 'measured' },
      {
        key: 'short_fuel_trim_b1',
        value: this.fuelTrim(this.scenario.demoVehicle.fuelType),
        supported: true,
        origin: 'calculated',
      },
      {
        key: 'long_fuel_trim_b1',
        value: this.fuelTrim(this.scenario.demoVehicle.fuelType) * 0.8,
        supported: true,
        origin: 'calculated',
      },
      { key: 'short_fuel_trim_b2', value: null, supported: false, origin: 'unknown' },
      { key: 'long_fuel_trim_b2', value: null, supported: false, origin: 'unknown' },
      {
        key: 'o2_b1s1_voltage',
        value:
          this.scenario.id === 'engine_fault'
            ? round(clamp(0.45 + this.noise(0.35), 0.05, 0.95), 2)
            : round(clamp(0.45 + this.noise(0.25), 0.1, 0.9), 2),
        supported: true,
        origin: 'measured',
      },
      {
        key: 'o2_b1s2_voltage',
        value: this.scenario.id === 'multiple_dtc' ? round(clamp(0.62 + this.noise(0.05), 0.4, 0.8), 2) : round(clamp(0.45 + this.noise(0.3), 0.1, 0.9), 2),
        supported: true,
        origin: 'measured',
      },
      { key: 'timing_advance', value: round(12 + this.noise(4), 1), supported: true, origin: 'measured' },
      { key: 'runtime_since_start', value: Math.round(this.elapsed), supported: true, origin: 'measured' },
      {
        key: 'distance_with_mil',
        value: this.scenario.dtcs.length > 0 ? Math.round(this.elapsed / 60) : 0,
        supported: true,
        origin: 'measured',
      },
      {
        key: 'misfire_count',
        value:
          this.scenario.id === 'engine_fault'
            ? (this.misfireCount += Math.round(4 + this.rng() * 10))
            : 0,
        supported: this.scenario.id === 'engine_fault' || this.scenario.id === 'multiple_dtc',
        origin: 'measured',
      },
      {
        key: 'oil_temp',
        value: this.scenario.unsupportedPids.includes('oil_temp') ? null : round(coolant + 8 + this.noise(2), 0),
        supported: !this.scenario.unsupportedPids.includes('oil_temp'),
        origin: this.scenario.unsupportedPids.includes('oil_temp') ? 'unknown' : 'measured',
      },
      {
        key: 'dpf_pressure_delta',
        value: this.scenario.id === 'diesel_egr_dpf' ? round(28 + this.noise(3), 1) : null,
        supported: !this.scenario.unsupportedPids.includes('dpf_pressure_delta'),
        origin: this.scenario.id === 'diesel_egr_dpf' ? 'measured' : 'unknown',
      },
      {
        key: 'egr_command',
        value: this.scenario.id === 'diesel_egr_dpf' ? round(62 + this.noise(6), 1) : round(8 + this.noise(4), 1),
        supported: !this.scenario.unsupportedPids.includes('egr_command'),
        origin: this.scenario.unsupportedPids.includes('egr_command') ? 'unknown' : 'measured',
      },
      { key: 'ambient_temp', value: 29, supported: true, origin: 'measured' },
      { key: 'barometric_pressure', value: 101, supported: true, origin: 'measured' },
    ];

    const dtcCodes = this.scenario.dtcs
      .filter((d) => {
        const appeared = this.elapsed >= d.appearsAtSeconds;
        const gone = d.disappearsAtSeconds !== undefined && this.elapsed >= d.disappearsAtSeconds;
        return appeared && !gone;
      })
      .map((d) => ({ code: d.code, status: d.status, occurrences: d.occurrences, freezeFrame: d.freezeFrame }));

    const { narrativeFr, narrativeEn } = this.narrative(engineRunning, coolant, voltage, dtcCodes.length);

    return {
      elapsedSeconds: this.elapsed,
      engineRunning,
      readings,
      dtcCodes,
      narrativeFr,
      narrativeEn,
    };
  }

  private narrative(engineRunning: boolean, coolant: number, voltage: number, dtcCount: number): { narrativeFr: string; narrativeEn: string } {
    if (this.scenario.id === 'no_start' && !engineRunning) {
      return {
        narrativeFr: 'Le moteur ne démarre pas. La tension mesurée chute fortement pendant la tentative de démarrage.',
        narrativeEn: 'The engine does not start. Measured voltage drops sharply during the starting attempt.',
      };
    }
    if (coolant > 105) {
      return {
        narrativeFr: `Température moteur élevée (${coolant} °C) et en hausse.`,
        narrativeEn: `High engine temperature (${coolant} °C) and rising.`,
      };
    }
    if (voltage < 12.2 && engineRunning) {
      return {
        narrativeFr: `Tension de charge insuffisante (${voltage} V) alors que le moteur tourne.`,
        narrativeEn: `Insufficient charging voltage (${voltage} V) while the engine is running.`,
      };
    }
    if (dtcCount > 0) {
      return {
        narrativeFr: `${dtcCount} défaut(s) mémorisé(s). Régime moteur ${engineRunning ? 'instable par moments' : 'à l’arrêt'}.`,
        narrativeEn: `${dtcCount} stored fault(s). Engine speed ${engineRunning ? 'occasionally unstable' : 'stopped'}.`,
      };
    }
    if (coolant < 60) {
      return {
        narrativeFr: `Le moteur est en phase de chauffe (${coolant} °C), aucune anomalie détectée.`,
        narrativeEn: `The engine is warming up (${coolant} °C), no anomaly detected.`,
      };
    }
    return {
      narrativeFr: `Moteur chaud (${coolant} °C), tension de charge correcte (${voltage} V), aucun défaut mémorisé.`,
      narrativeEn: `Warm engine (${coolant} °C), correct charging voltage (${voltage} V), no stored fault.`,
    };
  }

  /** Simule l'affichage du voyant : le DTC P0301 fait clignoter le voyant. */
  milStatus(state: SimulatedState): { milOn: boolean; flashing: boolean; dtcCount: number } {
    const flashing = state.dtcCodes.some((d) => d.code.startsWith('P030') || d.code === 'P0301');
    return { milOn: state.dtcCodes.length > 0, flashing: flashing && this.scenario.id === 'engine_fault', dtcCount: state.dtcCodes.length };
  }
}
