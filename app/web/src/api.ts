/**
 * XAMOTO — Client API de l'interface web.
 *
 * Règle : toutes les requêtes utilisent des URL RELATIVES (`/api/...`).
 * L'application ne connaît ni port ni hôte : en développement Vite relaie vers
 * le serveur, en production le serveur sert l'interface et l'API sur le même
 * domaine. Le navigateur n'appelle donc jamais `localhost`.
 *
 * Les types ci-dessous reprennent exactement les réponses du backend
 * (`backend/src/routes/*`) : aucune donnée n'est ajoutée côté client.
 */

const TOKEN_KEY = 'xamoto.token';
const LOCALE_KEY = 'xamoto.locale';

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* stockage indisponible : la session reste en mémoire */
  }
}

export function getStoredLocale(): 'fr' | 'en' | 'wo' {
  try {
    const value = window.localStorage.getItem(LOCALE_KEY);
    // Toute langue enregistrée est respectée ; une valeur inconnue retombe sur
    // le français, langue de référence.
    return value === 'en' || value === 'wo' ? value : 'fr';
  } catch {
    return 'fr';
  }
}

export function setStoredLocale(locale: 'fr' | 'en' | 'wo'): void {
  try {
    window.localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* ignoré */
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (error) {
    throw new ApiError(
      0,
      'network',
      'Connexion impossible au serveur XAMOTO. Vérifiez votre réseau : les données déjà enregistrées restent disponibles.',
      error,
    );
  }

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const errorBody = (payload.error ?? {}) as { code?: string; message?: string };
    throw new ApiError(response.status, errorBody.code ?? 'error', errorBody.message ?? `Erreur ${response.status}`, payload);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

/* ────────────────────────────── Types partagés ───────────────────────────── */

export type CertaintyLevel = 'confirmed' | 'strongly_compatible' | 'possible' | 'undeterminable' | 'unavailable';
export type SafetyLevel = 'normal' | 'attention' | 'important' | 'critical';
export type DataOrigin = 'measured' | 'documented' | 'calculated' | 'estimated' | 'simulated' | 'unknown';
export type TestOutcome = 'ok' | 'out_of_range' | 'intermittent' | 'not_testable' | 'no_signal' | 'visual_damage' | 'other';

export interface ApiEvidence {
  kind: string;
  ref: string;
  label: string;
  value?: string | number | null;
}

export interface ApiSpec {
  oilSpec: string | null;
  oilCapacityL: number | null;
  coolantSpec: string | null;
  timingType: string | null;
  timingIntervalKm: number | null;
  sparkPlugSpec: string | null;
  commonIssues: string[];
  sourceId: string;
}

export interface ApiVehicle {
  id: string;
  brand: string;
  model: string;
  generation: string | null;
  year: number;
  engine: string;
  engineDisplacementCc: number | null;
  fuelType: string;
  gearbox: string;
  powerHp: number | null;
  vin: string | null;
  plate: string;
  country: string;
  purchaseDate: string | null;
  odometerKm: number;
  odometerUpdatedAt: string | null;
  nickname: string;
  obdProtocol: string | null;
  supportedPids: string[];
  createdAt: string;
  updatedAt: string;
  spec: ApiSpec | null;
  permission?: string;
}

export interface ApiMaintenanceItem {
  id: string;
  vehicleId: string;
  kind: string;
  labelFr: string;
  labelEn: string;
  intervalKm: number | null;
  intervalMonths: number | null;
  lastDoneKm: number | null;
  lastDoneAt: string | null;
  nextDueKm: number | null;
  nextDueAt: string | null;
  status: 'ok' | 'due_soon' | 'overdue' | 'unknown';
  sourceId: string;
  notes: string | null;
  rangeFr: string;
  rangeEn: string;
  notesFr: string | null;
  notesEn: string | null;
  explanationFr: string;
  explanationEn: string;
  origin: DataOrigin;
}

export interface ApiUsageFactors {
  dusty: boolean;
  mostlyCity: boolean;
  heavyHeat: boolean;
  shortTrips: boolean;
  noteFr: string;
}

export interface ApiTrend {
  key: string;
  label: string;
  unit: string;
  samples: number;
  first: number;
  last: number;
  delta: number;
  direction: 'up' | 'down' | 'stable';
  origin: DataOrigin;
  interpretationFr: string;
}

export interface ApiPassportEvent {
  id: string;
  type: string;
  titleFr: string;
  titleEn: string;
  detail: string | null;
  refId: string | null;
  odometerKm: number | null;
  occurredAt: string;
  origin: DataOrigin;
}

export interface ApiScanSummary {
  id: string;
  vehicleId?: string;
  source: 'obd' | 'simulator';
  scenario: string | null;
  protocol: string | null;
  startedAt: string;
  status: string;
  milOn: boolean;
  pidCount: number;
  dtcCount: number;
}

export interface ApiReading {
  key: string;
  obdPid: string;
  label: string;
  value: number | null;
  unit: string;
  supported: boolean;
  origin: DataOrigin;
  condition?: string | null;
  series?: number[];
  capturedAt?: string;
}

export interface ApiDtc {
  code: string;
  status: string;
  occurrences: number;
  freezeFrame?: Record<string, number> | null;
  origin: DataOrigin;
  lastSeenAt?: string | null;
  returnedAfterClear?: boolean;
}

export interface ApiTest {
  id: string;
  testKey: string;
  titleFr: string;
  titleEn: string;
  objectiveFr: string | null;
  objectiveEn: string | null;
  equipment: string[];
  durationMin: number | null;
  safety: SafetyLevel;
  status: string;
  priority: number;
  reasonFr: string;
  reasonEn: string;
  proposedAt?: string;
  result: {
    outcome: TestOutcome;
    measuredValue: number | null;
    unit: string | null;
    note: string | null;
    origin: DataOrigin;
    recordedAt: string;
  } | null;
}

export interface ApiHypothesis {
  id: string;
  causeKey: string;
  labelFr: string;
  labelEn: string;
  score: number;
  certainty: CertaintyLevel;
  reasoning: string[];
  supporting: string[];
  contradicting: string[];
  discriminatingTests: string[];
  parts: string[];
}

export interface ApiFinding {
  id: string;
  kind: string;
  titleFr: string;
  titleEn: string;
  detailFr: string;
  detailEn: string;
  certainty: CertaintyLevel;
  safety: SafetyLevel;
  evidence: ApiEvidence[];
  origin: DataOrigin;
}

export interface ApiCanIDrive {
  level: SafetyLevel;
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
  certainty: CertaintyLevel;
  disclaimerFr: string;
  disclaimerEn: string;
  dataUsed: ApiEvidence[];
  missingData: string[];
}

export interface ApiDiagnostic {
  id: string;
  vehicleId: string;
  userId?: string;
  obdSessionId: string | null;
  mode: string;
  status?: string;
  startedAt: string;
  completedAt?: string | null;
  certainty: CertaintyLevel;
  safety: SafetyLevel;
  conclusionFr: string;
  conclusionEn: string;
  canIDrive: ApiCanIDrive | null;
  symptoms?: Array<{ key: string; present: boolean }>;
  missingData: Array<{ fr: string; en: string; blocksConclusion: boolean }>;
  nextSteps: string[];
  rulesFired: string[];
  engineVersion: string;
  dataOrigin: string;
  hypotheses: ApiHypothesis[];
  findings: ApiFinding[];
  tests: ApiTest[];
  disclaimerFr?: string;
}

export interface ApiGuidedStep {
  index: number;
  kind: string;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
  question?: { fr: string; en: string } | null;
  symptomsToAsk?: string[];
}

export interface ApiGuidedSession {
  steps: ApiGuidedStep[];
  nextStep: ApiGuidedStep | null;
  totalSteps: number;
  progressPercent: number;
}

export interface ApiScanResult {
  sessionId: string;
  diagnosticSessionId: string;
  source: 'obd' | 'simulator';
  scenario: string | null;
  protocol: string | null;
  milOn: boolean;
  startedAt: string;
  finishedAt?: string;
  device?: { id?: string; name?: string; protocol?: string } | null;
  readings: ApiReading[];
  dtcs: ApiDtc[];
  unsupportedPids: string[];
  warnings: string[];
  notes: Array<{ fr: string; en: string }>;
  diagnostic: ApiDiagnostic | Record<string, unknown>;
  simulationNotice: string | null;
}

export interface ApiScanDetail {
  scan: ApiScanSummary & { endedAt?: string | null };
  readings: ApiReading[];
  dtcs: ApiDtc[];
  diagnosticSessionId: string | null;
  simulationNotice: string | null;
  provenance?: Record<string, unknown>;
}

/** Adaptateurs OBD proposés par le serveur (§7, §29). */
export interface ApiObdCandidates {
  hosts: string[];
  ports: number[];
  notice: string;
  bluetooth: {
    available: boolean;
    drivers: Array<{ id: string; label: string; kinds: string[]; available: boolean }>;
    noticeFr: string;
    noticeEn: string;
    hintFr: string | null;
    hintEn: string | null;
  };
}

/**
 * Appareils Bluetooth renvoyés par un pilote de plateforme. La disponibilité est
 * un fait observé ; la compatibilité OBD reste une présomption (§47).
 */
export interface ApiBluetoothDevices {
  available: boolean;
  devices: Array<{
    address: string;
    name: string;
    kind: 'spp' | 'ble';
    paired: boolean;
    rssi: number | null;
    likelyObdAdapter: boolean;
    reasonFr: string;
    reasonEn: string;
  }>;
  noticeFr: string;
  noticeEn: string;
  hintFr: string | null;
  hintEn: string | null;
  certaintyFr: string;
  certaintyEn: string;
}

/**
 * Couverture par système (§15) : ce que XAMOTO sait lire, et ce qu'il ne sait
 * pas lire. `readability` distingue une lecture complète d'une lecture partielle
 * ou impossible — jamais présentée comme un « système sain ».
 */
export interface ApiSystemCoverage {
  system: string;
  readability: 'codes_and_data' | 'codes_only' | 'limited' | 'not_accessible';
  whatObdGivesFr: string;
  whatObdGivesEn: string;
  limitsFr: string;
  limitsEn: string;
  tests: string[];
  sourceId: string;
  ruleIds: string[];
  genericRuleCount: number;
}

export interface ApiScenario {
  id: string;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
  vehicle: { brand: string; model: string; year: number; engine: string; fuelType: string; plate: string; vin: string };
  dtcCodes: string[];
  symptoms: string[];
  unsupportedPids: string[];
}

export interface ApiSymptom {
  key: string;
  labelFr: string;
  labelEn: string;
  systems: string[];
  safety: SafetyLevel;
}

export interface ApiGarage {
  id: string;
  name: string;
  city: string;
  country: string;
  phone: string | null;
  whatsapp: string | null;
  brands: string[];
  specialties: string[];
  equipment: string[];
  services: string[];
  openingHours: string | null;
  verified: boolean;
  rating: number | null;
  acceptsXamotoDiagnostics: boolean;
  lat: number | null;
  lon: number | null;
  distanceKm?: number;
}

export interface ApiPart {
  id: string;
  partKey: string;
  nameFr: string;
  nameEn: string;
  category: string;
  oemReferences: string[];
  equivalents: string[];
  brands: string[];
  engines: string[];
  availabilitySn: string | null;
  typicalPriceXof: number | null;
  sourceId: string;
}

/**
 * Devis (§27).
 *
 * Un devis est une donnée DÉCLARÉE par un garage : XAMOTO l'enregistre, la
 * relie aux mesures quand c'est possible, et ne porte aucun jugement de valeur.
 * `analysis` ne dit jamais « cher » ou « injustifié » : elle dit ce qui est
 * soutenu par une donnée mesurée, et ce qu'il reste à demander.
 */
export interface ApiQuoteLine {
  label: string;
  partReference?: string;
  quantity: number;
  unitAmount: number;
  currency: string;
}

export interface ApiQuote {
  id: string;
  vehicleId: string;
  garageId: string;
  diagnosticSessionId: string | null;
  status: 'draft' | 'requested' | 'received' | 'accepted' | 'declined';
  lines: ApiQuoteLine[];
  warrantyMonths: number | null;
  delayDays: number | null;
  factualSummary: string | null;
  requestedAt: string | null;
  receivedAt: string | null;
}

export interface ApiQuoteAnalysisLine {
  label: string;
  quantity: number;
  unitAmount: number | null;
  currency: string;
  /** Vrai quand la ligne rejoint un élément réellement mesuré sur le véhicule. */
  linkedToMeasuredData: boolean;
  matchedElements: string[];
  /** Question à poser au garage quand aucun lien n'a été trouvé. */
  questionToAsk: string | null;
}

export interface ApiQuoteAnalysis {
  quote: {
    id: string;
    status: string;
    garageId: string;
    diagnosticSessionId: string | null;
    receivedAt: string | null;
    warrantyMonths: number | null;
    delayDays: number | null;
  };
  analysis: ApiQuoteAnalysisLine[];
  summary: {
    totalLines: number;
    linesLinkedToMeasuredData: number;
    linesNotLinked: number;
    dataOrigin: string;
    certainty: string;
  };
  noticeFr: string;
  questionsFr: string[];
}

export interface ApiAlert {
  id: string;
  vehicleId: string | null;
  level: SafetyLevel;
  kind: string;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
  refId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface ApiAnswer {
  conversationId: string;
  intent: string;
  answerFr: string;
  answerEn: string;
  refused: boolean;
  refusalReasonFr: string | null;
  refusalReasonEn: string | null;
  structured: { hypotheses?: unknown[]; tests?: unknown[]; nextSteps?: string[]; certainty?: CertaintyLevel; safety?: SafetyLevel };
  engine: 'deterministic' | 'llm' | string;
  citations: Array<{ documentId: string; sourceId: string; title: string; publisher: string; reliability: string; score: number; snippet: string }>;
  usedContext: string[];
  dataDisclosure: { availableFacts: string[]; missingFacts: string[] };
  llm: { available: boolean; used: boolean; rejected: boolean; error?: string };
  validation: { checked: boolean; passed: boolean; violations: Array<{ type: string; severity: string; detailFr: string }> } | null;
  /** Langue réellement utilisée pour la réponse, et raison de l'écart éventuel. */
  language: { requested: 'fr' | 'en' | 'wo'; effective: 'fr' | 'en'; fallback: boolean; noticeFr: string; noticeEn: string; notice: string };
  contextAudit: string;
}

export interface ApiReportPayload {
  kind?: string;
  generatedAt?: string;
  [key: string]: unknown;
}

export interface ApiReportSummary {
  id: string;
  vehicleId: string | null;
  sessionId: string | null;
  kind: string;
  title: string;
  vehicle: string | null;
  shareToken: string | null;
  generatedAt: string;
}

export interface ApiInspection {
  id?: string;
  vehicleId?: string;
  sessionId?: string | null;
  targetVehicle: { brand: string; model: string; year: number; odometerKm: number; vin: string | null; plate?: string };
  scores: { overall: number; engine: number; emissions: number; electrical: number; dataCoherence: number };
  checklist: Array<{ key: string; labelFr: string; labelEn: string; verdict: 'ok' | 'watch' | 'problem' | 'not_checked'; detail?: string | null }>;
  redFlags: string[];
  notes: string[];
  sellerClaims?: string[];
  createdAt?: string;
}
