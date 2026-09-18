/**
 * XAMOTO — Ensemble des règles du moteur de diagnostic.
 *
 * Additions futures : enregistrer ici une nouvelle règle suffit. Elle hérite
 * automatiquement de la traçabilité (source, effet, preuve) et du contrôle de
 * certitude.
 */
import type { DtcSystem } from '@xamoto/shared';
import { DTC_RULES } from './dtcRules.js';
import { PID_RULES } from './pidRules.js';
import { SYMPTOM_RULES } from './symptomRules.js';
import { HISTORY_RULES } from './historyRules.js';
import { COHERENCE_RULES } from './coherenceRules.js';
import { BRAKING_RULES } from './brakingRules.js';
import { NETWORK_RULES } from './networkRules.js';
import { TRANSMISSION_RULES } from './transmissionRules.js';
import { CLIMATE_RULES } from './climateRules.js';
import { BODY_RULES } from './bodyRules.js';
import { COOLING_RULES } from './coolingRules.js';
import { SYSTEM_COVERAGE, type SystemCoverage } from '../knowledge/systems.js';
import type { Rule } from './types.js';

export const ALL_RULES: Rule[] = [
  // Cohérence d'abord : elle conditionne l'interprétation de tout le reste.
  ...COHERENCE_RULES,
  ...PID_RULES,
  ...DTC_RULES,
  ...SYMPTOM_RULES,
  ...COOLING_RULES,
  ...BRAKING_RULES,
  ...TRANSMISSION_RULES,
  ...NETWORK_RULES,
  ...CLIMATE_RULES,
  ...BODY_RULES,
  ...HISTORY_RULES,
];

export const RULES_BY_ID = new Map(ALL_RULES.map((r) => [r.id, r]));

export const RULES_BY_DOMAIN = ALL_RULES.reduce<Record<string, Rule[]>>((acc, rule) => {
  acc[rule.domain] = [...(acc[rule.domain] ?? []), rule];
  return acc;
}, {});

/**
 * Lecture PAR SYSTÈME (§15) : quelles règles s'appliquent, et pour les systèmes
 * qu'aucune règle ne couvre, ce que XAMOTO déclare explicitement ne pas pouvoir
 * lire. Un système sans règle ET sans limite documentée serait un trou : le test
 * `diagnostic/test/systems.test.ts` échoue si un tel trou apparaît.
 */
export const RULES_BY_SYSTEM: Record<string, Rule[]> = {};
for (const rule of ALL_RULES) {
  for (const system of rule.systems ?? []) {
    RULES_BY_SYSTEM[system] = [...(RULES_BY_SYSTEM[system] ?? []), rule];
  }
}

export interface SystemRuleView {
  system: DtcSystem;
  coverage: SystemCoverage | null;
  ruleIds: string[];
}

/** Vue par système : règles applicables + limites déclarées + tests utiles. */
export function rulesBySystemView(): SystemRuleView[] {
  return SYSTEM_COVERAGE.map((coverage) => ({
    system: coverage.system,
    coverage,
    ruleIds: (RULES_BY_SYSTEM[coverage.system] ?? []).map((rule) => rule.id),
  }));
}

export function rulesForSystem(system: DtcSystem): Rule[] {
  return RULES_BY_SYSTEM[system] ?? [];
}

export * from './types.js';
export { DTC_RULES, PID_RULES, SYMPTOM_RULES, HISTORY_RULES, COHERENCE_RULES };
export { BRAKING_RULES, NETWORK_RULES, TRANSMISSION_RULES, CLIMATE_RULES, BODY_RULES, COOLING_RULES };
export * from '../knowledge/systems.js';
export const ENGINE_RULES_VERSION = '1.0.0';
