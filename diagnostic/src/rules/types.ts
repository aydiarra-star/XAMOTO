/**
 * XAMOTO — Moteur de règles (§9).
 *
 * Le diagnostic NE repose PAS sur une IA générative. Il repose sur :
 *   données véhicule → DTC → PID → symptômes → historique → règles techniques
 *   → base de connaissances → tests guidés → moteur de diagnostic → IA explicative.
 *
 * Une règle est une fonction pure : elle reçoit un contexte, elle ne renvoie
 * que des effets typés. Elle ne produit jamais de texte libre destiné à
 * l'utilisateur sans passer par les niveaux de certitude et de sécurité.
 */
import type {
  CertaintyLevel,
  DataOrigin,
  DtcSystem,
  EvidenceRef,
  Finding,
  FuelType,
  PidKey,
  SafetyLevel,
  SymptomInput,
  TestOutcome,
  Vehicle,
  VehicleSpec,
} from '@xamoto/shared';

/** Mesure d'un PID, éventuellement accompagnée d'une série temporelle. */
export interface ReadingInput {
  key: PidKey;
  label: string;
  value: number | null;
  unit: string;
  supported: boolean;
  origin: DataOrigin;
  condition?: 'cold' | 'warm' | 'running' | 'idle' | 'unknown';
  /** Relevés successifs (détection d'activité sonde O2, stabilité du ralenti…). */
  series?: number[];
  /** Valeurs de référence lorsqu'elles sont documentées pour ce moteur. */
  ref?: { normalMin?: number; normalMax?: number };
  capturedAt?: string;
}

export interface DtcInput {
  code: string;
  status: 'active' | 'pending' | 'permanent' | 'stored';
  occurrences: number;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  /** Mémorisé puis effacé, puis revenu : information de grande valeur (§19). */
  returnedAfterClear?: boolean;
  freezeFrame?: Record<string, number | string | null>;
  origin: DataOrigin;
}

export interface HistoryInput {
  /** Scans antérieurs du même véhicule (du plus ancien au plus récent). */
  previousScans?: Array<{
    id: string;
    finishedAt: string;
    dtcCodes: string[];
    keyValues?: Record<string, number | null>;
  }>;
  /** Réparations déjà effectuées. */
  repairs?: Array<{ id: string; description: string; performedAt: string; partsLabels?: string[] }>;
  /** Codes déjà effacés puis revenus sur ce véhicule. */
  returnedCodes?: string[];
  /** Kilométrage parcouru depuis la dernière intervention. */
  kmSinceLastRepair?: number | null;
}

export interface DiagnosticContext {
  vehicle?: (Partial<Vehicle> & { fuelType?: FuelType; year?: number; engine?: string }) | null;
  spec?: Partial<VehicleSpec> | null;
  readings: ReadingInput[];
  dtcs: DtcInput[];
  symptoms: SymptomInput[];
  history?: HistoryInput;
  /** Origine globale de la session. */
  source: 'obd' | 'simulator' | 'manual' | 'none';
  /** Résultats de tests déjà enregistrés dans cette session. */
  testResults?: Array<{ testKey: string; outcome: TestOutcome; note?: string | null }>;
  /** Mode d'analyse demandé. */
  mode?: 'standard' | 'guided' | 'inspection' | 'second_opinion' | 'post_repair';
  /** Résultat d'un diagnostic existant (deuxième avis, §20). */
  previousDiagnosis?: {
    conclusionFr: string;
    certainty: CertaintyLevel;
    causes: string[];
    proposedRepair?: string | null;
  } | null;
}

/* ─────────────────────────────── Effets de règle ───────────────────────────── */

export interface CauseEffect {
  causeKey: string;
  labelFr: string;
  labelEn: string;
  /** Contribution au score (0 → 1). */
  delta: number;
  /** Nature de l'apport, pour la traçabilité (§47-8). */
  weight: 'measured' | 'documented' | 'symptom' | 'history' | 'test';
  reasonFr: string;
  reasonEn: string;
  /** Preuves associées (une ou plusieurs). */
  evidence?: EvidenceRef[];
  /** Test qui confirmerait la cause. */
  confirmedByTest?: string;
  parts?: string[];
}

export type RuleEffect =
  | {
      kind: 'finding';
      finding: {
        kind: Finding['kind'];
        titleFr: string;
        titleEn: string;
        detailFr: string;
        detailEn: string;
        certainty: CertaintyLevel;
        safety: SafetyLevel;
        evidence: EvidenceRef[];
        origin: DataOrigin;
      };
    }
  | { kind: 'cause'; cause: CauseEffect }
  /** Cause qui ne doit pas être retenue (test négatif, réparation réussie…). */
  | { kind: 'excludeCause'; causeKey: string; reasonFr: string; reasonEn: string }
  | {
      kind: 'safety';
      level: SafetyLevel;
      reasonFr: string;
      reasonEn: string;
      evidence?: EvidenceRef[];
    }
  | {
      kind: 'test';
      testKey: string;
      priority: number;
      reasonFr: string;
      reasonEn: string;
      /** La cause visée par ce test (affichage « à quoi sert ce test »). */
      forCause?: string;
    }
  | { kind: 'missing'; itemFr: string; itemEn: string; blocksConclusion: boolean }
  | { kind: 'note'; textFr: string; textEn: string; level?: SafetyLevel }
  | { kind: 'certaintyCap'; level: CertaintyLevel; reasonFr: string; reasonEn: string };

export interface Rule {
  id: string;
  /** Domaine lisible (affiché dans la trace d'audit). */
  domain: 'dtc' | 'mesure' | 'symptome' | 'historique' | 'coherence' | 'securite' | 'contexte' | 'guidage';
  /**
   * Systèmes du véhicule concernés (§15). Renseigné pour les règles qui portent
   * une lecture PAR SYSTÈME (freinage, réseau, transmission, climatisation…) :
   * c'est ce qui permet de dire ce que XAMOTO sait lire — et ce qu'il ne peut
   * pas lire — sur chaque partie du véhicule, sans le deviner.
   */
  systems?: DtcSystem[];
  titleFr: string;
  titleEn: string;
  /** Source de la règle (§33). */
  sourceId: string;
  applies: (ctx: DiagnosticContext) => boolean;
  apply: (ctx: DiagnosticContext) => RuleEffect[];
}

/** Utilitaire : convertit une mesure en preuve affichable. */
export function pidEvidence(reading: ReadingInput): EvidenceRef {
  return {
    kind: 'pid',
    ref: reading.key,
    label: reading.label,
    value: reading.value === null ? null : `${reading.value} ${reading.unit}`.trim(),
  };
}

export function dtcEvidence(code: string, label: string): EvidenceRef {
  return { kind: 'dtc', ref: code, label };
}

export function symptomEvidence(symptom: SymptomInput, label: string): EvidenceRef {
  return { kind: 'symptom', ref: symptom.key, label };
}

/** Systèmes concernés par les codes présents (utile au raisonnement croisé). */
export function systemsFromCodes(codes: string[]): DtcSystem[] {
  const map: Record<string, DtcSystem> = {
    P01: 'carburant',
    P02: 'injection',
    P03: 'allumage',
    P04: 'depollution',
    P05: 'moteur',
    P06: 'electrique',
    P07: 'transmission',
    P0A: 'electrique',
    C0: 'freinage',
    U0: 'reseau',
    B0: 'carrosserie',
  };
  const systems = new Set<DtcSystem>();
  for (const code of codes) {
    const prefix = code.slice(0, 3).toUpperCase();
    const system = map[prefix];
    if (system) systems.add(system);
  }
  return [...systems];
}
