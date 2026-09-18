/**
 * XAMOTO — Règles fondées sur les codes défaut (§8, §9, §16).
 *
 * Un DTC est une OBSERVATION du calculateur, pas un diagnostic. Ces règles
 * transforment un code en :
 *  – un constat expliqué (avec son niveau de certitude et de sécurité),
 *  – des hypothèses pondérées issues de la base de connaissances,
 *  – des tests discriminants,
 *  – l'indication explicite de ce qui manque pour conclure.
 *
 * Un code absent de la base n'est PAS interprété : XAMOTO explique seulement
 * la nomenclature (famille du code) et refuse de deviner (§16, §47-10).
 */
import type { SafetyLevel } from '@xamoto/shared';
import { findDtcKnowledge, describeUnknownDtc } from '../knowledge/dtc.js';
import { TEST_BY_ID } from '../knowledge/tests.js';
import type { DtcInput, DiagnosticContext, Rule, RuleEffect } from './types.js';
import { dtcEvidence } from './types.js';

const SOURCE_PRACTICE = 'src_xamoto_practice';

/** Poids d'un code selon son statut : un défaut « en cours » pèse plus qu'un défaut mémorisé. */
const STATUS_WEIGHT: Record<DtcInput['status'], number> = {
  active: 1,
  permanent: 1,
  stored: 0.75,
  pending: 0.6,
};

const STATUS_LABEL: Record<DtcInput['status'], { fr: string; en: string }> = {
  active: { fr: 'présent (en cours)', en: 'active (current)' },
  permanent: { fr: 'permanent', en: 'permanent' },
  stored: { fr: 'mémorisé', en: 'stored' },
  pending: { fr: 'en attente de confirmation', en: 'pending confirmation' },
};

/**
 * Un code « permanent » ne peut pas être effacé par un outil : XAMOTO le
 * signale, car cela change l'interprétation d'un effacement (§18, §19).
 */
