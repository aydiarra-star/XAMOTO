/**
 * XAMOTO — Règles du refroidissement (§11, §39).
 *
 * La surchauffe est traitée comme une urgence (§11). Cette règle complète les
 * mesures de température par ce que l'OBD ne voit pas : la CONSOMMATION de
 * liquide. Une consommation sans fuite visible est le signe le plus souvent mal
 * interprété (joint de culasse annoncé trop vite, ou au contraire ignoré) : ici,
 * XAMOTO impose l'ordre de vérification et plafonne la certitude.
 */
import type { SafetyLevel } from '@xamoto/shared';
import { worstSafety } from '@xamoto/shared';
import { SYSTEM_COVERAGE } from '../knowledge/systems.js';
import type { DiagnosticContext, Rule, RuleEffect } from './types.js';
import { pidEvidence, symptomEvidence } from './types.js';

const SOURCE_PRACTICE = 'src_xamoto_practice';

const coolantTemp = (ctx: DiagnosticContext) => ctx.readings.find((r) => r.key === 'coolant_temp' && r.supported && r.value !== null);

export const ruleCoolantLoss: Rule = {
  id: 'rule_coolant_loss',
  domain: 'symptome',
  titleFr: 'Consommation de liquide de refroidissement',
  titleEn: 'Coolant consumption',
  sourceId: SOURCE_PRACTICE,
  systems: ['moteur'],
  applies: (ctx) => ctx.symptoms.some((s) => s.key === 'coolant_loss' && s.present),
  apply: (ctx) => {
    const present = ctx.symptoms.filter((s) => s.present);
    const loss = present.find((s) => s.key === 'coolant_loss');
    const overheating = present.find((s) => s.key === 'overheating');
    const whiteSmoke = present.find((s) => s.key === 'white_smoke');
    if (!loss) return [];

    const levels: SafetyLevel[] = ['important'];
    if (overheating) levels.push('critical');
    const measurement = coolantTemp(ctx);

    const effects: RuleEffect[] = [
      {
        kind: 'finding',
        finding: {
          kind: 'symptom',
          titleFr: 'Perte de liquide de refroidissement : un niveau qui baisse est un fait, la cause reste à établir',
          titleEn: 'Coolant loss: a dropping level is a fact, the cause remains to be established',
          detailFr:
            'Aucune mesure OBD ne renseigne le niveau de liquide. Trois familles de causes expliquent une consommation : une fuite externe (durite, radiateur, pompe à eau, bouchon), une fuite interne (joint de culasse, refroidisseur), ou une décharge par le bouchon lorsque la pression n’est plus tenue. L’ordre de vérification part toujours de la fuite externe, la plus fréquente et la moins coûteuse.',
          detailEn:
            'No OBD measurement reports coolant level. Three families explain consumption: an external leak (hose, radiator, water pump, cap), an internal leak (head gasket, cooler), or discharge through the cap when pressure is no longer held. The check order always starts with the external leak, the most frequent and cheapest.',
          certainty: 'possible',
          safety: worstSafety(levels),
          evidence: [symptomEvidence(loss, 'Perte de liquide de refroidissement'), ...(overheating ? [symptomEvidence(overheating, 'Surchauffe moteur')] : [])],
          origin: 'documented',
        },
      },
      {
        kind: 'cause',
        cause: {
          causeKey: 'coolant_hose_leak',
          labelFr: 'Fuite externe : durite, collier, radiateur, pompe à eau',
          labelEn: 'External leak: hose, clamp, radiator, water pump',
          delta: 0.35,
          weight: 'symptom',
          reasonFr: 'Les fuites externes sont la cause la plus fréquente d’une consommation de liquide, et la plus simple à vérifier à froid.',
          reasonEn: 'External leaks are the most frequent cause of coolant consumption, and the easiest to check when cold.',
          evidence: [symptomEvidence(loss, 'Perte de liquide de refroidissement')],
          confirmedByTest: 'test_coolant_level',
          parts: ['durite_refroidissement', 'radiateur', 'pompe_a_eau', 'bouchon_radiateur'],
        },
      },
    ];

    if (whiteSmoke || (overheating && loss)) {
      effects.push({
        kind: 'cause',
        cause: {
          causeKey: 'head_gasket',
          labelFr: 'Fuite interne : joint de culasse ou refroidisseur',
          labelEn: 'Internal leak: head gasket or cooler',
          delta: whiteSmoke ? 0.3 : 0.15,
          weight: 'symptom',
          reasonFr: whiteSmoke
            ? 'Fumée blanche persistante associée à une consommation de liquide : cette combinaison justifie le test de présence de gaz de combustion dans le liquide, avant toute conclusion.'
            : 'Une consommation de liquide accompagnée de surchauffe peut venir d’une fuite interne, mais plusieurs causes restent possibles : le test de gaz de combustion est nécessaire avant de conclure.',
          reasonEn: whiteSmoke
            ? 'Persistent white smoke combined with coolant consumption: this combination justifies testing for combustion gases in the coolant before any conclusion.'
            : 'Coolant consumption with overheating may come from an internal leak, but several causes remain possible: the combustion gas test is required before concluding.',
          evidence: [symptomEvidence(loss, 'Perte de liquide de refroidissement')],
          confirmedByTest: 'test_combustion_gases_coolant',
          parts: ['joint_culasse'],
        },
      });
    }

    effects.push(
      { kind: 'test', testKey: 'test_coolant_level', priority: 4, reasonFr: 'Niveau à froid, état du bouchon et recherche de trace de fuite : la première étape.', reasonEn: 'Cold level, cap condition and leak trace search: the first step.', forCause: 'coolant_hose_leak' },
      { kind: 'test', testKey: 'test_radiator_flow', priority: 18, reasonFr: 'Un radiateur obstrué (poussière, calcaire) fait monter la pression et provoque des décharges.', reasonEn: 'A blocked radiator (dust, scale) raises pressure and causes discharge.' },
      { kind: 'test', testKey: 'test_combustion_gases_coolant', priority: 22, reasonFr: 'Ce test départage une fuite externe d’une fuite interne, avant tout démontage.', reasonEn: 'This test separates an external leak from an internal one, before any dismantling.', forCause: 'head_gasket' },
      {
        kind: 'missing',
        itemFr: 'Un contrôle de pression du circuit de refroidissement (test d’étanchéité) pour localiser la fuite',
        itemEn: 'A cooling system pressure test to locate the leak',
        blocksConclusion: true,
      },
    );

    if (measurement) {
      effects.push({
        kind: 'note',
        textFr: `Dernière température de liquide relevée : ${measurement.value} °C. C’est une mesure : elle ne dit pas si le niveau est correct.`,
        textEn: `Last recorded coolant temperature: ${measurement.value} °C. This is a measurement: it does not say whether the level is correct.`,
      });
    } else {
      effects.push({
        kind: 'note',
        textFr: 'XAMOTO ne dispose pas de la température de liquide pour ce véhicule : il ne peut donc pas la comparer à une plage normale.',
        textEn: 'XAMOTO has no coolant temperature for this vehicle: it cannot compare it with a normal range.',
      });
    }

    const coverage = SYSTEM_COVERAGE.find((c) => c.system === 'moteur');
    if (coverage) effects.push({ kind: 'note', textFr: coverage.limitsFr, textEn: coverage.limitsEn });

    const pid = coolantTemp(ctx);
    if (pid) void pidEvidence(pid);

    return effects;
  },
};

export const COOLING_RULES: Rule[] = [ruleCoolantLoss];
