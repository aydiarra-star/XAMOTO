/**
 * XAMOTO — Dictionnaire PID (SAE J1979 / ISO 15031-5).
 *
 * Chaque PID déclare :
 *   – son identifiant OBD (mode 01),
 *   – son décodeur (octets → valeur physique),
 *   – ses bornes d'interprétation.
 *
 * §8 : XAMOTO doit toujours distinguer « donnée disponible » de
 * « donnée non disponible ». Le décodage renvoie donc `null` — jamais 0 —
 * lorsque le véhicule répond « non supporté » ou « non disponible ».
 */
import type { PidKey } from '@xamoto/shared';

export interface PidDefinition {
  /** PID hexadécimal sur 2 octets, ex. « 0C ». */
  obd: string;
  key: PidKey;
  labelFr: string;
  labelEn: string;
  unit: string;
  bytes: number;
  /** Bornes d'exploitation pour l'interprétation (pas des valeurs constructeur). */
  min: number | null;
  max: number | null;
  /** Calcule la valeur physique à partir des octets de données. */
  decode: (b: number[]) => number | null;
  /** Contexte d'acquisition utile à l'interprétation. */
  condition: 'cold' | 'warm' | 'running' | 'idle' | 'unknown';
  /**
   * Valeurs de référence largement documentées, utilisées UNIQUEMENT pour
   * signaler une anomalie, jamais pour conclure (§47-3).
   */
  ref?: { normalMin?: number; normalMax?: number; coldMax?: number };
  /** Renseigné pour les PID issus du mode 06 / capteurs O2 multiples. */
  bank?: 1 | 2;
  sensor?: 1 | 2;
}

const u8 = (v: number) => v & 0xff;
const perByte = (b: number[], i: number): number | null => (b.length > i ? u8(b[i] as number) : null);

/** 0xFF, 0xFFFF… signifient « non disponible » dans la norme. */
export const isUnavailable = (bytes: number[]): boolean => {
  if (bytes.length === 0) return true;
  return bytes.every((x) => u8(x) === 0xff) && (bytes.length === 1 || bytes.length === 2);
};

