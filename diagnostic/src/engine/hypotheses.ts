/**
 * XAMOTO — Construction et pondération des hypothèses.
 *
 * ⚠️ Principe fondamental (§16, §47-1 et §47-3) :
 * les scores internes servent UNIQUEMENT à ordonner les hypothèses. Le niveau
 * de certitude affiché à l'utilisateur est calculé par des règles strictes :
 *
 *  – CONFIRMÉ : un test guidé a confirmé la cause, ou la cause est directement
 *    mesurée (ex. tension de charge mesurée à 11,9 V moteur tournant).
 *  – FORTEMENT COMPATIBLE : au moins une mesure directe soutient la cause et
 *    le score pondéré dépasse le seuil haut.
 *  – POSSIBLE : la cause est compatible avec un code défaut ou un symptôme,
 *    sans mesure directe.
 *  – INDÉTERMINABLE : les informations disponibles se contredisent.
 *  – NON DISPONIBLE : XAMOTO ne possède pas les données nécessaires.
 *
 * Une hypothèse « possible » ne doit JAMAIS être présentée comme certaine.
 */
import type { CertaintyLevel, EvidenceRef, Hypothesis } from '@xamoto/shared';
import { CERTAINTY_RANK } from '@xamoto/shared';
import type { CauseEffect, DiagnosticContext } from '../rules/types.js';

interface Accumulator {
  causeKey: string;
  labelFr: string;
  labelEn: string;
  documented: number;
  measured: number;
  symptom: number;
  history: number;
  test: number;
  reasons: Array<{ fr: string; en: string }>;
  evidence: EvidenceRef[];
  parts: Set<string>;
  confirmedByTest?: string;
  /** Cause explicitement écartée par un test négatif. */
  excluded: boolean;
  exclusionReason?: { fr: string; en: string };
  /** Sources documentaires utilisées (audit §33). */
  origins: Set<string>;
}

