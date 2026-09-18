/**
 * XAMOTO — Modèle de domaine partagé (backend, moteur de diagnostic, IA, front).
 * §32 (base de données), §6 → §28 (fonctionnalités).
 */
import type { CertaintyLevel, DataOrigin, Role, SafetyLevel, SourceReliability } from './levels.js';

export type ID = string;
/** Horodatage ISO 8601. */
export type ISODate = string;

/* ─────────────────────────────── Comptes (§36) ────────────────────────────── */

export interface User {
  id: ID;
  email: string;
  fullName: string;
  phone?: string | null;
  country: string;
  locale: string;
  role: Role;
  organizationId?: ID | null;
  plan: 'free' | 'premium' | 'pro' | 'fleet';
  createdAt: ISODate;
}

export interface Organization {
  id: ID;
  name: string;
  kind: 'garage' | 'fleet' | 'company' | 'partner';
  city?: string;
  country: string;
}

/* ──────────────────────────────── Véhicule (§6) ───────────────────────────── */

export type FuelType =
  | 'essence'
  | 'diesel'
  | 'hybride'
  | 'hybride_rechargeable'
  | 'electrique'
  | 'gpl'
  | 'flex';

export type Gearbox = 'manuelle' | 'automatique' | 'robotisee' | 'cvt' | 'inconnue';

export interface Vehicle {
  id: ID;
  ownerId: ID;
  organizationId?: ID | null;
  nickname?: string | null;
  brand: string;
  model: string;
  generation?: string | null;
  year: number;
  engine: string;
  engineDisplacementCc?: number | null;
  fuelType: FuelType;
  gearbox: Gearbox;
  powerHp?: number | null;
  vin?: string | null;
  plate?: string | null;
  country: string;
  purchaseDate?: ISODate | null;
  odometerKm: number;
  odometerUpdatedAt?: ISODate | null;
  obdProtocol?: string | null;
  supportedPids?: string[];
  createdAt: ISODate;
  updatedAt: ISODate;
  /** Partages explicites (§38) : aucune donnée accessible sans autorisation. */
  shares?: VehicleShare[];
}

export interface VehicleShare {
  id: ID;
  vehicleId: ID;
  userId?: ID | null;
  garageId?: ID | null;
  permission: 'read' | 'write' | 'diagnose';
  grantedBy: ID;
  grantedAt: ISODate;
  revokedAt?: ISODate | null;
}

/** Fiche technique documentée (§6, §28) — alimente le contexte IA (§14). */
export interface VehicleSpec {
  id: ID;
  brand: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  engine: string;
  fuelType: FuelType;
  oilSpec: string;
  oilCapacityL: number;
  coolantSpec: string;
  timingType: 'chaine' | 'courroie' | 'inconnu';
  timingIntervalKm?: number | null;
  sparkPlugSpec?: string | null;
  sparkPlugIntervalKm?: number | null;
  commonIssues: string[];
  sourceId: ID;
}

/* ──────────────────────────── Couche OBD (§7, §8) ─────────────────────────── */

export type ConnectionKind = 'bluetooth' | 'ble' | 'usb' | 'wifi' | 'simulator';

export interface ObdDevice {
  id: ID;
  userId: ID;
  label: string;
  kind: ConnectionKind;
  model?: string | null;
  /** Protocole négocié, ex. « ISO 15765-4 CAN (11 bit ID, 500 kbaud) ». */
  protocol?: string | null;
  lastSeenAt?: ISODate | null;
  batteryVoltage?: number | null;
}

export interface ObdSession {
  id: ID;
  vehicleId: ID;
  userId: ID;
  deviceId?: ID | null;
  source: 'obd' | 'simulator';
  protocol?: string | null;
  startedAt: ISODate;
  endedAt?: ISODate | null;
  ignitionOn?: boolean | null;
  engineRunning?: boolean | null;
  status: 'running' | 'completed' | 'failed' | 'aborted';
  errorMessage?: string | null;
  pidCount?: number;
  dtcCount?: number;
}

