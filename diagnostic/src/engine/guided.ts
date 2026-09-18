/**
 * XAMOTO — Diagnostic guidé (§17).
 *
 * « XAMOTO doit pouvoir transformer un diagnostic complexe en étapes simples. »
 *
 * Le guidage est déterministe : à chaque étape, le moteur sait exactement
 * quelle information lui manque et comment l'obtenir. L'ordre est conçu pour
 * obtenir le maximum d'information au coût le plus faible :
 *
 *   1. expliquer le code,
 *   2. identifier le système concerné,
 *   3. demander les symptômes,
 *   4. analyser les données disponibles,
 *   5. proposer les vérifications pertinentes,
 *   6. demander le résultat,
 *   7. éliminer certaines hypothèses,
 *   8. poursuivre,
 *   9. fournir les conclusions possibles.
 */
import type { SymptomKey } from '@xamoto/shared';
import { SYMPTOM_BY_KEY } from '../knowledge/symptoms.js';
import { TEST_BY_ID } from '../knowledge/tests.js';
import { findDtcKnowledge } from '../knowledge/dtc.js';
import type { DiagnosticContext } from '../rules/types.js';
import type { DiagnosticResult } from './index.js';

export type GuidedStepKind = 'explain' | 'symptoms' | 'data' | 'test' | 'result' | 'conclusion' | 'professional';

export interface GuidedStep {
  index: number;
  kind: GuidedStepKind;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
  /** Question posée à l'utilisateur, si l'étape en comporte une. */
  question?: { fr: string; en: string };
  /** Symptômes à demander (étape « symptômes »). */
  symptomsToAsk?: SymptomKey[];
  /** Test à réaliser (étape « test »). */
  testKey?: string;
  /** Données manquantes qui motivent l'étape. */
  missingFr?: string[];
}

export interface GuidedSession {
  steps: GuidedStep[];
  /** Étape courante suggérée. */
  nextStep: GuidedStep;
  totalSteps: number;
  progressPercent: number;
}

/** Symptômes pertinents pour un ensemble de codes défaut. */
export function relevantSymptoms(ctx: DiagnosticContext): SymptomKey[] {
  const systems = new Set<string>();
  for (const dtc of ctx.dtcs) {
    const knowledge = findDtcKnowledge(dtc.code);
    if (knowledge) systems.add(knowledge.system);
  }
  const priority: SymptomKey[] = [];
  const all = [...SYMPTOM_BY_KEY.values()];
  for (const symptom of all) {
    if (symptom.systems.some((s) => systems.has(s))) priority.push(symptom.key);
  }
  // On complète avec les symptômes généraux les plus discriminants.
  const fallback: SymptomKey[] = ['rough_idle', 'loss_of_power', 'hard_start', 'excessive_fuel_consumption'];
  for (const key of fallback) if (!priority.includes(key)) priority.push(key);
  return priority.slice(0, 8);
}

