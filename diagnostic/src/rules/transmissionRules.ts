/**
 * XAMOTO — Règles de la transmission (§15, §16).
 *
 * L'OBD standard expose les codes de boîte, pas les données de boîte. XAMOTO
 * peut donc dire « un défaut existe », jamais « telle pièce est à changer », et
 * encore moins « la boîte est morte ». Ces règles portent cette limite.
 */
import type { SafetyLevel } from '@xamoto/shared';
import { worstSafety } from '@xamoto/shared';
import { findDtcKnowledge } from '../knowledge/dtc.js';
import { SYSTEM_COVERAGE } from '../knowledge/systems.js';
import type { DiagnosticContext, Rule, RuleEffect } from './types.js';
import { dtcEvidence, symptomEvidence } from './types.js';

const SOURCE_METHODS = 'src_workshop_methods';

const transmissionCodes = (ctx: DiagnosticContext): string[] =>
  ctx.dtcs.map((d) => d.code).filter((code) => code.startsWith('P07') || findDtcKnowledge(code)?.system === 'transmission');

export const ruleTransmissionOutOfReach: Rule = {
  id: 'rule_transmission_out_of_reach',
  domain: 'dtc',
  titleFr: 'Boîte de vitesses : ce que l’OBD standard ne donne pas',
  titleEn: 'Transmission: what standard OBD does not provide',
  sourceId: SOURCE_METHODS,
  systems: ['transmission'],
  applies: (ctx) => transmissionCodes(ctx).length > 0,
  apply: (ctx) => {
    const codes = transmissionCodes(ctx);
    const severities = codes.map((code) => findDtcKnowledge(code)?.severity ?? 'attention') as SafetyLevel[];
    const coverage = SYSTEM_COVERAGE.find((c) => c.system === 'transmission');

    const effects: RuleEffect[] = [
      {
        kind: 'finding',
        finding: {
          kind: 'coherence',
          titleFr: 'Le détail du défaut est dans le calculateur de boîte, pas dans ce scan',
          titleEn: 'The fault detail lives in the transmission module, not in this scan',
          detailFr:
            'XAMOTO reçoit un code de la part du calculateur de boîte (par exemple une demande d’allumage du voyant ou un capteur de vitesse). Les valeurs internes — pressions, températures, glissement des embrayages, historique des passages — restent dans le calculateur de boîte et ne sortent pas par l’OBD standard. Conclure « boîte à remplacer » à ce stade serait un abus.',
          detailEn:
            'XAMOTO receives a code from the transmission module (for example a MIL request or a speed sensor). Internal values — pressures, temperatures, clutch slip, shift history — stay inside the transmission module and are not exposed through standard OBD. Concluding “gearbox to replace” at this stage would be an abuse.',
          certainty: 'strongly_compatible',
          safety: worstSafety(severities),
          evidence: codes.map((code) => dtcEvidence(code, findDtcKnowledge(code)?.simpleFr ?? 'Défaut de transmission')),
          origin: 'documented',
        },
      },
      {
        kind: 'cause',
        cause: {
          causeKey: 'transmission_fluid',
          labelFr: 'Huile de boîte dégradée ou niveau incorrect',
          labelEn: 'Degraded transmission fluid or incorrect level',
          delta: 0.28,
          weight: 'documented',
          reasonFr:
            'Le contrôle du niveau et de l’état de l’huile est la première vérification utile sur une boîte automatique, et la seule réalisable sans outil constructeur.',
          reasonEn:
            'Checking the fluid level and condition is the first useful check on an automatic transmission, and the only one doable without a manufacturer tool.',
          confirmedByTest: 'test_transmission_fluid',
          parts: ['huile_boite'],
        },
      },
      {
        kind: 'cause',
        cause: {
          causeKey: 'transmission_electrical',
          labelFr: 'Capteur ou câblage de boîte (vitesse, température)',
          labelEn: 'Transmission sensor or wiring (speed, temperature)',
          delta: 0.22,
          weight: 'documented',
          reasonFr:
            'Les codes de capteur de boîte viennent fréquemment du câblage et du connecteur, pas de la mécanique interne.',
          reasonEn: 'Transmission sensor codes frequently come from wiring and connectors, not from internal mechanics.',
          confirmedByTest: 'test_wiring_visual',
        },
      },
      { kind: 'test', testKey: 'test_transmission_fluid', priority: 15, reasonFr: 'Niveau, couleur et odeur de l’huile : la vérification la moins coûteuse.', reasonEn: 'Fluid level, colour and smell: the cheapest check.' },
      { kind: 'test', testKey: 'test_driving_profile_review', priority: 40, reasonFr: 'Le contexte d’usage (ville, pentes, trafic) change la lecture des défauts de boîte.', reasonEn: 'Usage context (city, slopes, traffic) changes how transmission faults read.' },
      {
        kind: 'missing',
        itemFr: 'Un relevé des données de boîte (protocole constructeur) : pressions, températures, glissement, historique des passages',
        itemEn: 'A transmission data readout (manufacturer protocol): pressures, temperatures, slip, shift history',
        blocksConclusion: true,
      },
      {
        kind: 'certaintyCap',
        level: 'possible',
        reasonFr: 'Sans données de boîte, aucune pièce ne peut être désignée : le code indique qu’un défaut existe, pas où il est.',
        reasonEn: 'Without transmission data, no part can be singled out: the code says a fault exists, not where it is.',
      },
    ];

    if (coverage) effects.push({ kind: 'note', textFr: coverage.limitsFr, textEn: coverage.limitsEn });

    // À-coups déclarés : ils ne transforment pas un code de boîte en conclusion,
    // mais ils orientent vers un essai routier encadré plutôt qu'un remplacement.
    const jerking = ctx.symptoms.find((s) => s.key === 'jerking' && s.present);
    if (jerking) {
      effects.push({
        kind: 'finding',
        finding: {
          kind: 'symptom',
          titleFr: 'À-coups déclarés : à qualifier avant toute intervention sur la boîte',
          titleEn: 'Reported jerking: qualify it before any work on the transmission',
          detailFr:
            'Un à-coup peut venir de l’allumage, de l’alimentation en carburant ou de la boîte. XAMOTO ne peut pas les départager sans données de boîte ni essai routier encadré.',
          detailEn:
            'Jerking may come from ignition, fuel supply or the transmission. XAMOTO cannot tell them apart without transmission data or a supervised road test.',
          certainty: 'possible',
          safety: 'attention',
          evidence: [symptomEvidence(jerking, 'Secousses / soubresauts')],
          origin: 'documented',
        },
      });
    }

    return effects;
  },
};

export const TRANSMISSION_RULES: Rule[] = [ruleTransmissionOutOfReach];