/** Une mesure : valeur + provenance + méthode d'acquisition (§33). */
export interface ObdReading {
  id: ID;
  sessionId: ID;
  vehicleId: ID;
  /** Identifiant PID, ex. « 0105 » ou clé symbolique « coolant_temp ». */
  pid: string;
  key: PidKey;
  label: string;
  value: number | null;
  unit: string;
  min?: number | null;
  max?: number | null;
  supported: boolean;
  origin: DataOrigin;
  capturedAt: ISODate;
  /** « À chaud » / « à froid » aide à l'interprétation. */
  condition?: 'cold' | 'warm' | 'running' | 'idle' | 'unknown';
  raw?: string | null;
}

export const PID_KEYS = [
  'engine_rpm',
  'vehicle_speed',
  'coolant_temp',
  'intake_air_temp',
  'engine_load',
  'throttle_position',
  'throttle_actuator_command',
  'battery_voltage',
  'maf_air_flow',
  'map_pressure',
  'fuel_pressure',
  'fuel_level',
  'short_fuel_trim_b1',
  'long_fuel_trim_b1',
  'short_fuel_trim_b2',
  'long_fuel_trim_b2',
  'o2_b1s1_voltage',
  'o2_b1s2_voltage',
  'timing_advance',
  'runtime_since_start',
  'distance_with_mil',
  'misfire_count',
  'oil_temp',
  'dpf_pressure_delta',
  'egr_command',
  'ambient_temp',
  'barometric_pressure',
] as const;
export type PidKey = (typeof PID_KEYS)[number];

/* ──────────────────────────── Défauts (DTC) (§8) ─────────────────────────── */

export type DtcSystem =
  | 'moteur'
  | 'allumage'
  | 'injection'
  | 'carburant'
  | 'admission'
  | 'echappement'
  | 'depollution'
  | 'transmission'
  | 'freinage'
  | 'abs'
  | 'airbag'
  | 'climatisation'
  | 'electrique'
  | 'reseau'
  | 'carrosserie';

/**
 * Libellés lisibles des systèmes concernés par un code défaut (§40).
 * Une clé interne ne doit jamais être affichée telle quelle à l'utilisateur.
 */
export const DTC_SYSTEM_LABELS: Record<DtcSystem, { fr: string; en: string }> = {
  moteur: { fr: 'Moteur', en: 'Engine' },
  allumage: { fr: 'Allumage', en: 'Ignition' },
  injection: { fr: 'Injection', en: 'Injection' },
  carburant: { fr: 'Alimentation en carburant', en: 'Fuel system' },
  admission: { fr: 'Admission d’air', en: 'Air intake' },
  echappement: { fr: 'Échappement', en: 'Exhaust' },
  depollution: { fr: 'Dépollution', en: 'Emissions control' },
  transmission: { fr: 'Transmission', en: 'Transmission' },
  freinage: { fr: 'Freinage', en: 'Braking' },
  abs: { fr: 'ABS', en: 'ABS' },
  airbag: { fr: 'Airbags', en: 'Airbags' },
  climatisation: { fr: 'Climatisation', en: 'Air conditioning' },
  electrique: { fr: 'Électricité et électronique', en: 'Electrical and electronic' },
  reseau: { fr: 'Réseau de communication', en: 'Communication network' },
  carrosserie: { fr: 'Carrosserie', en: 'Body' },
};

