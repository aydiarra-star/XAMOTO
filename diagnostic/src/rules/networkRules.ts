/**
 * XAMOTO — Règles du réseau de communication (§15, §16, §47).
 *
 * Les codes de la famille U (« perte de communication ») sont ceux qui
 * déclenchent le plus de remplacements inutiles de calculateurs. Cette règle
 * impose l'ordre réel : alimentation, masses, connecteurs — puis mesure du bus
 * avec l'outil adapté. XAMOTO n'affirme jamais qu'un boîtier est mort.
 */
import type { SafetyLevel } from '@xamoto/shared';
import { worstSafety } from '@xamoto/shared';
import { findDtcKnowledge } from '../knowledge/dtc.js';
import { SYSTEM_COVERAGE } from '../knowledge/systems.js';
import type { DiagnosticContext, Rule, RuleEffect } from './types.js';
import { dtcEvidence } from './types.js';

const SOURCE_METHODS = 'src_workshop_methods';

const communicationCodes = (ctx: DiagnosticContext): string[] => {
  const codes = ctx.dtcs.map((d) => d.code);
  return codes.filter((code) => {
    if (code.startsWith('U')) return true;
    // Un code de calculateur peut aussi signaler une alimentation instable.
    const knowledge = findDtcKnowledge(code);
    return knowledge?.system === 'reseau';
  });
};

export const ruleCommunicationCodes: Rule = {
  id: 'rule_communication_codes',
  domain: 'dtc',
  titleFr: 'Perte de communication : vérifier l’alimentation avant le boîtier',
  titleEn: 'Communication loss: check the supply before the module',
  sourceId: SOURCE_METHODS,
  systems: ['reseau', 'electrique'],
  applies: (ctx) => communicationCodes(ctx).length > 0,
  apply: (ctx) => {
    const codes = communicationCodes(ctx);
    const severities = codes.map((code) => findDtcKnowledge(code)?.severity ?? 'important') as SafetyLevel[];
    const safety = worstSafety(severities);
    const coverage = SYSTEM_COVERAGE.find((c) => c.system === 'reseau');
    const battery = ctx.readings.find((r) => r.key === 'battery_voltage' && r.supported && r.value !== null);

    const effects: RuleEffect[] = [
      {
        kind: 'finding',
        finding: {
          kind: 'coherence',
          titleFr: 'Un défaut de communication n’est pas un diagnostic de calculateur',
          titleEn: 'A communication fault is not a module diagnosis',
          detailFr:
            'Une tension d’alimentation instable, une masse moteur ou châssis défectueuse, un connecteur oxydé ou une cosse de batterie desserrée produisent exactement les mêmes codes qu’un calculateur défaillant. Remplacer un boîtier avant d’avoir contrôlé l’alimentation et les masses revient à payer une pièce au hasard.',
          detailEn:
            'An unstable supply voltage, a faulty engine or chassis ground, a corroded connector or a loose battery terminal produce exactly the same codes as a failed module. Replacing a module before checking supply and grounds means paying for a part at random.',
          certainty: 'strongly_compatible',
          safety,
          evidence: codes.map((code) => dtcEvidence(code, findDtcKnowledge(code)?.simpleFr ?? 'Perte de communication')),
          origin: 'documented',
        },
      },
      {
        kind: 'cause',
        cause: {
          causeKey: 'electrical_supply_weak',
          labelFr: 'Alimentation ou masse instable perturbant le réseau',
          labelEn: 'Unstable supply or ground disturbing the network',
          delta: 0.3,
          weight: 'documented',
          reasonFr:
            'L’ordre de vérification reconnu place l’alimentation et les masses avant toute incrimination d’un calculateur. Cette hypothèse reste à confirmer par mesure.',
          reasonEn:
            'The recognised check order puts supply and grounds before blaming any module. This hypothesis remains to be confirmed by measurement.',
          evidence: battery ? [{ kind: 'pid', ref: battery.key, label: battery.label, value: `${battery.value} ${battery.unit}`.trim() }] : undefined,
          confirmedByTest: 'test_charging_voltage',
          parts: ['batterie'],
        },
      },
      { kind: 'test', testKey: 'test_battery_rest_voltage', priority: 8, reasonFr: 'Première mesure, sans outil coûteux.', reasonEn: 'First measurement, no expensive tool.' },
      { kind: 'test', testKey: 'test_charging_voltage', priority: 9, reasonFr: 'Une tension de charge hors plage perturbe tous les calculateurs.', reasonEn: 'An out-of-range charging voltage disturbs every module.' },
      { kind: 'test', testKey: 'test_wiring_visual', priority: 12, reasonFr: 'Cosses, masses et connecteurs se contrôlent avant tout remplacement.', reasonEn: 'Terminals, grounds and connectors are checked before any replacement.' },
      {
        kind: 'missing',
        itemFr: 'Une mesure du bus de communication à l’oscilloscope (atelier) : niveaux, terminaison, perturbations',
        itemEn: 'An oscilloscope measurement of the communication bus (workshop): levels, termination, interference',
        blocksConclusion: true,
      },
      {
        kind: 'certaintyCap',
        level: 'possible',
        reasonFr: 'Sans mesure du bus ni contrôle d’alimentation, aucune cause ne peut être confirmée sur un défaut de communication.',
        reasonEn: 'Without bus measurement and supply checks, no cause can be confirmed on a communication fault.',
      },
    ];

    if (coverage) effects.push({ kind: 'note', textFr: coverage.limitsFr, textEn: coverage.limitsEn });

    return effects;
  },
};

export const NETWORK_RULES: Rule[] = [ruleCommunicationCodes];