export const ruleDtcKnowledge: Rule = {
  id: 'rule_dtc_knowledge',
  domain: 'dtc',
  titleFr: 'Transformation des codes défaut en hypothèses',
  titleEn: 'Turning fault codes into hypotheses',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => ctx.dtcs.length > 0,
  apply: (ctx) => {
    const effects: RuleEffect[] = [];
    const codes = ctx.dtcs.map((d) => d.code);

    for (const dtc of ctx.dtcs) {
      const knowledge = findDtcKnowledge(dtc.code);

      if (!knowledge) {
        // §16 : aucun contenu inventé pour un code inconnu.
        const described = describeUnknownDtc(dtc.code);
        effects.push({
          kind: 'finding',
          finding: {
            kind: 'dtc',
            titleFr: `Code ${dtc.code} — ${STATUS_LABEL[dtc.status].fr}`,
            titleEn: `Code ${dtc.code} — ${STATUS_LABEL[dtc.status].en}`,
            detailFr: described
              ? `Ce code appartient au ${described.familyFr} XAMOTO ne dispose pas de la définition détaillée de ce code pour votre véhicule : il ne l’interprétera pas au-delà de cette famille. Une recherche dans la documentation du constructeur est nécessaire.`
              : `XAMOTO ne dispose pas de la définition de ce code et ne peut pas l’interpréter.`,
            detailEn: described
              ? `This code belongs to the ${described.familyEn} XAMOTO does not have the detailed definition for your vehicle: it will not interpret it beyond this family. Manufacturer documentation is required.`
              : `XAMOTO does not have a definition for this code and cannot interpret it.`,
            certainty: 'unavailable',
            safety: 'attention',
            evidence: [dtcEvidence(dtc.code, 'Code non documenté dans la base XAMOTO')],
            origin: dtc.origin,
          },
        });
        effects.push({
          kind: 'missing',
          itemFr: `Définition détaillée du code ${dtc.code} pour ce véhicule (documentation constructeur)`,
          itemEn: `Detailed definition of code ${dtc.code} for this vehicle (manufacturer documentation)`,
          blocksConclusion: true,
        });
        continue;
      }

      const status = STATUS_LABEL[dtc.status];
      const severity = knowledge.severity;
      const certaintyBase = dtc.status === 'pending' ? 'possible' : 'strongly_compatible';

      effects.push({
        kind: 'finding',
        finding: {
          kind: 'dtc',
          titleFr: `${knowledge.code} — ${knowledge.simpleFr.split('.')[0]}.`,
          titleEn: `${knowledge.code} — ${knowledge.simpleEn.split('.')[0]}.`,
          detailFr: `${knowledge.simpleFr} Statut : ${status.fr}.`,
          detailEn: `${knowledge.simpleEn} Status: ${status.en}.`,
          certainty: certaintyBase,
          safety: severity,
          evidence: [dtcEvidence(dtc.code, knowledge.technical)],
          origin: dtc.origin,
        },
      });

      if (severity === 'critical' || severity === 'important') {
        effects.push({
          kind: 'safety',
          level: severity,
          reasonFr: `${knowledge.code} : ${knowledge.consequences[0] ?? 'Défaut à traiter rapidement.'}`,
          reasonEn: `${knowledge.code}: ${knowledge.consequences[0] ?? 'Fault to address promptly.'}`,
          evidence: [dtcEvidence(dtc.code, knowledge.technical)],
        });
      }

      // Hypothèses issues de la base de connaissances, pondérées par le statut.
      for (const cause of knowledge.likelyCauses) {
        const sameCodeFamily = ctx.dtcs.filter((d) => knowledge.relatedCodes?.includes(d.code));
        const reinforcement = sameCodeFamily.length > 0 ? 0.06 : 0;
        effects.push({
          kind: 'cause',
          cause: {
            causeKey: cause.key,
            labelFr: cause.labelFr,
            labelEn: cause.labelEn,
            delta: cause.baseRate * STATUS_WEIGHT[dtc.status] + reinforcement,
            weight: 'documented',
            reasonFr: `Hypothèse issue de la base de connaissances pour ${knowledge.code} (statut ${status.fr}).${reinforcement ? ` Renforcée par la présence simultanée de ${sameCodeFamily.map((d) => d.code).join(', ')}.` : ''}`,
            reasonEn: `Hypothesis from the knowledge base for ${knowledge.code} (status ${status.en}).${reinforcement ? ` Reinforced by the simultaneous presence of ${sameCodeFamily.map((d) => d.code).join(', ')}.` : ''}`,
            evidence: [dtcEvidence(knowledge.code, knowledge.technical)],
            confirmedByTest: cause.confirmedBy,
            parts: cause.parts,
          },
        });
      }

      // Tests proposés : les tests liés au code, plus ceux qui confirment une cause.
      knowledge.relatedTests.forEach((testKey, index) => {
        const test = TEST_BY_ID.get(testKey);
        if (!test) return;
        const alreadyProposed = effects.some((e) => e.kind === 'test' && e.testKey === testKey);
        if (alreadyProposed) return;
        effects.push({
          kind: 'test',
          testKey,
          priority: 10 + index,
          reasonFr: `Test proposé pour le défaut ${knowledge.code} : ${test.objectiveFr}`,
          reasonEn: `Test proposed for fault ${knowledge.code}: ${test.objectiveEn}`,
        });
      });

      // Effacement : à ne pas proposer aveuglément.
      if (dtc.status === 'permanent') {
        effects.push({
          kind: 'note',
          textFr: `Le code ${knowledge.code} est PERMANENT : il ne peut pas être effacé par un outil de diagnostic. Il disparaîtra de lui-même uniquement après plusieurs cycles de conduite réussis. Un effacement ne doit donc pas être utilisé comme test.`,
          textEn: `Code ${knowledge.code} is PERMANENT: it cannot be cleared by a diagnostic tool. It will only clear itself after several successful drive cycles. Clearing must therefore not be used as a test.`,
          level: 'attention',
        });
      }

      if (dtc.occurrences > 3) {
        effects.push({
          kind: 'note',
          textFr: `Ce défaut a été détecté ${dtc.occurrences} fois : il est récurrent et non accidentel.`,
          textEn: `This fault has been detected ${dtc.occurrences} times: it is recurrent rather than incidental.`,
        });
      }
    }

    // Raisonnement croisé : plusieurs codes qui renvoient à la même cause.
    const byCause = new Map<string, string[]>();
    for (const dtc of ctx.dtcs) {
      const k = findDtcKnowledge(dtc.code);
      if (!k) continue;
      for (const cause of k.likelyCauses) {
        const list = byCause.get(cause.key) ?? [];
        list.push(dtc.code);
        byCause.set(cause.key, list);
      }
    }
    for (const [causeKey, linkedCodes] of byCause) {
      if (linkedCodes.length >= 2) {
        effects.push({
          kind: 'note',
          textFr: `La cause potentielle « ${causeKey} » apparaît dans les hypothèses de ${linkedCodes.join(' et ')} : ces codes se renforcent mutuellement, sans constituer une preuve.`,
          textEn: `The potential cause "${causeKey}" appears in the hypotheses of ${linkedCodes.join(' and ')}: these codes reinforce each other without constituting proof.`,
        });
      }
    }

    // Corrélation avec les autres codes présents.
    const present = new Set(codes);
    for (const dtc of ctx.dtcs) {
      const k = findDtcKnowledge(dtc.code);
      if (!k?.relatedCodes) continue;
      const found = k.relatedCodes.filter((c) => present.has(c));
      if (found.length > 0) {
        effects.push({
          kind: 'note',
          textFr: `Le code ${dtc.code} est fréquemment associé à ${found.join(', ')}. Le diagnostic doit traiter l’ensemble plutôt que chaque code isolément.`,
          textEn: `Code ${dtc.code} is frequently associated with ${found.join(', ')}. The diagnosis must address the whole set rather than each code in isolation.`,
        });
      }
    }

    return effects;
  },
};