export const PID_DEFINITIONS: PidDefinition[] = [
  {
    obd: '04',
    key: 'engine_load',
    labelFr: 'Charge moteur calculée',
    labelEn: 'Calculated engine load',
    unit: '%',
    bytes: 1,
    min: 0,
    max: 100,
    condition: 'running',
    decode: (b) => (perByte(b, 0) === null ? null : (u8(b[0] as number) * 100) / 255),
    ref: { normalMin: 10, normalMax: 85 },
  },
  {
    obd: '05',
    key: 'coolant_temp',
    labelFr: 'Température liquide de refroidissement',
    labelEn: 'Engine coolant temperature',
    unit: '°C',
    bytes: 1,
    min: -40,
    max: 215,
    condition: 'warm',
    decode: (b) => (perByte(b, 0) === null ? null : u8(b[0] as number) - 40),
    // Plage normale moteur chaud communément admise : ~80–105 °C.
    // Au-delà de 110 °C le moteur de sécurité élève le niveau d'alerte.
    ref: { normalMin: 75, normalMax: 105, coldMax: 60 },
  },
  {
    obd: '06',
    key: 'short_fuel_trim_b1',
    labelFr: 'Correction carburant court terme (B1)',
    labelEn: 'Short term fuel trim bank 1',
    unit: '%',
    bytes: 1,
    min: -100,
    max: 99.2,
    condition: 'running',
    decode: (b) => (perByte(b, 0) === null ? null : ((u8(b[0] as number) - 128) * 100) / 128),
    ref: { normalMin: -10, normalMax: 10 },
  },
  {
    obd: '07',
    key: 'long_fuel_trim_b1',
    labelFr: 'Correction carburant long terme (B1)',
    labelEn: 'Long term fuel trim bank 1',
    unit: '%',
    bytes: 1,
    min: -100,
    max: 99.2,
    condition: 'running',
    decode: (b) => (perByte(b, 0) === null ? null : ((u8(b[0] as number) - 128) * 100) / 128),
    ref: { normalMin: -10, normalMax: 10 },
  },
  {
    obd: '08',
    key: 'short_fuel_trim_b2',
    labelFr: 'Correction carburant court terme (B2)',
    labelEn: 'Short term fuel trim bank 2',
    unit: '%',
    bytes: 1,
    min: -100,
    max: 99.2,
    condition: 'running',
    decode: (b) => (perByte(b, 0) === null ? null : ((u8(b[0] as number) - 128) * 100) / 128),
    ref: { normalMin: -10, normalMax: 10 },
  },
  {
    obd: '09',
    key: 'long_fuel_trim_b2',
    labelFr: 'Correction carburant long terme (B2)',
    labelEn: 'Long term fuel trim bank 2',
    unit: '%',
    bytes: 1,
    min: -100,
    max: 99.2,
    condition: 'running',
    decode: (b) => (perByte(b, 0) === null ? null : ((u8(b[0] as number) - 128) * 100) / 128),
    ref: { normalMin: -10, normalMax: 10 },
  },
  {
    obd: '0A',
    key: 'fuel_pressure',
    labelFr: 'Pression carburant (rampe)',
    labelEn: 'Fuel pressure',
    unit: 'kPa',
    bytes: 1,
    min: 0,
    max: 765,
    condition: 'running',
    decode: (b) => (perByte(b, 0) === null ? null : u8(b[0] as number) * 3),
  },
  {
    obd: '0C',
    key: 'engine_rpm',
    labelFr: 'Régime moteur',
    labelEn: 'Engine speed',
    unit: 'tr/min',
    bytes: 2,
    min: 0,
    max: 16383.75,
    condition: 'running',
    decode: (b) => (b.length < 2 ? null : (u8(b[0] as number) * 256 + u8(b[1] as number)) / 4),
    ref: { normalMin: 600, normalMax: 3000 },
  },
  {
    obd: '0D',
    key: 'vehicle_speed',
    labelFr: 'Vitesse véhicule',
    labelEn: 'Vehicle speed',
    unit: 'km/h',
    bytes: 1,
    min: 0,
    max: 255,
    condition: 'running',
    decode: (b) => perByte(b, 0),
  },
  {
    obd: '0E',
    key: 'timing_advance',
    labelFr: 'Avance à l’allumage',
    labelEn: 'Timing advance',
    unit: '°',
    bytes: 1,
    min: -64,
    max: 63.5,
    condition: 'running',
    decode: (b) => (perByte(b, 0) === null ? null : u8(b[0] as number) / 2 - 64),
  },
  {
    obd: '0F',
    key: 'intake_air_temp',
    labelFr: 'Température air d’admission',
    labelEn: 'Intake air temperature',
    unit: '°C',
    bytes: 1,
    min: -40,
    max: 215,
    condition: 'unknown',
    decode: (b) => (perByte(b, 0) === null ? null : u8(b[0] as number) - 40),
    ref: { normalMin: 0, normalMax: 60 },
  },
  {
    obd: '10',
    key: 'maf_air_flow',
    labelFr: 'Débit d’air (MAF)',
    labelEn: 'Mass air flow',
    unit: 'g/s',
    bytes: 2,
    min: 0,
    max: 655.35,
    condition: 'running',
    decode: (b) => (b.length < 2 ? null : (u8(b[0] as number) * 256 + u8(b[1] as number)) / 100),
  },
  {
    obd: '11',
    key: 'throttle_position',
    labelFr: 'Position papillon',
    labelEn: 'Throttle position',
    unit: '%',
    bytes: 1,
    min: 0,
    max: 100,
    condition: 'running',
    decode: (b) => (perByte(b, 0) === null ? null : (u8(b[0] as number) * 100) / 255),
    ref: { normalMin: 0, normalMax: 12 },
  },
  {
    obd: '14',
    key: 'o2_b1s1_voltage',
    labelFr: 'Sonde O2 amont (B1S1)',
    labelEn: 'O2 sensor B1S1',
    unit: 'V',
    bytes: 2,
    min: 0,
    max: 1.275,
    condition: 'running',
    bank: 1,
    sensor: 1,
    decode: (b) => {
      if (perByte(b, 0) === null) return null;
      if (u8(b[0] as number) === 0xff) return null;
      return u8(b[0] as number) / 200;
    },
    ref: { normalMin: 0.1, normalMax: 0.9 },
  },
  {
    obd: '15',
    key: 'o2_b1s2_voltage',
    labelFr: 'Sonde O2 aval (B1S2)',
    labelEn: 'O2 sensor B1S2',
    unit: 'V',
    bytes: 2,
    min: 0,
    max: 1.275,
    condition: 'running',
    bank: 1,
    sensor: 2,
    decode: (b) => {
      if (perByte(b, 0) === null) return null;
      if (u8(b[0] as number) === 0xff) return null;
      return u8(b[0] as number) / 200;
    },
    ref: { normalMin: 0.1, normalMax: 0.9 },
  },
  {
    obd: '1F',
    key: 'runtime_since_start',
    labelFr: 'Temps depuis démarrage',
    labelEn: 'Run time since engine start',
    unit: 's',
    bytes: 2,
    min: 0,
    max: 65535,
    condition: 'running',
    decode: (b) => (b.length < 2 ? null : u8(b[0] as number) * 256 + u8(b[1] as number)),
  },
  {
    obd: '21',
    key: 'distance_with_mil',
    labelFr: 'Distance parcourue avec voyant allumé',
    labelEn: 'Distance travelled with MIL on',
    unit: 'km',
    bytes: 2,
    min: 0,
    max: 65535,
    condition: 'unknown',
    decode: (b) => (b.length < 2 ? null : u8(b[0] as number) * 256 + u8(b[1] as number)),
  },
  {
    obd: '2C',
    key: 'egr_command',
    labelFr: 'Consigne vanne EGR',
    labelEn: 'Commanded EGR',
    unit: '%',
    bytes: 1,
    min: 0,
    max: 100,
    condition: 'running',
    decode: (b) => (perByte(b, 0) === null ? null : (u8(b[0] as number) * 100) / 255),
  },
  {
    obd: '2F',
    key: 'fuel_level',
    labelFr: 'Niveau carburant',
    labelEn: 'Fuel tank level',
    unit: '%',
    bytes: 1,
    min: 0,
    max: 100,
    condition: 'unknown',
    decode: (b) => (perByte(b, 0) === null ? null : (u8(b[0] as number) * 100) / 255),
  },
  {
    obd: '33',
    key: 'barometric_pressure',
    labelFr: 'Pression barométrique',
    labelEn: 'Barometric pressure',
    unit: 'kPa',
    bytes: 1,
    min: 0,
    max: 255,
    condition: 'unknown',
    decode: (b) => perByte(b, 0),
    ref: { normalMin: 95, normalMax: 104 },
  },
  {
    obd: '42',
    key: 'battery_voltage',
    labelFr: 'Tension calculateur (batterie)',
    labelEn: 'Control module voltage',
    unit: 'V',
    bytes: 2,
    min: 0,
    max: 65.535,
    condition: 'unknown',
    decode: (b) => (b.length < 2 ? null : (u8(b[0] as number) * 256 + u8(b[1] as number)) / 1000),
    // Moteur tournant : l'alternateur doit maintenir ≈ 13,5–14,5 V.
    ref: { normalMin: 13.2, normalMax: 14.8 },
  },
  {
    obd: '46',
    key: 'ambient_temp',
    labelFr: 'Température ambiante',
    labelEn: 'Ambient air temperature',
    unit: '°C',
    bytes: 1,
    min: -40,
    max: 215,
    condition: 'unknown',
    decode: (b) => (perByte(b, 0) === null ? null : u8(b[0] as number) - 40),
  },
  {
    obd: '4C',
    key: 'throttle_position',
    labelFr: 'Position papillon (commande)',
    labelEn: 'Commanded throttle actuator',
    unit: '%',
    bytes: 1,
    min: 0,
    max: 100,
    condition: 'running',
    decode: (b) => (perByte(b, 0) === null ? null : (u8(b[0] as number) * 100) / 255),
  },
  {
    obd: '5C',
    key: 'oil_temp',
    labelFr: 'Température huile moteur',
    labelEn: 'Engine oil temperature',
    unit: '°C',
    bytes: 1,
    min: -40,
    max: 210,
    condition: 'warm',
    decode: (b) => (perByte(b, 0) === null ? null : u8(b[0] as number) - 40),
    ref: { normalMin: 80, normalMax: 130 },
  },
  {
    obd: '0B',
    key: 'map_pressure',
    labelFr: 'Pression collecteur (MAP)',
    labelEn: 'Intake manifold absolute pressure',
    unit: 'kPa',
    bytes: 1,
    min: 0,
    max: 255,
    condition: 'running',
    decode: (b) => perByte(b, 0),
    // Moteur atmosphérique au ralenti : ~30–50 kPa ; ~100 kPa pleine charge.
    ref: { normalMin: 25, normalMax: 105 },
  },
];

export const PID_BY_OBD = new Map(PID_DEFINITIONS.map((p) => [p.obd, p]));
export const PID_BY_KEY = new Map<PidKey, PidDefinition>(PID_DEFINITIONS.map((p) => [p.key, p]));

/** PID nécessaires pour un diagnostic « de base » quand le véhicule les expose. */
export const CORE_PID_KEYS: PidKey[] = [
  'engine_rpm',
  'vehicle_speed',
  'coolant_temp',
  'engine_load',
  'throttle_position',
  'battery_voltage',
];

/** PID de confort / surveillance, lus si supportés. */
export const EXTENDED_PID_KEYS: PidKey[] = [
  'intake_air_temp',
  'short_fuel_trim_b1',
  'long_fuel_trim_b1',
  'short_fuel_trim_b2',
  'long_fuel_trim_b2',
  'o2_b1s1_voltage',
  'o2_b1s2_voltage',
  'maf_air_flow',
  'map_pressure',
  'fuel_pressure',
  'fuel_level',
  'timing_advance',
  'runtime_since_start',
  'distance_with_mil',
  'oil_temp',
  'egr_command',
  'ambient_temp',
  'barometric_pressure',
];
