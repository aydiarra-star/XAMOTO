/**
 * XAMOTO — Deuxième avis (§20).
 *
 * L'utilisateur a reçu un diagnostic (garage, vendeur, autre application) et
 * demande à XAMOTO de l'analyser. XAMOTO ne dit jamais « ce diagnostic est
 * faux » : il sépare ce que les DONNÉES confirment, ce qu'elles ne confirment
 * pas, et ce que les tests pourraient trancher.
 */
import type { CertaintyLevel, Hypothesis, SymptomInput } from '@xamoto/shared';
import type { DiagnosticContext, DtcInput, ReadingInput } from '../rules/types.js';
import type { DiagnosticResult } from './index.js';

export interface SecondOpinionInput {
  /** Diagnostic reçu, tel qu'il a été communiqué à l'utilisateur. */
  externalDiagnosis: string;
  /** Causes annoncées par le diagnostic externe (mots-clés libres acceptés). */
  externalCauses?: string[];
  /** Réparation proposée par le professionnel. */
  proposedRepair?: string | null;
  /** Montant annoncé, si communiqué. */
  proposedAmount?: number | null;
  currency?: string | null;
  context: DiagnosticContext;
}

export interface SecondOpinionResult {
  /** Éléments soutenus par les données du véhicule. */
  confirmedElements: Array<{ label: string; certainty: CertaintyLevel; why: string }>;
  /** Éléments que les données ne soutiennent pas (sans dire qu'ils sont faux). */
  unconfirmedElements: Array<{ label: string; why: string }>;
  /** Hypothèses alternatives issues du moteur de diagnostic. */
  alternativeHypotheses: Hypothesis[];
  /** Tests qui permettraient de trancher avant d'engager des frais. */
  additionalTests: Array<{ testKey: string; title: string; objective: string; priority: number }>;
  /** Résumé prudent. */
  summaryFr: string;
  summaryEn: string;
  /** Avertissement : XAMOTO ne juge pas un professionnel, il vérifie des données. */
  disclaimerFr: string;
  disclaimerEn: string;
  /** Points factuels à demander au garage (aucun jugement de valeur). */
  questionsFr: string[];
  questionsEn: string[];
}

const STOP_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'en', 'à', 'a', 'the', 'of', 'and', 'for', 'on', 'in', 'with', 'sur', 'par', 'est', 'son', 'sa']);

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

/** Correspondance approximative entre un libellé humain et une hypothèse du moteur. */
function matches(hypothesisLabel: string, externalLabel: string): boolean {
  const h = keywords(hypothesisLabel);
  const e = keywords(externalLabel);
  if (h.length === 0 || e.length === 0) return false;
  const common = h.filter((w) => e.some((x) => x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5))));
  return common.length >= 1;
}