export function buildGuidedSession(ctx: DiagnosticContext, result: DiagnosticResult): GuidedSession {
  const steps: GuidedStep[] = [];
  let index = 1;

  /* 1. Expliquer le(s) code(s). */
  if (ctx.dtcs.length > 0) {
    const explanations = ctx.dtcs.slice(0, 4).map((dtc) => {
      const knowledge = findDtcKnowledge(dtc.code);
      if (!knowledge) {
        return `${dtc.code} : XAMOTO ne dispose pas de la définition de ce code pour votre véhicule. Il n’inventera pas d’explication.`;
      }
      return `${knowledge.code} — ${knowledge.simpleFr}`;
    });
    steps.push({
      index: index++,
      kind: 'explain',
      titleFr: 'Comprendre ce que le véhicule signale',
      titleEn: 'Understand what the vehicle reports',
      bodyFr: explanations.join('\n\n'),
      bodyEn: ctx.dtcs
        .slice(0, 4)
        .map((dtc) => {
          const knowledge = findDtcKnowledge(dtc.code);
          return knowledge ? `${knowledge.code} — ${knowledge.simpleEn}` : `${dtc.code}: no definition available.`;
        })
        .join('\n\n'),
    });
  }

  /* 2. Système concerné. */
  if (ctx.dtcs.length > 0) {
    const systems = [...new Set(ctx.dtcs.map((d) => findDtcKnowledge(d.code)?.system).filter(Boolean))];
    if (systems.length > 0) {
      steps.push({
        index: index++,
        kind: 'data',
        titleFr: 'Système concerné',
        titleEn: 'Affected system',
        bodyFr: `Les codes lus concernent : ${systems.join(', ')}. XAMOTO va concentrer la recherche sur ce périmètre et ne pas disperser les vérifications.`,
        bodyEn: `The codes read concern: ${systems.join(', ')}. XAMOTO will focus the investigation on this scope rather than spreading checks.`,
      });
    }
  }

  /* 3. Symptômes. */
  const alreadyDeclared = new Set(ctx.symptoms.filter((s) => s.present).map((s) => s.key));
  const toAsk = relevantSymptoms(ctx).filter((k) => !alreadyDeclared.has(k));
  steps.push({
    index: index++,
    kind: 'symptoms',
    titleFr: 'Décrire ce que vous observez',
    titleEn: 'Describe what you observe',
    bodyFr:
      'Les symptômes sont aussi importants que les codes : ils permettent de distinguer des causes que les codes seuls ne séparent pas. Répondez uniquement pour ce que vous constatez réellement.',
    bodyEn:
      'Symptoms matter as much as codes: they help distinguish causes that codes alone cannot separate. Answer only for what you actually observe.',
    question: { fr: 'Parmi ces symptômes, lesquels observez-vous ?', en: 'Which of these symptoms do you observe?' },
    symptomsToAsk: toAsk,
  });

  /* 4. Analyse des données. */
  const supported = ctx.readings.filter((r) => r.supported && r.value !== null);
  steps.push({
    index: index++,
    kind: 'data',
    titleFr: 'Données déjà disponibles',
    titleEn: 'Data already available',
    bodyFr: `${supported.length} mesure(s) exploitable(s) sur ${ctx.readings.length} interrogée(s). ${result.missingData.length > 0 ? `Il manque : ${result.missingData.map((m) => m.fr).join(' ; ')}.` : 'Aucune donnée essentielle ne manque.'}`,
    bodyEn: `${supported.length} usable measurement(s) out of ${ctx.readings.length} requested. ${result.missingData.length > 0 ? `Missing: ${result.missingData.map((m) => m.en).join('; ')}.` : 'No essential data is missing.'}`,
    missingFr: result.missingData.map((m) => m.fr),
  });

  /* 5. Tests. */
  const nextTests = result.tests.slice(0, 3);
  for (const test of nextTests) {
    const definition = TEST_BY_ID.get(test.testKey);
    if (!definition) continue;
    steps.push({
      index: index++,
      kind: 'test',
      titleFr: `Vérification à effectuer : ${definition.titleFr}`,
      titleEn: `Check to perform: ${definition.titleEn}`,
      bodyFr: [
        `Objectif : ${definition.objectiveFr}`,
        definition.equipment.length > 0 ? `Matériel nécessaire : ${definition.equipment.join(', ')}.` : 'Aucun matériel particulier nécessaire.',
        `Procédure : ${definition.stepsFr.map((s, i) => `${i + 1}) ${s}`).join(' ')}`,
        definition.expectedFr ? `Résultat attendu : ${definition.expectedFr}` : 'XAMOTO ne dispose pas de valeur de référence pour ce véhicule : le test reste utile par comparaison.',
        `Pourquoi ce test maintenant : ${test.reasonFr}`,
      ].join('\n\n'),
      bodyEn: [
        `Objective: ${definition.objectiveEn}`,
        definition.equipment.length > 0 ? `Equipment needed: ${definition.equipment.join(', ')}.` : 'No particular equipment needed.',
        `Procedure: ${definition.stepsEn.map((s, i) => `${i + 1}) ${s}`).join(' ')}`,
        definition.expectedEn ? `Expected result: ${definition.expectedEn}` : 'XAMOTO has no reference value for this vehicle: the test is still useful by comparison.',
        `Why this test now: ${test.reasonEn}`,
      ].join('\n\n'),
      question: { fr: 'Quel est le résultat de ce test ?', en: 'What is the result of this test?' },
      testKey: test.testKey,
    });
  }

  /* 6. Élimination d'hypothèses. */
  if (result.hypotheses.length > 1) {
    steps.push({
      index: index++,
      kind: 'result',
      titleFr: 'Éliminer les hypothèses écartées',
      titleEn: 'Rule out excluded hypotheses',
      bodyFr: `Selon vos réponses, certaines hypothèses seront éliminées et d’autres renforcées. Aujourd’hui, ${result.hypotheses.length} hypothèses restent ouvertes, dont ${result.hypotheses.filter((h) => h.certainty === 'strongly_compatible' || h.certainty === 'confirmed').length} soutenue(s) par des données.`,
      bodyEn: `Depending on your answers, some hypotheses will be eliminated and others reinforced. Today, ${result.hypotheses.length} hypotheses remain open, of which ${result.hypotheses.filter((h) => h.certainty === 'strongly_compatible' || h.certainty === 'confirmed').length} supported by data.`,
    });
  }

  /* 7. Conclusion possible. */
  steps.push({
    index: index++,
    kind: 'conclusion',
    titleFr: 'Conclusions possibles à ce stade',
    titleEn: 'Possible conclusions at this stage',
    bodyFr:
      result.hypotheses.length === 0
        ? 'Aucune conclusion technique ne peut être proposée avec les données actuelles.'
        : result.hypotheses
            .slice(0, 3)
            .map(
              (h, i) =>
                `${i + 1}. ${h.labelFr} — niveau : ${h.certainty === 'confirmed' ? 'confirmé' : h.certainty === 'strongly_compatible' ? 'fortement compatible' : h.certainty === 'possible' ? 'possible' : 'indéterminable'}. ${h.discriminatingTests.length > 0 ? `Test décisif : ${TEST_BY_ID.get(h.discriminatingTests[0] as string)?.titleFr ?? h.discriminatingTests[0]}.` : 'Aucun test de confirmation n’est disponible pour cette hypothèse.'}`,
            )
            .join('\n'),
    bodyEn:
      result.hypotheses.length === 0
        ? 'No technical conclusion can be proposed with the current data.'
        : result.hypotheses
            .slice(0, 3)
            .map((h, i) => `${i + 1}. ${h.labelEn} — level: ${h.certainty.replace(/_/g, ' ')}.`)
            .join('\n'),
  });

  /* 8. Orientation professionnelle. */
  if (result.safety === 'important' || result.safety === 'critical' || result.certainty === 'undeterminable') {
    steps.push({
      index: index++,
      kind: 'professional',
      titleFr: 'Quand consulter un professionnel',
      titleEn: 'When to see a professional',
      bodyFr: result.canIDrive.seeProfessionalFr,
      bodyEn: result.canIDrive.seeProfessionalEn,
    });
  }

  const progressPercent = Math.round(((ctx.symptoms.length > 0 ? 1 : 0) + (ctx.readings.length > 0 ? 1 : 0)) / 2 * 100);

  return {
    steps,
    nextStep: steps.find((s) => s.kind === 'symptoms' && (s.symptomsToAsk?.length ?? 0) > 0) ?? steps[0] ?? {
      index: 1,
      kind: 'data',
      titleFr: 'Aucune étape disponible',
      titleEn: 'No step available',
      bodyFr: 'Effectuez un scan pour démarrer un diagnostic guidé.',
      bodyEn: 'Perform a scan to start a guided diagnosis.',
    },
    totalSteps: steps.length,
    progressPercent,
  };
}