/**
 * Règle de cohérence des DTC : un défaut actif sans données d'accompagnement
 * limite la conclusion possible.
 */
export const ruleDtcWithoutData: Rule = {
  id: 'rule_dtc_without_data',
  domain: 'dtc',
  titleFr: 'Défaut présent mais données insuffisantes',
  titleEn: 'Fault present but insufficient data',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => ctx.dtcs.length > 0 && ctx.readings.filter((r) => r.supported && r.value !== null).length < 3,
  apply: (ctx) => [
    {
      kind: 'finding',
      finding: {
        kind: 'coherence',
        titleFr: 'Défauts lus, mais trop peu de mesures disponibles',
        titleEn: 'Faults read, but too few measurements available',
        detailFr: `${ctx.dtcs.length} défaut(s) ont été lus, mais seules ${ctx.readings.filter((r) => r.supported && r.value !== null).length} mesure(s) exploitable(s) sont disponibles. Il n’est pas possible de relier un code à une cause probable dans ces conditions.`,
        detailEn: `${ctx.dtcs.length} fault(s) were read, but only ${ctx.readings.filter((r) => r.supported && r.value !== null).length} usable measurement(s) are available. It is not possible to link a code to a probable cause under these conditions.`,
        certainty: 'undeterminable',
        safety: 'attention',
        evidence: ctx.dtcs.slice(0, 5).map((d) => dtcEvidence(d.code, 'Défaut lu')),
        origin: ctx.source === 'simulator' ? 'simulated' : 'measured',
      },
    },
    { kind: 'certaintyCap', level: 'possible', reasonFr: 'Pas assez de mesures pour choisir entre les causes possibles.', reasonEn: 'Not enough measurements to choose between possible causes.' },
    { kind: 'missing', itemFr: 'Un nouveau scan moteur chaud avec au moins les mesures de base (régime, température, charge, tension)', itemEn: 'A new scan with a warm engine including at least base measurements (rpm, temperature, load, voltage)', blocksConclusion: true },
  ],
};

export const DTC_RULES: Rule[] = [ruleDtcKnowledge, ruleDtcWithoutData];

export type { SafetyLevel };