export function secondOpinion(input: SecondOpinionInput, result: DiagnosticResult): SecondOpinionResult {
  const externalLabels = [
    ...(input.externalCauses ?? []),
    ...(input.proposedRepair ? [input.proposedRepair] : []),
    input.externalDiagnosis,
  ].filter((s) => s && s.trim().length > 2);

  const confirmedElements: SecondOpinionResult['confirmedElements'] = [];
  const unconfirmedElements: SecondOpinionResult['unconfirmedElements'] = [];

  /* 1. Codes défaut réellement lus : ce sont des faits mesurés. */
  for (const dtc of input.context.dtcs as DtcInput[]) {
    confirmedElements.push({
      label: `Code défaut ${dtc.code} (${dtc.status})`,
      certainty: dtc.status === 'pending' ? 'possible' : 'strongly_compatible',
      why:
        dtc.status === 'pending'
          ? 'Le calculateur a détecté la condition mais ne l’a pas encore confirmée sur un cycle complet.'
          : 'Ce code a réellement été lu dans le calculateur du véhicule : sa présence n’est pas discutable, sa cause l’est.',
    });
  }

  /* 2. Mesures hors plage : également des faits. */
  const outOfRange = (input.context.readings as ReadingInput[]).filter((r) => {
    if (!r.supported || r.value === null || !r.ref) return false;
    const { normalMin, normalMax } = r.ref;
    if (normalMin !== undefined && r.value < normalMin) return true;
    if (normalMax !== undefined && r.value > normalMax) return true;
    return false;
  });
  for (const reading of outOfRange) {
    confirmedElements.push({
      label: `${reading.label} : ${reading.value} ${reading.unit} (hors plage normale attendue)`,
      certainty: 'strongly_compatible',
      why: 'Cette valeur est mesurée sur le véhicule et sort de la plage généralement admise. Cela ne désigne pas encore la pièce responsable.',
    });
  }

  /* 3. Comparaison entre causes annoncées et hypothèses du moteur. */
  for (const label of externalLabels) {
    const match = result.hypotheses.find((h) => matches(h.labelFr, label) || matches(h.labelEn, label));
    if (match && (match.certainty === 'confirmed' || match.certainty === 'strongly_compatible')) {
      confirmedElements.push({
        label,
        certainty: match.certainty,
        why: `Les données du véhicule soutiennent cette piste (certitude moteur : ${match.certainty}).`,
      });
    } else if (match) {
      unconfirmedElements.push({
        label,
        why: `Cette piste figure dans les hypothèses du moteur, mais au niveau « ${match.certainty} » : les données disponibles ne suffisent pas à la soutenir, et un test est nécessaire.`,
      });
    } else {
      unconfirmedElements.push({
        label,
        why:
          'Les données lues sur le véhicule ne permettent ni de confirmer ni d’écarter cette piste : elle n’apparaît pas parmi les hypothèses calculées à partir des mesures disponibles. Cela ne signifie pas qu’elle est fausse, mais qu’elle n’est pas vérifiable avec les données actuelles.',
      });
    }
  }

  /* 4. Hypothèses alternatives. */
  const alternatives = result.hypotheses.filter(
    (h) => !externalLabels.some((label) => matches(h.labelFr, label)) && h.certainty !== 'unavailable',
  );

  /* 5. Tests supplémentaires. */
  const additionalTests = result.tests.slice(0, 5).map((t) => ({ testKey: t.testKey, title: t.testKey, objective: t.reasonFr, priority: t.priority }));

  const summaryFr =
    confirmedElements.length === 0 && unconfirmedElements.length === 0
      ? 'XAMOTO ne dispose pas d’éléments suffisants pour analyser ce diagnostic. Effectuez d’abord un scan du véhicule.'
      : `À partir des données lues sur votre véhicule : ${confirmedElements.length} élément(s) sont soutenus par les mesures, ${unconfirmedElements.length} élément(s) ne peuvent être ni confirmés ni écartés. ${alternatives.length} hypothèse(s) alternative(s) restent possibles. Les tests proposés permettent de trancher avant d’engager des frais.`;
  const summaryEn =
    confirmedElements.length === 0 && unconfirmedElements.length === 0
      ? 'XAMOTO does not have enough elements to analyse this diagnosis. First perform a vehicle scan.'
      : `Based on the data read from your vehicle: ${confirmedElements.length} element(s) are supported by measurements, ${unconfirmedElements.length} element(s) can be neither confirmed nor ruled out. ${alternatives.length} alternative hypothesis(es) remain possible. The proposed tests allow deciding before spending money.`;

  return {
    confirmedElements,
    unconfirmedElements,
    alternativeHypotheses: alternatives,
    additionalTests,
    summaryFr,
    summaryEn,
    disclaimerFr:
      'XAMOTO ne porte aucun jugement sur le professionnel, la qualité de son travail ou le prix demandé. Il compare les données lues sur le véhicule avec les éléments annoncés, et propose des tests objectifs.',
    disclaimerEn:
      'XAMOTO makes no judgement about the professional, the quality of their work or the price. It compares data read from the vehicle with the stated elements and proposes objective tests.',
    questionsFr: [
      'Pouvez-vous me montrer les codes défaut lus et leurs valeurs mémorisées (freeze frame) ?',
      'Quel test a permis de conclure à cette cause plutôt qu’à une autre cause possible ?',
      'Existe-t-il une solution moins coûteuse à essayer avant le remplacement de cette pièce ?',
      'La pièce proposée est-elle neuve, reconditionnée ou d’occasion, et quelle garantie s’applique ?',
      'Le devis distingue-t-il main-d’œuvre, pièces et diagnostic ?',
    ],
    questionsEn: [
      'Can you show me the fault codes read and their stored values (freeze frame)?',
      'Which test led you to conclude this cause rather than another possible cause?',
      'Is there a less costly option to try before replacing this part?',
      'Is the proposed part new, refurbished or used, and what warranty applies?',
      'Does the quote separate labour, parts and diagnosis?',
    ],
  };
}