export interface DtcDefinition {
  code: string;
  /** Libellé technique court (anglais SAE normalisé). */
  technical: string;
  /** Explication en langage simple (§40). */
  simpleFr: string;
  simpleEn: string;
  system: DtcSystem;
  /** Gravité intrinsèque du code, avant même les données du véhicule. */
  severity: SafetyLevel;
  /** Peut-on rouler « par défaut » ? Toujours nuancé par le moteur de sécurité. */
  canDriveDefault: 'yes' | 'with_caution' | 'limited' | 'no' | 'unknown';
  /** Conséquences si on ignore le défaut. */
  consequences: string[];
  /** Test « boîte noire » : le code est-il effacé puis revenu ? */
  likelyCauses: LikelyCause[];
  relatedPids: PidKey[];
  relatedTests: string[];
  /** Codes apparentés (corrélation croisée). */
  relatedCodes?: string[];
  /** Marques souvent concernées — contexte, jamais une conclusion. */
  frequentOn?: string[];
  sourceId: ID;
}

export interface LikelyCause {
  /** Clé normalisée de cause, ex. « ignition_coil_cylinder_1 ». */
  key: string;
  labelFr: string;
  labelEn: string;
  /** Probabilité de base issue de la base de connaissances (0 → 1). */
  baseRate: number;
  /** Causes qui expliquent aussi tel autre code. */
  explainsCodes?: string[];
  /** Test qui permet de confirmer/infirmer cette cause. */
  confirmedBy?: string;
  parts?: string[];
}

export interface Dtc {
  id: ID;
  sessionId: ID;
  vehicleId: ID;
  code: string;
  status: 'active' | 'pending' | 'permanent' | 'stored';
  /** Nombre d'occurrences observées sur la vie du véhicule. */
  occurrences: number;
  firstSeenAt?: ISODate | null;
  lastSeenAt: ISODate;
  freezeFrame?: Record<string, number | string | null>;
  origin: DataOrigin;
  clearedAt?: ISODate | null;
  returnedAfterClear?: boolean;
}

/* ─────────────────────── Moteur de diagnostic (§9, §17) ───────────────────── */

export interface SymptomInput {
  key: SymptomKey;
  present: boolean;
  intensity?: 'light' | 'moderate' | 'severe';
  note?: string;
}

export const SYMPTOM_KEYS = [
  'hard_start',
  'rough_idle',
  'engine_stall',
  'loss_of_power',
  'hesitation_acceleration',
  'excessive_fuel_consumption',
  'black_smoke',
  'white_smoke',
  'blue_smoke',
  'overheating',
  'coolant_loss',
  'oil_light_on',
  'battery_light_on',
  'brake_noise',
  'brake_soft_pedal',
  'vibration',
  'metallic_noise',
  'smell_fuel',
  'smell_burnt',
  'warning_light_flashing',
  'limp_mode',
  'ac_not_cold',
  'jerking',
  'no_start',
] as const;
export type SymptomKey = (typeof SYMPTOM_KEYS)[number];

export interface SymptomDefinition {
  key: SymptomKey;
  labelFr: string;
  labelEn: string;
  /** Orientation immédiate de sécurité, indépendante des DTC. */
  safety: SafetyLevel;
  systems: DtcSystem[];
}

export interface Hypothesis {
  id: string;
  causeKey: string;
  labelFr: string;
  labelEn: string;
  /** Score interne (0 → 1) — expliqué dans `reasoning`, jamais présenté comme certitude. */
  score: number;
  certainty: CertaintyLevel;
  /** Pourquoi cette hypothèse est proposée (trace auditable §47-8). */
  reasoning: string[];
  supporting: string[];
  contradicting: string[];
  /** Tests qui départageraient les hypothèses. */
  discriminatingTests: string[];
  parts: string[];
}

export interface Finding {
  id: ID;
  sessionId: ID;
  kind: 'dtc' | 'pid_anomaly' | 'symptom' | 'history' | 'coherence';
  titleFr: string;
  titleEn: string;
  detailFr: string;
  detailEn: string;
  certainty: CertaintyLevel;
  safety: SafetyLevel;
  /** Codes / PID / symptômes à l'origine du constat. */
  evidence: EvidenceRef[];
  origin: DataOrigin;
}

