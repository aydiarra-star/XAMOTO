/**
 * XAMOTO — Moteur de sécurité (§11, §12).
 *
 * Principe : la sécurité ne dépend PAS de la certitude du diagnostic.
 * Un voyant de pression d'huile, une surchauffe ou une pédale de frein molle
 * imposent une consigne immédiate, même sans aucun code défaut et même si
 * XAMOTO n'a pas encore identifié la cause.
 *
 * Le moteur ne dit jamais « tout va bien » à partir de rien : quand les données
 * manquent, il le dit et refuse de garantir (§47-4).
 */
import type { CertaintyLevel, EvidenceRef, SafetyLevel } from '@xamoto/shared';
import { MESSAGES, SAFETY_LABELS, safetyAtLeast, worstSafety } from '@xamoto/shared';
import { findDtcKnowledge } from '../knowledge/dtc.js';
import { SYMPTOM_BY_KEY } from '../knowledge/symptoms.js';
import type { DiagnosticContext } from '../rules/types.js';

export interface SafetyReason {
  fr: string;
  en: string;
  level: SafetyLevel;
  evidence?: EvidenceRef[];
}

export interface SafetyAssessment {
  level: SafetyLevel;
  reasons: SafetyReason[];
  /** Consignes immédiates, en clair. */
  immediateAdvice: Array<{ fr: string; en: string }>;
  /** §12 : XAMOTO ne peut pas garantir la sécurité lorsque les données manquent. */
  cannotGuarantee: boolean;
  /** Qualité des données ayant servi à l'évaluation. */
  dataQuality: {
    readings: number;
    supportedReadings: number;
    dtcs: number;
    symptoms: number;
    certainty: CertaintyLevel;
    notes: string[];
  };
}

/** Seuils mesurés qui déclenchent une consigne, indépendamment du diagnostic. */
const MEASURED_THRESHOLDS: Array<{
  key: string;
  test: (value: number) => boolean;
  level: SafetyLevel;
  fr: string;
  en: string;
}> = [
  {
    key: 'coolant_temp',
    test: (v) => v >= 112,
    level: 'critical',
    fr: 'Température de liquide de refroidissement mesurée ≥ 112 °C : arrêtez le moteur dès que c’est possible en sécurité.',
    en: 'Measured coolant temperature ≥ 112 °C: stop the engine as soon as it is safe to do so.',
  },
  {
    key: 'coolant_temp',
    test: (v) => v >= 105 && v < 112,
    level: 'important',
    fr: 'Température de liquide de refroidissement élevée (≥ 105 °C) : surveillez immédiatement, coupez la climatisation et évitez les efforts moteur.',
    en: 'High coolant temperature (≥ 105 °C): monitor immediately, switch off the A/C and avoid engine load.',
  },
  {
    key: 'battery_voltage',
    test: (v) => v < 11.8,
    level: 'important',
    fr: 'Tension batterie très basse (< 11,8 V) : le véhicule peut s’arrêter ou ne plus redémarrer.',
    en: 'Very low battery voltage (< 11.8 V): the vehicle may stall or fail to restart.',
  },
  {
    key: 'oil_pressure',
    test: (v) => v > 0 && v < 0.8,
    level: 'critical',
    fr: 'Pression d’huile insuffisante mesurée : coupez le moteur dès que c’est possible en sécurité.',
    en: 'Measured oil pressure too low: stop the engine as soon as it is safe to do so.',
  },
];

const GUARANTEE_KEYS = ['coolant_temp', 'battery_voltage', 'engine_rpm'];

