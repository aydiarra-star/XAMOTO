/**
 * XAMOTO — Ensemble des règles du moteur de diagnostic.
 *
 * Additions futures : enregistrer ici une nouvelle règle suffit. Elle hérite
 * automatiquement de la traçabilité (source, effet, preuve) et du contrôle de
 * certitude.
 */
import { DTC_RULES } from './dtcRules.js';
import { PID_RULES } from './pidRules.js';
import { SYMPTOM_RULES } from './symptomRules.js';
import { HISTORY_RULES } from './historyRules.js';
import { COHERENCE_RULES } from './coherenceRules.js';
import type { Rule } from './types.js';

export const ALL_RULES: Rule[] = [
  // Cohérence d'abord : elle conditionne l'interprétation de tout le reste.
  ...COHERENCE_RULES,
  ...PID_RULES,
  ...DTC_RULES,
  ...SYMPTOM_RULES,
  ...HISTORY_RULES,
];

export const RULES_BY_ID = new Map(ALL_RULES.map((r) => [r.id, r]));

export const RULES_BY_DOMAIN = ALL_RULES.reduce<Record<string, Rule[]>>((acc, rule) => {
  acc[rule.domain] = [...(acc[rule.domain] ?? []), rule];
  return acc;
}, {});

export * from './types.js';
export { DTC_RULES, PID_RULES, SYMPTOM_RULES, HISTORY_RULES, COHERENCE_RULES };
export const ENGINE_RULES_VERSION = '1.0.0';