export interface EvidenceRef {
  kind: 'dtc' | 'pid' | 'symptom' | 'test' | 'history' | 'document';
  ref: string;
  label: string;
  value?: string | number | null;
}

export interface DiagnosticSession {
  id: ID;
  vehicleId: ID;
  userId: ID;
  obdSessionId?: ID | null;
  mode: 'standard' | 'guided' | 'inspection' | 'second_opinion' | 'post_repair';
  status: 'draft' | 'in_progress' | 'completed' | 'abandoned';
  startedAt: ISODate;
  completedAt?: ISODate | null;
  symptoms: SymptomInput[];
  findings: Finding[];
  hypotheses: Hypothesis[];
  certainty: CertaintyLevel;
  safety: SafetyLevel;
  /** Conclusion lisible, jamais plus forte que la certitude affichée. */
  conclusionFr: string;
  conclusionEn: string;
  /** Données manquantes bloquant une conclusion (§16, §47-4). */
  missingData: string[];
  nextSteps: string[];
  rulesFired: string[];
  engineVersion: string;
}

/* ────────────────────── Diagnostic guidé / tests (§17, §18) ───────────────── */

export interface GuidedTestDefinition {
  id: string;
  titleFr: string;
  titleEn: string;
  objectiveFr: string;
  objectiveEn: string;
  /** Matériel nécessaire (peut être vide : contrôle visuel). */
  equipment: string[];
  stepsFr: string[];
  stepsEn: string[];
  /** Résultat attendu si le système est sain. `null` = inconnu (pas d'invention). */
  expectedFr: string | null;
  expectedEn: string | null;
  interpretation: TestInterpretation[];
  safety: SafetyLevel;
  /** Nécessite le contact mis / moteur tournant / moteur chaud. */
  conditions: Array<'engine_off' | 'ignition_on' | 'engine_running' | 'engine_warm'>;
  durationMin: number;
  /** Ce test ne s'applique qu'aux moteurs / systèmes suivants. */
  appliesTo?: { fuelTypes?: FuelType[]; systems?: DtcSystem[] };
  sourceId: ID;
}

export interface TestInterpretation {
  /** Résultat saisi par l'utilisateur. */
  outcome: TestOutcome | 'other';
  meaningFr: string;
  meaningEn: string;
  /** Effet sur le diagnostic : cause confirmée ou écartée. */
  confirms?: string[];
  excludes?: string[];
}

export const TEST_OUTCOMES = [
  'ok',
  'out_of_range',
  'no_signal',
  'visual_damage',
  'intermittent',
  'not_testable',
] as const;
export type TestOutcome = (typeof TEST_OUTCOMES)[number];

export interface DiagnosticTest {
  id: ID;
  sessionId: ID;
  testKey: string;
  proposedAt: ISODate;
  status: 'proposed' | 'accepted' | 'done' | 'skipped';
  result?: TestResult | null;
  priority: number;
  reasonFr: string;
  reasonEn: string;
}

export interface TestResult {
  outcome: TestOutcome;
  measuredValue?: number | null;
  unit?: string | null;
  note?: string | null;
  recordedAt: ISODate;
  origin: DataOrigin;
}

/* ─────────────────────── Réparation & vérification (§19) ──────────────────── */

export interface Repair {
  id: ID;
  vehicleId: ID;
  userId: ID;
  diagnosticSessionId?: ID | null;
  description: string;
  partsReplaced: Array<{ partKey?: string; label: string; reference?: string | null; quantity: number; origin: DataOrigin }>;
  labourHours?: number | null;
  costAmount?: number | null;
  currency?: string | null;
  currencyAmountXof?: number | null;
  garageId?: ID | null;
  performedAt: ISODate;
  performedBy: 'owner' | 'garage' | 'technician' | 'unknown';
  createdAt: ISODate;
}