export function assessSafety(ctx: DiagnosticContext, ruleReasons: SafetyReason[] = []): SafetyAssessment {
  const reasons: SafetyReason[] = [...ruleReasons];
  const immediateAdvice: Array<{ fr: string; en: string }> = [];
  const notes: string[] = [];
  const levels: SafetyLevel[] = ruleReasons.map((r) => r.level);

  /* ── 1. Mesures qui imposent une consigne (indépendantes du diagnostic) ── */
  for (const threshold of MEASURED_THRESHOLDS) {
    const reading = ctx.readings.find((r) => r.key === threshold.key);
    if (!reading || !reading.supported || reading.value === null) continue;
    if (!threshold.test(reading.value)) continue;
    levels.push(threshold.level);
    reasons.push({
      fr: threshold.fr,
      en: threshold.en,
      level: threshold.level,
      evidence: [{ kind: 'pid', ref: reading.key, label: reading.label, value: `${reading.value} ${reading.unit}` }],
    });
  }

  /* ── 2. Symptômes déclarés (§12 : un symptôme critique suffit) ─────────── */
  for (const symptom of ctx.symptoms) {
    if (!symptom.present) continue;
    const definition = SYMPTOM_BY_KEY.get(symptom.key);
    if (!definition) continue;
    if (definition.safety === 'normal') continue;
    levels.push(definition.safety);
    reasons.push({
      fr: `Symptôme déclaré : ${definition.labelFr}.`,
      en: `Reported symptom: ${definition.labelEn}.`,
      level: definition.safety,
      evidence: [{ kind: 'symptom', ref: symptom.key, label: definition.labelFr }],
    });
  }

  /* ── 3. Gravité documentée des codes défaut présents ───────────────────── */
  for (const dtc of ctx.dtcs) {
    const knowledge = findDtcKnowledge(dtc.code);
    if (knowledge) {
      if (knowledge.severity === 'normal') continue;
      levels.push(knowledge.severity);
      reasons.push({
        fr: `${dtc.code} — ${knowledge.simpleFr}`,
        en: `${dtc.code} — ${knowledge.simpleEn}`,
        level: knowledge.severity,
        evidence: [{ kind: 'dtc', ref: dtc.code, label: knowledge.simpleFr }],
      });
      if (knowledge.canDriveDefault === 'no') {
        immediateAdvice.push({
          fr: `Consigne associée à ${dtc.code} : évitez de continuer à rouler avant contrôle.`,
          en: `Instruction linked to ${dtc.code}: avoid driving on before a check.`,
        });
      }
      continue;
    }
    // Un code inconnu ne peut JAMAIS être classé « non critique » (§47-3).
    levels.push('attention');
    reasons.push({
      fr: `Le code ${dtc.code} n’est pas documenté dans la base XAMOTO : par prudence, un contrôle est nécessaire avant de considérer le véhicule comme sain.`,
      en: `Code ${dtc.code} is not documented in the XAMOTO database: as a precaution, a check is needed before considering the vehicle healthy.`,
      level: 'attention',
      evidence: [{ kind: 'dtc', ref: dtc.code, label: 'Code non documenté' }],
    });
  }

  const level: SafetyLevel = levels.length > 0 ? worstSafety(levels) : 'normal';

  /* ── 4. Qualité des données : conditionne la garantie et la certitude ──── */
  const supported = ctx.readings.filter((r) => r.supported && r.value !== null);
  const dtcsRead = ctx.dtcs.length >= 0 && ctx.source !== 'none';
  const hasSymptoms = ctx.symptoms.some((s) => s.present);
  const missing: string[] = [];

  if (!dtcsRead) {
    missing.push('Les codes défaut n’ont pas été lus.');
    notes.push('Aucune lecture OBD confirmée : aucun défaut mémorisé ne peut être affirmé.');
  }
  if (supported.length === 0) {
    missing.push('Aucune mesure n’est disponible pour ce véhicule.');
  }
  for (const key of GUARANTEE_KEYS) {
    const reading = ctx.readings.find((r) => r.key === key);
    if (!reading || !reading.supported || reading.value === null) missing.push(`Mesure indisponible : ${reading?.label ?? key}.`);
  }

  let certainty: CertaintyLevel;
  if (supported.length === 0 && !dtcsRead) {
    certainty = 'unavailable';
  } else if (supported.length === 0) {
    certainty = 'possible';
  } else if (level === 'critical') {
    // Un danger identifié est fiable même avec peu de données : on n'attend
    // jamais d'avoir « assez » de données pour dire d'arrêter.
    certainty = 'strongly_compatible';
  } else if (supported.length >= 5) {
    certainty = 'strongly_compatible';
  } else if (supported.length >= 2) {
    certainty = 'possible';
  } else {
    certainty = 'undeterminable';
  }

  if (hasSymptoms && ctx.dtcs.length === 0 && supported.length === 0) {
    notes.push('Aucune donnée OBD : l’évaluation repose uniquement sur les symptômes déclarés.');
  }

  const cannotGuarantee = missing.length > 0 || certainty === 'unavailable' || certainty === 'undeterminable';
  if (cannotGuarantee) {
    immediateAdvice.push({
      fr: MESSAGES.noGuaranteeFr,
      en: MESSAGES.noGuaranteeEn,
    });
    immediateAdvice.push({
      fr: 'En cas de doute sur la sécurité (freins, direction, surchauffe, pression d’huile) : ne roulez pas et faites appel à un professionnel.',
      en: 'If in doubt about safety (brakes, steering, overheating, oil pressure): do not drive and call a professional.',
    });
  }

  if (level !== 'normal' && immediateAdvice.length === 0) {
    immediateAdvice.push({
      fr: `Niveau ${SAFETY_LABELS[level].fr} : suivez les vérifications proposées avant de reprendre un usage normal.`,
      en: `Level ${SAFETY_LABELS[level].en}: follow the proposed checks before resuming normal use.`,
    });
  }

  return {
    level,
    reasons,
    immediateAdvice,
    cannotGuarantee,
    dataQuality: {
      readings: ctx.readings.length,
      supportedReadings: supported.length,
      dtcs: ctx.dtcs.length,
      symptoms: ctx.symptoms.filter((s) => s.present).length,
      certainty,
      notes,
    },
  };
}

export function safetyRank(level: SafetyLevel): number {
  return level === 'critical' ? 3 : level === 'important' ? 2 : level === 'attention' ? 1 : 0;
}

export { safetyAtLeast, worstSafety, MESSAGES };
