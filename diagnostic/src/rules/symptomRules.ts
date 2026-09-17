/**
 * XAMOTO — Règles fondées sur les symptômes (§17).
 *
 * Un symptôme seul ne peut JAMAIS produire une conclusion : le niveau de
 * certitude maximal d'une hypothèse issue d'un symptôme est « possible ».
 * En revanche, certains symptômes portent une urgence de sécurité propre
 * (voyant d'huile, pédale de frein molle, surchauffe) qui s'applique
 * indépendamment des codes défaut.
 */
import { SYMPTOM_BY_KEY, symptomHypothesesFor } from '../knowledge/symptoms.js';
import type { Rule, RuleEffect } from './types.js';
import { symptomEvidence } from './types.js';

const SOURCE_PRACTICE = 'src_xamoto_practice';

export const ruleSymptoms: Rule = {
  id: 'rule_symptoms',
  domain: 'symptome',
  titleFr: 'Prise en compte des symptômes déclarés',
  titleEn: 'Taking declared symptoms into account',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => ctx.symptoms.some((s) => s.present),
  apply: (ctx) => {
    const effects: RuleEffect[] = [];
    const present = ctx.symptoms.filter((s) => s.present);

    for (const symptom of present) {
      const def = SYMPTOM_BY_KEY.get(symptom.key);
      if (!def) continue;

      const intensityLabel = symptom.intensity
        ? symptom.intensity === 'severe'
          ? ' (intensité élevée)'
          : symptom.intensity === 'moderate'
            ? ' (intensité modérée)'
            : ' (intensité légère)'
        : '';

      effects.push({
        kind: 'finding',
        finding: {
          kind: 'symptom',
          titleFr: `Symptôme déclaré : ${def.labelFr}${intensityLabel}`,
          titleEn: `Declared symptom: ${def.labelEn}${intensityLabel}`,
          detailFr:
            'Ce symptôme est déclaré par l’utilisateur : XAMOTO l’utilise pour orienter la recherche, sans le transformer en mesure.',
          detailEn:
            'This symptom is user-declared: XAMOTO uses it to orient the investigation, without turning it into a measurement.',
          certainty: 'possible',
          safety: def.safety,
          evidence: [symptomEvidence(symptom, def.labelFr)],
          origin: 'documented',
        },
      });

      if (def.safety === 'critical' || def.safety === 'important') {
        effects.push({
          kind: 'safety',
          level: def.safety,
          reasonFr:
            def.safety === 'critical'
              ? `${def.labelFr} : ce symptôme impose une vérification avant de continuer à rouler normalement.`
              : `${def.labelFr} : une vérification rapide est recommandée.`,
          reasonEn:
            def.safety === 'critical'
              ? `${def.labelEn}: this symptom requires a check before continuing to drive normally.`
              : `${def.labelEn}: a prompt check is recommended.`,
          evidence: [symptomEvidence(symptom, def.labelFr)],
        });
      }

      // Hypothèses : pondération réduite (0,5) car l'information est déclarative.
      for (const seed of symptomHypothesesFor([symptom.key])) {
        effects.push({
          kind: 'cause',
          cause: {
            causeKey: seed.causeKey,
            labelFr: seed.labelFr,
            labelEn: seed.labelEn,
            delta: seed.weight * 0.5 * (symptom.intensity === 'severe' ? 1.15 : 1),
            weight: 'symptom',
            reasonFr: `Compatible avec le symptôme déclaré « ${def.labelFr} ». Une compatibilité n’est pas une preuve.`,
            reasonEn: `Compatible with the declared symptom "${def.labelEn}". Compatibility is not proof.`,
            evidence: [symptomEvidence(symptom, def.labelFr)],
            confirmedByTest: seed.tests[0],
            parts: seed.parts,
          },
        });
        for (const testKey of seed.tests) {
          if (effects.some((e) => e.kind === 'test' && e.testKey === testKey)) continue;
          effects.push({
            kind: 'test',
            testKey,
            priority: 30,
            reasonFr: `Test permettant de vérifier l’hypothèse liée au symptôme « ${def.labelFr} ».`,
            reasonEn: `Test to verify the hypothesis related to symptom "${def.labelEn}".`,
            forCause: seed.causeKey,
          });
        }
      }
    }

    // Symptômes contradictoires déclarés simultanément : à signaler.
    const hasOverheat = present.some((s) => s.key === 'overheating');
    const hasCold = present.some((s) => s.key === 'ac_not_cold');
    if (hasOverheat && hasCold) {
      effects.push({
        kind: 'note',
        textFr:
          'Surchauffe moteur et climatisation inefficace déclarées ensemble : ces deux symptômes peuvent avoir un lien (refroidissement global) mais XAMOTO ne peut pas l’affirmer sans mesures.',
        textEn:
          'Engine overheating and ineffective air conditioning declared together: both symptoms may be linked (overall cooling) but XAMOTO cannot assert it without measurements.',
      });
    }

    return effects;
  },
};

/**
 * Symptômes présents alors qu'aucun code défaut n'est mémorisé :
 * cas fréquent (défaut intermittent, capteur non surveillé, problème mécanique).
 */
export const ruleSymptomsWithoutDtc: Rule = {
  id: 'rule_symptoms_without_dtc',
  domain: 'symptome',
  titleFr: 'Symptômes sans code défaut',
  titleEn: 'Symptoms without fault code',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => ctx.dtcs.length === 0 && ctx.symptoms.some((s) => s.present),
  apply: (ctx) => {
    const present = ctx.symptoms.filter((s) => s.present);
    return [
      {
        kind: 'finding',
        finding: {
          kind: 'coherence',
          titleFr: 'Symptômes signalés sans code défaut mémorisé',
          titleEn: 'Symptoms reported without any stored fault code',
          detailFr:
            'Aucun défaut n’est mémorisé alors que des symptômes sont présents. Cela arrive couramment : le calculateur ne surveille pas tout, un défaut peut être intermittent, ou le problème peut être mécanique (freinage, suspension, climatisation). XAMOTO travaillera donc à partir des symptômes et des mesures.',
          detailEn:
            'No fault is stored while symptoms are present. This is common: the ECU does not monitor everything, a fault may be intermittent, or the issue may be mechanical (braking, suspension, air conditioning). XAMOTO will therefore work from symptoms and measurements.',
          certainty: 'possible',
          safety: present.some((s) => SYMPTOM_BY_KEY.get(s.key)?.safety === 'critical') ? 'critical' : 'attention',
          evidence: present.map((s) => symptomEvidence(s, SYMPTOM_BY_KEY.get(s.key)?.labelFr ?? s.key)),
          origin: 'documented',
        },
      },
      { kind: 'certaintyCap', level: 'possible', reasonFr: 'Sans code défaut ni mesure discriminante, aucune cause ne peut être confirmée.', reasonEn: 'Without a fault code or discriminating measurement, no cause can be confirmed.' },
      { kind: 'missing', itemFr: 'Un scan des mesures moteur chaud (et un contrôle visuel) pour objectiver les symptômes', itemEn: 'A warm-engine measurement scan (and a visual inspection) to objectify symptoms', blocksConclusion: true },
    ];
  },
};

export const SYMPTOM_RULES: Rule[] = [ruleSymptoms, ruleSymptomsWithoutDtc];