export interface RepairVerification {
  id: ID;
  repairId: ID;
  vehicleId: ID;
  beforeSessionId?: ID | null;
  afterSessionId?: ID | null;
  verdict: 'resolved' | 'still_present' | 'insufficient_data' | 'new_issue';
  certainty: CertaintyLevel;
  summaryFr: string;
  summaryEn: string;
  dtcBefore: string[];
  dtcAfter: string[];
  dtcResolved: string[];
  dtcRemaining: string[];
  dtcNew: string[];
  valuesChanged: Array<{ key: string; label: string; before: number | null; after: number | null; unit: string; improved: boolean }>;
  symptomsBefore: SymptomInput[];
  symptomsAfter: SymptomInput[];
  /** §33 : origine des mesures comparées (simulated dès qu'une mesure l'est). */
  dataOrigin: DataOrigin;
  createdAt: ISODate;
}

/* ─────────────────────── Entretien & événements (§21, §22) ────────────────── */

export interface MaintenancePlanItem {
  id: ID;
  vehicleId: ID;
  kind: string;
  labelFr: string;
  labelEn: string;
  intervalKm?: number | null;
  intervalMonths?: number | null;
  lastDoneKm?: number | null;
  lastDoneAt?: ISODate | null;
  nextDueKm?: number | null;
  nextDueAt?: ISODate | null;
  status: 'ok' | 'due_soon' | 'overdue' | 'unknown';
  sourceId: ID;
  notes?: string | null;
}

export interface VehicleEvent {
  id: ID;
  vehicleId: ID;
  type:
    | 'vehicle_created'
    | 'scan'
    | 'diagnostic'
    | 'test'
    | 'repair'
    | 'verification'
    | 'maintenance'
    | 'inspection'
    | 'document'
    | 'quote'
    | 'alert'
    | 'note';
  titleFr: string;
  titleEn: string;
  detail?: string | null;
  refId?: ID | null;
  odometerKm?: number | null;
  occurredAt: ISODate;
  origin: DataOrigin;
}

export interface VehicleDocument {
  id: ID;
  vehicleId: ID;
  kind: 'carte_grise' | 'assurance' | 'facture' | 'rapport_diagnostic' | 'rapport_inspection' | 'photo' | 'autre';
  title: string;
  url?: string | null;
  mimeType?: string | null;
  issuedAt?: ISODate | null;
  createdAt: ISODate;
}

export interface Alert {
  id: ID;
  userId: ID;
  vehicleId?: ID | null;
  level: SafetyLevel;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
  createdAt: ISODate;
  readAt?: ISODate | null;
  refId?: ID | null;
  kind: 'maintenance' | 'dtc_return' | 'inspection' | 'security' | 'info';
}

/* ────────────────────── « Puis-je rouler ? » (§12) ────────────────────────── */

export interface CanIDriveAnswer {
  level: SafetyLevel;
  /** Réponse courte et prudente. */
  headlineFr: string;
  headlineEn: string;
  whyFr: string[];
  whyEn: string[];
  toCheckFr: string[];
  toCheckEn: string[];
  avoidFr: string[];
  avoidEn: string[];
  seeProfessionalFr: string;
  seeProfessionalEn: string;
  /** Niveau de confiance dans la RÉPONSE elle-même. */
  certainty: CertaintyLevel;
  /** §12 : XAMOTO ne garantit pas la sécurité si les données manquent. */
  disclaimerFr: string;
  disclaimerEn: string;
  dataUsed: EvidenceRef[];
  missingData: string[];
}

/* ─────────────────────────── Rapports (§25) ───────────────────────────────── */

export interface DiagnosticReport {
  id: ID;
  vehicleId: ID;
  userId: ID;
  sessionId: ID;
  title: string;
  kind: 'diagnostic' | 'inspection' | 'repair_verification' | 'maintenance' | 'passport';
  generatedAt: ISODate;
  odometerKm: number;
  payload: ReportPayload;
  shareToken?: string | null;
  qrDataUrl?: string | null;
  publicUrl?: string | null;
}