export interface HypothesisBuildResult {
  hypotheses: Hypothesis[];
  /** Traces des leviers internes, pour la transparence du rapport. */
  debug: Array<{ causeKey: string; score: number; certainty: CertaintyLevel; components: Record<string, number> }>;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function buildHypotheses(
  causes: CauseEffect[],
  exclusions: Array<{ causeKey: string; reasonFr: string; reasonEn: string }>,
  ctx: DiagnosticContext,
  certaintyCap?: CertaintyLevel,
): HypothesisBuildResult {
  const acc = new Map<string, Accumulator>();

  for (const effect of causes) {
    const existing = acc.get(effect.causeKey) ?? {
      causeKey: effect.causeKey,
      labelFr: effect.labelFr,
      labelEn: effect.labelEn,
      documented: 0,
      measured: 0,
      symptom: 0,
      history: 0,
      test: 0,
      reasons: [],
      evidence: [],
      parts: new Set<string>(),
      excluded: false,
      origins: new Set<string>(),
    };
    // Recalcul propre des labels (le premier libellé vu peut être moins précis).
    if (effect.labelFr.length > existing.labelFr.length) existing.labelFr = effect.labelFr;
    if (effect.labelEn.length > existing.labelEn.length) existing.labelEn = effect.labelEn;

    switch (effect.weight) {
      case 'measured':
        existing.measured += effect.delta;
        break;
      case 'documented':
        existing.documented += effect.delta;
        break;
      case 'symptom':
        existing.symptom += effect.delta;
        break;
      case 'history':
        existing.history += effect.delta;
        break;
      case 'test':
        existing.test += effect.delta;
        break;
    }
    existing.reasons.push({ fr: effect.reasonFr, en: effect.reasonEn });
    for (const evidence of effect.evidence ?? []) existing.evidence.push(evidence);
    for (const part of effect.parts ?? []) existing.parts.add(part);
    if (effect.confirmedByTest) existing.confirmedByTest = effect.confirmedByTest;
    existing.origins.add(effect.weight);
    acc.set(effect.causeKey, existing);
  }

  for (const exclusion of exclusions) {
    const existing = acc.get(exclusion.causeKey);
    if (existing) {
      existing.excluded = true;
      existing.exclusionReason = { fr: exclusion.reasonFr, en: exclusion.reasonEn };
      acc.set(exclusion.causeKey, existing);
    }
  }

  const hypotheses: Hypothesis[] = [];
  const debug: HypothesisBuildResult['debug'] = [];

  for (const item of acc.values()) {
    // Une cause écartée par un test n'est pas une hypothèse : elle disparaît.
    if (item.excluded) continue;

    // Pondération : les données mesurées et les tests pèsent plus lourd que
    // les connaissances générales, qui ne peuvent jamais conclure seules.
    const weighted = item.test * 1.05 + item.measured * 1 + item.history * 0.8 + item.documented * 0.85 + item.symptom * 0.7;
    const score = clamp(weighted);

    const independentSources =
      (item.measured > 0 ? 1 : 0) + (item.test > 0 ? 1 : 0) + (item.documented > 0 ? 1 : 0) + (item.symptom > 0 ? 1 : 0) + (item.history > 0 ? 1 : 0);

    let certainty: CertaintyLevel;
    if (item.test > 0) {
      certainty = 'confirmed';
    } else if (item.measured >= 0.25 && score >= 0.45 && independentSources >= 1) {
      certainty = 'strongly_compatible';
    } else if (score >= 0.22) {
      certainty = 'possible';
    } else if (score > 0.05) {
      certainty = 'possible';
    } else {
      certainty = 'undeterminable';
    }

    // Aucune donnée mesurée : impossible de dépasser « possible ».
    const hasMeasuredData = ctx.readings.some((r) => r.supported && r.value !== null);
    if (!hasMeasuredData && CERTAINTY_RANK[certainty] > CERTAINTY_RANK['strongly_compatible']) {
      certainty = 'strongly_compatible';
    }
    if (!hasMeasuredData && item.measured === 0 && certainty === 'strongly_compatible') {
      certainty = 'possible';
    }

    // Les hypothèses uniquement documentaires (un code lu, pas de mesure) ne
    // peuvent pas dépasser « possible ».
    if (item.measured === 0 && item.test === 0) {
      certainty = 'possible';
    }

    // Plafond imposé par le moteur (données insuffisantes, moteur froid…).
    if (certaintyCap && CERTAINTY_RANK[certainty] > CERTAINTY_RANK[certaintyCap]) {
      certainty = certaintyCap;
    }

    const reasoning = [
      ...item.reasons.slice(0, 6).map((r) => r.fr),
      `Score interne : ${score.toFixed(2)} (mesuré ${item.measured.toFixed(2)}, documenté ${item.documented.toFixed(2)}, symptôme ${item.symptom.toFixed(2)}, historique ${item.history.toFixed(2)}, test ${item.test.toFixed(2)}). Ce score sert à ordonner : il ne remplace pas un test.`,
    ];

    hypotheses.push({
      id: `hyp_${item.causeKey}`,
      causeKey: item.causeKey,
      labelFr: item.labelFr,
      labelEn: item.labelEn,
      score: Number(score.toFixed(3)),
      certainty,
      reasoning,
      supporting: [...new Set(item.evidence.map((e) => `${e.label}${e.value !== undefined && e.value !== null ? ` (${e.value})` : ''}`))],
      contradicting: [],
      discriminatingTests: item.confirmedByTest ? [item.confirmedByTest] : [],
      parts: [...item.parts],
    });

    debug.push({
      causeKey: item.causeKey,
      score: Number(score.toFixed(3)),
      certainty,
      components: { measured: item.measured, documented: item.documented, symptom: item.symptom, history: item.history, test: item.test },
    });
  }

  hypotheses.sort((a, b) => b.score - a.score);
  debug.sort((a, b) => b.score - a.score);

  return { hypotheses, debug };
}

/**
 * Conclusion lisible : composée par le moteur, jamais par l'IA seule.
 * Elle respecte toujours la hiérarchie de certitude.
 */
export function composeConclusion(
  hypotheses: Hypothesis[],
  certainty: CertaintyLevel,
  locale: 'fr' | 'en' = 'fr',
  options: { noData?: boolean; dtcCount?: number } = {},
): { fr: string; en: string } {
  const fr = locale === 'fr';
  if (options.noData) {
    return {
      fr: 'XAMOTO ne dispose pas des données nécessaires pour établir un diagnostic. Effectuez un scan avec le contact mis (moteur tournant si possible) ou déclarez les symptômes observés.',
      en: 'XAMOTO does not have the data required to establish a diagnosis. Perform a scan with the ignition on (engine running if possible) or declare the observed symptoms.',
    };
  }

  const top = hypotheses[0];
  const second = hypotheses[1];

  if (!top) {
    return {
      fr: 'Aucune hypothèse technique n’a pu être établie à partir des données disponibles.',
      en: 'No technical hypothesis could be established from the available data.',
    };
  }

  const label = fr ? top.labelFr : top.labelEn;
  const secondLabel = second ? (fr ? second.labelFr : second.labelEn) : null;

  const certaintySentence: Record<CertaintyLevel, { fr: string; en: string }> = {
    confirmed: {
      fr: `Une cause est confirmée par les données ou un test : ${label}.`,
      en: `One cause is confirmed by data or a test: ${label}.`,
    },
    strongly_compatible: {
      fr: `Les données disponibles indiquent fortement : ${label}.`,
      en: `The available data strongly indicates: ${label}.`,
    },
    possible: {
      fr: `Plusieurs causes restent possibles. La plus compatible avec les données actuelles est : ${label}.`,
      en: `Several causes remain possible. The most compatible with current data is: ${label}.`,
    },
    undeterminable: {
      fr: 'Les données disponibles ne permettent pas de désigner une cause. Une hypothèse reste à l’étude sans pouvoir être privilégiée.',
      en: 'The available data does not allow identifying a cause. A hypothesis remains under consideration without being prioritised.',
    },
    unavailable: {
      fr: 'XAMOTO ne dispose pas des données nécessaires pour conclure sur ce point.',
      en: 'XAMOTO does not have the data required to conclude on this point.',
    },
  };

  let conclusion = certaintySentence[certainty][fr ? 'fr' : 'en'];
  if (secondLabel && certainty !== 'confirmed') {
    conclusion += fr
      ? ` Une autre cause reste compatible : ${secondLabel}. Un test est nécessaire pour trancher.`
      : ` Another cause remains compatible: ${secondLabel}. A test is required to decide.`;
  }
  if (options.dtcCount && options.dtcCount > 1) {
    conclusion += fr
      ? ` ${options.dtcCount} défauts ont été lus : ils doivent être traités ensemble, car certains se renforcent mutuellement.`
      : ` ${options.dtcCount} faults were read: they must be addressed together, as some reinforce each other.`;
  }
  return { fr: conclusion, en: conclusion };
}