export interface ReportPayload {
  vehicle: Pick<Vehicle, 'brand' | 'model' | 'year' | 'engine' | 'fuelType' | 'vin' | 'plate' | 'odometerKm'>;
  diagnosis: {
    conclusionFr: string;
    conclusionEn: string;
    certainty: CertaintyLevel;
    safety: SafetyLevel;
  };
  dtcs: Array<{ code: string; technical: string; simpleFr: string; status: string; severity: SafetyLevel }>;
  measurements: Array<{ label: string; value: number | null; unit: string; supported: boolean; origin: DataOrigin; capturedAt: ISODate }>;
  findings: Finding[];
  hypotheses: Hypothesis[];
  tests: Array<{ testKey: string; title: string; status: string; outcome?: string | null; note?: string | null }>;
  recommendations: string[];
  missingData: string[];
  canIDrive?: CanIDriveAnswer;
  sources: Array<{ id: string; title: string; publisher: string; reliability: SourceReliability; version: string; date: ISODate }>;
  generatedBy: string;
  disclaimerFr: string;
}

export interface InspectionReport {
  id: ID;
  vehicleId: ID;
  userId: ID;
  sessionId?: ID | null;
  targetVehicle: { brand: string; model: string; year: number; odometerKm: number; vin?: string | null; plate?: string | null };
  scores: { overall: number; engine: number; emissions: number; electrical: number; dataCoherence: number };
  checklist: Array<{ key: string; labelFr: string; labelEn: string; verdict: 'ok' | 'watch' | 'problem' | 'not_checked'; detail?: string }>;
  redFlags: string[];
  notes: string[];
  createdAt: ISODate;
}

/* ────────────────────── Garages, devis, pièces (§26-28) ───────────────────── */

export interface Garage {
  id: ID;
  name: string;
  city: string;
  country: string;
  lat?: number | null;
  lon?: number | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  brands: string[];
  specialties: string[];
  equipment: string[];
  services: string[];
  openingHours?: string | null;
  verified: boolean;
  rating?: number | null;
  /**
   * Le garage peut-il recevoir un diagnostic XAMOTO ?
   * Aucune transmission sans autorisation explicite de l'utilisateur (§38).
   */
  acceptsXamotoDiagnostics: boolean;
}

export interface Quote {
  id: ID;
  userId: ID;
  vehicleId: ID;
  diagnosticSessionId?: ID | null;
  garageId: ID;
  status: 'draft' | 'requested' | 'received' | 'accepted' | 'declined';
  requestedAt: ISODate;
  receivedAt?: ISODate | null;
  lines: Array<{
    kind: 'part' | 'labour' | 'diagnostic' | 'other';
    label: string;
    reference?: string | null;
    quantity: number;
    unitPrice: number;
    /** Devise locale — XOF par défaut (§39). */
    currency: string;
  }>;
  warrantyMonths?: number | null;
  delayDays?: number | null;
  /** Comparaison factuelle uniquement : XAMOTO ne juge pas « bon » ou « mauvais » (§27). */
  factualSummaryFr?: string | null;
}

export interface Part {
  id: ID;
  key: string;
  nameFr: string;
  nameEn: string;
  category: string;
  oemReferences: string[];
  equivalents: string[];
  fitsBrands: string[];
  fitsEngines: string[];
  fitsYearFrom?: number | null;
  fitsYearTo?: number | null;
  /** Indice de disponibilité locale, saisi par les partenaires XAMOTO. */
  availabilitySn: 'high' | 'medium' | 'low' | 'unknown';
  typicalPriceXof?: number | null;
  sourceId: ID;
}

export interface PartCompatibility {
  id: ID;
  partKey: string;
  brand: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  engine: string;
  verified: boolean;
  sourceId: ID;
}

/* ────────────────────────────── IA (§13-16) ───────────────────────────────── */

export interface AiConversation {
  id: ID;
  userId: ID;
  vehicleId?: ID | null;
  diagnosticSessionId?: ID | null;
  title: string;
  locale: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface AiContextPack {
  vehicle?: Partial<Vehicle> | null;
  spec?: Partial<VehicleSpec> | null;
  session?: Partial<DiagnosticSession> | null;
  /**
   * Réponse « Puis-je rouler ? » déjà calculée par le moteur de sécurité (§12).
   * L'IA la RESTITUE, elle ne la recalcule jamais et ne peut pas la renforcer.
   */
  canIDrive?: CanIDriveAnswer | null;
  dtcs: Array<Pick<Dtc, 'code' | 'status' | 'occurrences'> & { lastSeenAt?: ISODate | null }>;
  readings: Array<Pick<ObdReading, 'key' | 'label' | 'value' | 'unit' | 'supported' | 'capturedAt'>>;
  symptoms: SymptomInput[];
  hypotheses: Hypothesis[];
  findings: Finding[];
  repairs: Array<Pick<Repair, 'description' | 'performedAt'>>;
  tests: Array<{ testKey: string; status: string; outcome?: string | null }>;
  maintenance: Array<Pick<MaintenancePlanItem, 'labelFr' | 'labelEn' | 'status' | 'nextDueKm' | 'nextDueAt'>>;
  history: Array<Pick<VehicleEvent, 'type' | 'titleFr' | 'occurredAt'>>;
  mode: 'obd' | 'simulator' | 'none';
}

export interface KnowledgeSource {
  id: ID;
  title: string;
  publisher: string;
  reliability: SourceReliability;
  version: string;
  date: ISODate;
  url?: string | null;
  licence?: string | null;
}

export interface KnowledgeDocument {
  id: ID;
  sourceId: ID;
  titleFr: string;
  titleEn: string;
  contentFr: string;
  contentEn: string;
  tags: string[];
  /** Codes DTC, moteurs, marques concernés. */
  relatesTo: { dtc?: string[]; systems?: DtcSystem[]; brands?: string[]; fuelTypes?: FuelType[] };
  /** Versionné et daté (§15). */
  version: string;
  updatedAt: ISODate;
}

export interface AiCitation {
  documentId: string;
  sourceId: string;
  title: string;
  publisher: string;
  reliability: SourceReliability;
  score: number;
  snippet: string;
}

export interface AiMessage {
  id: ID;
  conversationId: ID;
  role: 'user' | 'assistant' | 'system';
  contentFr: string;
  contentEn: string;
  createdAt: ISODate;
  /** Preuve : ce que l'IA a utilisé, et si elle a refusé de répondre. */
  citations: AiCitation[];
  usedContext: string[];
  refused: boolean;
  refusalReasonFr?: string | null;
  refusalReasonEn?: string | null;
  structured?: {
    certainty?: CertaintyLevel;
    safety?: SafetyLevel;
    hypotheses?: Array<{ label: string; certainty: CertaintyLevel; score: number }>;
    tests?: string[];
    nextSteps?: string[];
  } | null;
  /** Réponse générée par un LLM ou composée par le moteur déterministe. */
  engine: 'deterministic' | 'llm';
  validation?: {
    checked: boolean;
    passed: boolean;
    violations: string[];
  } | null;
}

/* ────────────────────────── Synchronisation (§29) ─────────────────────────── */

export interface SyncOperation {
  id: ID;
  clientId: string;
  entity: 'vehicle' | 'scan' | 'diagnostic' | 'repair' | 'maintenance' | 'event' | 'inspection';
  action: 'create' | 'update' | 'delete';
  payload: unknown;
  createdAt: ISODate;
  status: 'pending' | 'applied' | 'conflict' | 'rejected';
  conflictReason?: string | null;
}

/* ───────────────────────────── API : enveloppes ───────────────────────────── */

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
