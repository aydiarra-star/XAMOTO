/**
 * XAMOTO — Moteur de diagnostic déterministe (§9).
 *
 * Enchaînement imposé :
 *   données véhicule → DTC → PID → symptômes → historique
 *   → règles techniques → base de connaissances → tests guidés
 *   → MOTEUR DE DIAGNOSTIC (ici) → IA explicative (jamais décisionnaire).
 *
 * Le moteur est PUR : mêmes entrées → mêmes sorties, aucune dépendance à un
 * modèle de langage, aucun appel réseau. Chaque conclusion porte un niveau de
 * certitude et un niveau de sécurité, et chaque score est traçable (§47-8).
 */
import type {
  CertaintyLevel,
  DataOrigin,
  DiagnosticTest,
  EvidenceRef,
  Finding,
  Hypothesis,
  PidKey,
  SafetyLevel,
  SymptomInput,
} from '@xamoto/shared';
import { CERTAINTY_RANK, MESSAGES, weakestCertainty, worstSafety } from '@xamoto/shared';
import { ALL_RULES, ENGINE_RULES_VERSION } from '../rules/index.js';
import type { CauseEffect, DiagnosticContext, RuleEffect } from '../rules/types.js';
import { findDtcKnowledge } from '../knowledge/dtc.js';
import { TEST_BY_ID, FALLBACK_TESTS } from '../knowledge/tests.js';
import { SYMPTOM_BY_KEY } from '../knowledge/symptoms.js';
import { assessSafety, type SafetyAssessment, type SafetyReason } from '../safety/index.js';
import { canIDrive, type CanIDriveAnswer } from '../safety/canIDrive.js';

export const ENGINE_VERSION = `${ENGINE_RULES_VERSION}-xamoto-diag`;

export interface DiagnosticNote {
  textFr: string;
  textEn: string;
  level: SafetyLevel;
}

export interface DiagnosticResult {
  engineVersion: string;
  rulesFired: string[];
  findings: Finding[];
  hypotheses: Hypothesis[];
  tests: DiagnosticTest[];
  notes: DiagnosticNote[];
  missingData: Array<{ fr: string; en: string; blocksConclusion: boolean }>;
  certainty: CertaintyLevel;
  safety: SafetyLevel;
  safetyAssessment: SafetyAssessment;
  conclusionFr: string;
  conclusionEn: string;
  canIDrive: CanIDriveAnswer;
  /** Trace des pondérations : audit, tests, transparence (§47-8). */
  debug: {
    causeScores: Array<{ causeKey: string; score: number; certainty: CertaintyLevel; components: Record<string, number> }>;
    effectsCount: number;
    caps: Array<{ level: CertaintyLevel; reasonFr: string }>;
  };
  dataQuality: SafetyAssessment['dataQuality'];
  /**
   * §33 — Origine des données du diagnostic, au sens de la provenance :
   * `simulated` dès qu'une donnée du moteur provient du simulateur, `measured`
   * lorsqu'au moins une mesure ou un code a été réellement lu sur le véhicule,
   * `documented` si tout provient de fiches ou de déclarations, `unknown` sans
   * aucune donnée exploitable. La SOURCE de session (`obd`, `simulator`,
   * `manual`, `none`) reste portée par le contexte et par la session OBD : les
   * deux notions ne doivent pas être confondues.
   */
  dataOrigin: DataOrigin;
}

export interface AnalyzeOptions {
  sessionId?: string;
  vehicleId?: string;
  userId?: string;
  mode?: DiagnosticContext['mode'];
}

/** Poids par nature d'apport : le mesuré pèse plus que le documenté (§33, §47-5). */
const WEIGHT_FACTOR: Record<CauseEffect['weight'], number> = {
  test: 1.05,
  measured: 1,
  documented: 0.85,
  history: 0.8,
  symptom: 0.7,
};

const SCORE_FLOOR = 0.1;
const POSSIBLE_THRESHOLD = 0.22;
const STRONG_THRESHOLD = 0.45;
const CONFIRMED_THRESHOLD = 0.5;

interface CauseAccumulator {
  causeKey: string;
  labelFr: string;
  labelEn: string;
  score: number;
  components: Record<string, number>;
  evidence: EvidenceRef[];
  reasoning: string[];
  supporting: string[];
  contradicting: string[];
  discriminatingTests: Set<string>;
  parts: Set<string>;
  hasTest: boolean;
  hasMeasured: boolean;
  documentedOnly: boolean;
}

function certaintyFor(accumulator: CauseAccumulator): CertaintyLevel {
  const { score, hasTest, hasMeasured, documentedOnly } = accumulator;
  if (score < POSSIBLE_THRESHOLD) return 'undeterminable';
  if (hasTest && score >= CONFIRMED_THRESHOLD) return 'confirmed';
  if (hasMeasured && score >= STRONG_THRESHOLD) return 'strongly_compatible';
  if (documentedOnly && score >= STRONG_THRESHOLD) return 'possible';
  return 'possible';
}

export class DiagnosticEngine {
  analyze(ctx: DiagnosticContext, options: AnalyzeOptions = {}): DiagnosticResult {
    const sessionId = options.sessionId ?? ctx.vehicle?.id ?? 'session';
    const rulesFired: string[] = [];
    const findings: Finding[] = [];
    const causes = new Map<string, CauseAccumulator>();
    const excluded = new Map<string, { fr: string; en: string }>();
    const safetyReasons: SafetyReason[] = [];
    const notes: DiagnosticNote[] = [];
    const missing: Array<{ fr: string; en: string; blocksConclusion: boolean }> = [];
    const testProposals = new Map<string, { priority: number; reasonFr: string; reasonEn: string; forCause?: string }>();
    const caps: Array<{ level: CertaintyLevel; reasonFr: string; reasonEn: string }> = [];
    let effectsCount = 0;

    /* ── 1. Exécution des règles ─────────────────────────────────────────── */
    for (const rule of ALL_RULES) {
      let effects: RuleEffect[] = [];
      try {
        if (!rule.applies(ctx)) continue;
        effects = rule.apply(ctx);
      } catch (error) {
        // Une règle qui échoue ne doit jamais produire de conclusion :
        // elle est tracée comme non disponible et ignorée.
        notes.push({
          textFr: `Une règle interne (${rule.id}) n’a pas pu être évaluée. Aucune conclusion n’en est tirée.`,
          textEn: `An internal rule (${rule.id}) could not be evaluated. No conclusion is drawn from it.`,
          level: 'normal',
        });
        void (error as Error).message;
        continue;
      }
      if (effects.length === 0) continue;
      rulesFired.push(rule.id);
      effectsCount += effects.length;

      for (const effect of effects) {
        switch (effect.kind) {
          case 'finding': {
            findings.push({
              id: `finding_${rule.id}_${findings.length + 1}`,
              sessionId,
              kind: effect.finding.kind,
              titleFr: effect.finding.titleFr,
              titleEn: effect.finding.titleEn,
              detailFr: effect.finding.detailFr,
              detailEn: effect.finding.detailEn,
              certainty: effect.finding.certainty,
              safety: effect.finding.safety,
              evidence: effect.finding.evidence,
              origin: effect.finding.origin,
            });
            break;
          }
          case 'cause': {
            const cause = effect.cause;
            const accumulator =
              causes.get(cause.causeKey) ??
              ({
                causeKey: cause.causeKey,
                labelFr: cause.labelFr,
                labelEn: cause.labelEn,
                score: 0,
                components: {},
                evidence: [],
                reasoning: [],
                supporting: [],
                contradicting: [],
                discriminatingTests: new Set<string>(),
                parts: new Set<string>(),
                hasTest: false,
                hasMeasured: false,
                documentedOnly: true,
              } satisfies CauseAccumulator);

            const factor = WEIGHT_FACTOR[cause.weight] ?? 1;
            const delta = Math.max(0, Math.min(1, cause.delta)) * factor;
            accumulator.score = Math.min(1, accumulator.score + delta);
            accumulator.components[`${cause.weight}:${rule.id}`] = Number((accumulator.components[`${cause.weight}:${rule.id}`] ?? 0) + delta).toFixed(3) as unknown as number;
            if (cause.evidence) accumulator.evidence.push(...cause.evidence);
            accumulator.reasoning.push(cause.reasonFr);
            accumulator.supporting.push(cause.reasonFr);
            if (cause.confirmedByTest) {
              accumulator.discriminatingTests.add(cause.confirmedByTest);
              if (ctx.testResults?.some((t) => t.testKey === cause.confirmedByTest && t.outcome !== 'not_testable')) {
                accumulator.hasTest = true;
              }
            }
            if (cause.parts) for (const part of cause.parts) accumulator.parts.add(part);
            if (cause.weight === 'measured' || cause.weight === 'test') accumulator.hasMeasured = true;
            if (cause.weight === 'measured' || cause.weight === 'test' || cause.weight === 'history') accumulator.documentedOnly = false;
            causes.set(cause.causeKey, accumulator);
            break;
          }
          case 'excludeCause': {
            excluded.set(effect.causeKey, { fr: effect.reasonFr, en: effect.reasonEn });
            break;
          }
          case 'safety': {
            safetyReasons.push({ fr: effect.reasonFr, en: effect.reasonEn, level: effect.level, evidence: effect.evidence });
            break;
          }
          case 'test': {
            const existing = testProposals.get(effect.testKey);
            if (!existing || effect.priority > existing.priority) {
              testProposals.set(effect.testKey, { priority: effect.priority, reasonFr: effect.reasonFr, reasonEn: effect.reasonEn, forCause: effect.forCause });
            }
            break;
          }
          case 'missing': {
            missing.push({ fr: effect.itemFr, en: effect.itemEn, blocksConclusion: effect.blocksConclusion });
            break;
          }
          case 'note': {
            notes.push({ textFr: effect.textFr, textEn: effect.textEn, level: effect.level ?? 'normal' });
            break;
          }
          case 'certaintyCap': {
            caps.push({ level: effect.level, reasonFr: effect.reasonFr, reasonEn: effect.reasonEn });
            break;
          }
        }
      }
    }

    /* ── 1bis. Résultats de tests déjà confirmés (§17, §18) ────────────────
     * Un test réalisé sur le véhicule est une observation directe : il pèse
     * plus lourd que toute interprétation. Il est donc intégré AVANT le tri des
     * hypothèses, et il peut écarter une cause (test négatif).
     */
    const derived = testResultEffects(ctx);
    if (derived.causes.length > 0 || derived.exclusions.length > 0) {
      rulesFired.push('derived.test_results');
      for (const cause of derived.causes) {
        const accumulator =
          causes.get(cause.causeKey) ??
          ({
            causeKey: cause.causeKey,
            labelFr: cause.labelFr,
            labelEn: cause.labelEn,
            score: 0,
            components: {},
            evidence: [],
            reasoning: [],
            supporting: [],
            contradicting: [],
            discriminatingTests: new Set<string>(),
            parts: new Set<string>(),
            hasTest: false,
            hasMeasured: true,
            documentedOnly: false,
          } satisfies CauseAccumulator);
        const factor = WEIGHT_FACTOR[cause.weight] ?? 1;
        const delta = Math.max(0, Math.min(1, cause.delta)) * factor;
        accumulator.score = Math.min(1, accumulator.score + delta);
        accumulator.components[`${cause.weight}:derived`] = Number(delta.toFixed(3));
        if (cause.evidence) accumulator.evidence.push(...cause.evidence);
        accumulator.reasoning.push(cause.reasonFr);
        accumulator.supporting.push(cause.reasonFr);
        accumulator.hasTest = true;
        accumulator.hasMeasured = true;
        accumulator.documentedOnly = false;
        if (cause.confirmedByTest) accumulator.discriminatingTests.add(cause.confirmedByTest);
        causes.set(cause.causeKey, accumulator);
      }
      for (const exclusion of derived.exclusions) {
        excluded.set(exclusion.causeKey, { fr: exclusion.reasonFr, en: exclusion.reasonEn });
      }
    }

    /* ── 2. Hypothèses (triées, filtrées, jamais présentées comme certitudes) ─ */
    const hypotheses: Hypothesis[] = [...causes.values()]
      .filter((cause) => !excluded.has(cause.causeKey))
      .filter((cause) => cause.score >= SCORE_FLOOR)
      .map((cause) => {
        const certainty = certaintyFor(cause);
        return {
          id: `hyp_${cause.causeKey}`,
          causeKey: cause.causeKey,
          labelFr: cause.labelFr,
          labelEn: cause.labelEn,
          score: Number(cause.score.toFixed(3)),
          certainty,
          reasoning: [...new Set(cause.reasoning)].slice(0, 6),
          supporting: [...new Set(cause.supporting)].slice(0, 6),
          contradicting: cause.contradicting.slice(0, 4),
          discriminatingTests: [...cause.discriminatingTests],
          parts: [...cause.parts],
        } satisfies Hypothesis;
      })
      .sort((a, b) => b.score - a.score);

    for (const [causeKey, reason] of excluded) {
      const accumulator = causes.get(causeKey);
      notes.push({
        textFr: `Cause écartée — ${accumulator?.labelFr ?? causeKey} : ${reason.fr}`,
        textEn: `Cause excluded — ${accumulator?.labelEn ?? causeKey}: ${reason.en}`,
        level: 'normal',
      });
    }

    /* ── 3. Sécurité (§11, §12) ──────────────────────────────────────────── */
    const contextualCtx: DiagnosticContext = { ...ctx };
    const safetyAssessment = assessSafety(contextualCtx, safetyReasons);

    /* ── 4. Tests proposés ───────────────────────────────────────────────── */
    // Les tests des règles sont prioritaires ; on complète avec les tests
    // discriminants des hypothèses, puis avec les tests de repli documentés.
    for (const hypothesis of hypotheses.slice(0, 4)) {
      for (const testKey of hypothesis.discriminatingTests) {
        if (testProposals.has(testKey)) continue;
        testProposals.set(testKey, {
          priority: Math.round(50 - hypothesis.score * 20),
          reasonFr: `Départage l’hypothèse : ${hypothesis.labelFr}.`,
          reasonEn: `Discriminates the hypothesis: ${hypothesis.labelEn}.`,
          forCause: hypothesis.causeKey,
        });
      }
    }

    // Codes défaut dont les tests associés sont documentés.
    for (const dtc of ctx.dtcs) {
      const knowledge = findDtcKnowledge(dtc.code);
      if (!knowledge) continue;
      for (const testKey of knowledge.relatedTests) {
        if (testProposals.has(testKey)) continue;
        testProposals.set(testKey, {
          priority: knowledge.severity === 'critical' ? 95 : knowledge.severity === 'important' ? 80 : 60,
          reasonFr: `Recommandé par la base XAMOTO pour le code ${dtc.code}.`,
          reasonEn: `Recommended by the XAMOTO knowledge base for code ${dtc.code}.`,
          forCause: `dtc_${dtc.code}`,
        });
      }
    }

    const knownTestKeys = new Set(testProposals.keys());
    const hasSymptomOrDtc = ctx.dtcs.length > 0 || ctx.symptoms.some((s) => s.present);
    if (hasSymptomOrDtc && knownTestKeys.size === 0) {
      for (const fallback of FALLBACK_TESTS) {
        testProposals.set(fallback, {
          priority: 30,
          reasonFr: 'Premier contrôle non invasif lorsque la cause n’est pas encore orientée.',
          reasonEn: 'First non-invasive check when the cause is not yet oriented.',
          forCause: undefined,
        });
      }
    }

    const tests: DiagnosticTest[] = [...testProposals.entries()]
      .filter(([testKey]) => TEST_BY_ID.has(testKey))
      .sort((a, b) => b[1].priority - a[1].priority)
      .map(([testKey, proposal]) => ({
        id: `dtest_${sessionId}_${testKey}`,
        sessionId,
        testKey,
        proposedAt: new Date().toISOString(),
        status: ctx.testResults?.some((t) => t.testKey === testKey) ? 'done' : 'proposed',
        result: null,
        priority: proposal.priority,
        reasonFr: proposal.reasonFr,
        reasonEn: proposal.reasonEn,
      }));

    /* ── 5. Données manquantes : jamais masquées, jamais comblées (§16) ───── */
    const dedupedMissing = dedupeMissing(missing);
    if (ctx.readings.length === 0) {
      dedupedMissing.push({
        fr: 'Aucune mesure OBD disponible pour ce véhicule.',
        en: 'No OBD measurement available for this vehicle.',
        blocksConclusion: true,
      });
    }
    for (const dtc of ctx.dtcs) {
      if (findDtcKnowledge(dtc.code)) continue;
      dedupedMissing.push({
        fr: `Le code ${dtc.code} n’est pas documenté dans la base XAMOTO : sa signification exacte n’est pas fournie.`,
        en: `Code ${dtc.code} is not documented in the XAMOTO database: its exact meaning is not provided.`,
        blocksConclusion: true,
      });
    }
    const unsupported = ctx.readings.filter((r) => !r.supported);
    if (unsupported.length > 0) {
      dedupedMissing.push({
        fr: `${unsupported.length} mesure(s) ne sont pas supportées par ce véhicule : ${unsupported.map((r) => r.label).slice(0, 5).join(', ')}.`,
        en: `${unsupported.length} measurement(s) are not supported by this vehicle: ${unsupported.map((r) => r.label).slice(0, 5).join(', ')}.`,
        blocksConclusion: false,
      });
    }
    const coldEngine = ctx.readings.find((r) => r.key === 'coolant_temp');
    if (coldEngine && coldEngine.supported && coldEngine.value !== null && coldEngine.value < 60) {
      dedupedMissing.push({
        fr: 'Le moteur n’était pas à température : certaines anomalies (richesse, catalyseur, ratés) ne se manifestent qu’à chaud.',
        en: 'The engine was not at operating temperature: some anomalies (fuel trim, catalyst, misfires) only show when warm.',
        blocksConclusion: false,
      });
    }

    /* ── 6. Certitude globale : jamais supérieure à la plus faible évidence ── */
    const blockingMissing = dedupedMissing.filter((m) => m.blocksConclusion);
    const topHypothesis = hypotheses[0];
    const dataCertainty: CertaintyLevel =
      ctx.readings.length === 0 && ctx.dtcs.length === 0
        ? 'unavailable'
        : ctx.readings.filter((r) => r.supported && r.value !== null).length === 0
          ? 'possible'
          : ctx.readings.filter((r) => r.supported && r.value !== null).length >= 5
            ? 'strongly_compatible'
            : 'possible';

    const candidates: CertaintyLevel[] = [topHypothesis ? topHypothesis.certainty : 'undeterminable', dataCertainty, ...caps.map((c) => c.level)];
    // Une donnée bloquante absente interdit toute conclusion forte (§16).
    if (blockingMissing.length > 0) candidates.push('possible');
    // Deux hypothèses proches ne permettent pas de trancher.
    if (hypotheses.length >= 2 && hypotheses[1] && hypotheses[0] && hypotheses[1].score >= hypotheses[0].score * 0.8) candidates.push('possible');
    let certainty = weakestCertainty(candidates);
    if (dataCertainty === 'unavailable') certainty = 'unavailable';

    /* ── 7. Conclusion rédigée, prudente et traçable ──────────────────────── */
    const conclusionFr = composeConclusion('fr', { certainty, safety: safetyAssessment, hypotheses, missingData: dedupedMissing, tests });
    const conclusionEn = composeConclusion('en', { certainty, safety: safetyAssessment, hypotheses, missingData: dedupedMissing, tests });

    /* ── 8. Réponse « Puis-je rouler ? » (§12) ───────────────────────────── */
    const proposedTests = tests.map((t) => t.testKey);
    const driveAnswer = canIDrive(
      { ...contextualCtx, proposedTests } as DiagnosticContext & { proposedTests: string[] },
      safetyAssessment,
    );

    /* ── 9. Notes finales ────────────────────────────────────────────────── */
    if (ctx.source === 'simulator') {
      notes.push({
        textFr: `${MESSAGES.simulationFr} — ${MESSAGES.simulationNoticeFr}`,
        textEn: `${MESSAGES.simulationEn} — ${MESSAGES.simulationNoticeEn}`,
        level: 'normal',
      });
    }
    if (ctx.spec === null || ctx.spec === undefined) {
      notes.push({
        textFr: 'Aucune fiche technique XAMOTO pour ce modèle : les valeurs constructeur ne sont pas fournies, seules des plages usuelles documentées sont utilisées.',
        textEn: 'No XAMOTO technical sheet for this model: no manufacturer values are provided, only documented usual ranges are used.',
        level: 'normal',
      });
    }

    /*
     * Origine (§33) : le niveau le plus prudent l'emporte. Une seule donnée
     * simulée suffit à marquer tout le diagnostic « simulated » ; sans aucune
     * donnée exploitable, l'origine est « unknown » et non « measured ».
     */
    const origins: DataOrigin[] = [
      ...ctx.readings.map((r) => r.origin),
      ...ctx.dtcs.map((d) => d.origin),
    ];
    const hasUsableData = ctx.readings.some((r) => r.supported && r.value !== null) || ctx.dtcs.length > 0;
    const dataOrigin: DataOrigin = origins.includes('simulated')
      ? 'simulated'
      : !hasUsableData
        ? 'unknown'
        : origins.includes('measured')
          ? 'measured'
          : origins.includes('documented')
            ? 'documented'
            : 'estimated';

    return {
      engineVersion: ENGINE_VERSION,
      rulesFired: [...new Set(rulesFired)],
      findings: dedupeFindings(findings),
      hypotheses,
      tests,
      notes: dedupeNotes(notes),
      missingData: dedupedMissing,
      certainty,
      safety: safetyAssessment.level,
      safetyAssessment,
      conclusionFr,
      conclusionEn,
      canIDrive: driveAnswer,
      debug: {
        causeScores: [...causes.values()].map((cause) => ({
          causeKey: cause.causeKey,
          score: Number(cause.score.toFixed(3)),
          certainty: certaintyFor(cause),
          components: cause.components,
        })),
        effectsCount,
        caps: caps.map((c) => ({ level: c.level, reasonFr: c.reasonFr })),
      },
      dataQuality: safetyAssessment.dataQuality,
      dataOrigin,
    };
  }
}

/* ────────────────────────────── Rédaction ─────────────────────────────── */

function composeConclusion(
  locale: 'fr' | 'en',
  input: {
    certainty: CertaintyLevel;
    safety: SafetyAssessment;
    hypotheses: Hypothesis[];
    missingData: Array<{ fr: string; en: string; blocksConclusion: boolean }>;
    tests: DiagnosticTest[];
  },
): string {
  const fr = locale === 'fr';
  const parts: string[] = [];
  const top = input.hypotheses[0];
  const blocking = input.missingData.filter((m) => m.blocksConclusion);

  if (input.certainty === 'unavailable') {
    parts.push(fr ? MESSAGES.insufficientDataFr : MESSAGES.insufficientDataEn);
    parts.push(
      fr
        ? 'Aucune donnée exploitable n’a été reçue : XAMOTO ne propose ni cause ni conclusion.'
        : 'No usable data was received: XAMOTO proposes neither cause nor conclusion.',
    );
  } else if (!top) {
    parts.push(
      fr
        ? 'Aucune cause n’est suffisamment soutenue par les données disponibles. XAMOTO ne conclura pas à votre place.'
        : 'No cause is sufficiently supported by the available data. XAMOTO will not conclude on your behalf.',
    );
  } else {
    const label = fr ? top.labelFr : top.labelEn;
    const certaintyText = fr ? certaintyPhraseFr(top.certainty) : certaintyPhraseEn(top.certainty);
    parts.push(fr ? `${label} — ${certaintyText}.` : `${label} — ${certaintyText}.`);
    if (input.hypotheses.length > 1) {
      const others = input.hypotheses.slice(1, 3).map((h) => (fr ? h.labelFr : h.labelEn));
      parts.push(`${fr ? MESSAGES.severalCausesFr : MESSAGES.severalCausesEn} ${fr ? `Notamment : ${others.join(', ')}.` : `Including: ${others.join(', ')}.`}`);
    }
    if (top.certainty !== 'confirmed') {
      parts.push(fr ? MESSAGES.testRequiredFr : MESSAGES.testRequiredEn);
    }
  }

  const first = input.tests[0];
  if (first) {
    const definition = TEST_BY_ID.get(first.testKey);
    const title = definition ? (fr ? definition.titleFr : definition.titleEn) : first.testKey;
    parts.push(fr ? `Premier test recommandé : ${title}.` : `First recommended test: ${title}.`);
  }

  if (input.safety.level === 'critical') {
    parts.push(
      fr
        ? 'Niveau de sécurité CRITIQUE : n’utilisez pas le véhicule avant un contrôle.'
        : 'CRITICAL safety level: do not use the vehicle before a check.',
    );
  }

  if (blocking.length > 0) {
    parts.push(
      fr
        ? `Données manquantes empêchant de conclure : ${blocking.map((m) => m.fr).slice(0, 2).join(' ')}`
        : `Missing data preventing conclusion: ${blocking.map((m) => m.en).slice(0, 2).join(' ')}`,
    );
  }

  parts.push(
    fr
      ? 'XAMOTO fournit une aide au diagnostic : il ne remplace pas un professionnel et n’engage aucune garantie sur l’état du véhicule.'
      : 'XAMOTO provides diagnostic assistance: it does not replace a professional and gives no guarantee on the vehicle condition.',
  );

  return parts.join(' ');
}

function certaintyPhraseFr(level: CertaintyLevel): string {
  switch (level) {
    case 'confirmed':
      return 'cause confirmée par un test réalisé sur le véhicule';
    case 'strongly_compatible':
      return 'cause fortement compatible avec les mesures, à confirmer';
    case 'possible':
      return 'cause possible, non confirmée';
    case 'undeterminable':
      return 'cause indéterminable en l’état des données';
    default:
      return 'donnée non disponible';
  }
}

function certaintyPhraseEn(level: CertaintyLevel): string {
  switch (level) {
    case 'confirmed':
      return 'cause confirmed by a test performed on the vehicle';
    case 'strongly_compatible':
      return 'cause strongly compatible with measurements, to be confirmed';
    case 'possible':
      return 'possible, unconfirmed cause';
    case 'undeterminable':
      return 'cause undeterminable with current data';
    default:
      return 'data not available';
  }
}

/* ───────────────────────────── Utilitaires ────────────────────────────── */

function dedupeMissing(items: Array<{ fr: string; en: string; blocksConclusion: boolean }>): Array<{ fr: string; en: string; blocksConclusion: boolean }> {
  const seen = new Set<string>();
  const out: Array<{ fr: string; en: string; blocksConclusion: boolean }> = [];
  for (const item of items) {
    if (seen.has(item.fr)) continue;
    seen.add(item.fr);
    out.push(item);
  }
  return out;
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const finding of findings) {
    const key = `${finding.kind}:${finding.titleFr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(finding);
  }
  return out.sort((a, b) => CERTAINTY_RANK[b.certainty] - CERTAINTY_RANK[a.certainty]);
}

function dedupeNotes(notes: DiagnosticNote[]): DiagnosticNote[] {
  const seen = new Set<string>();
  const out: DiagnosticNote[] = [];
  for (const note of notes) {
    if (seen.has(note.textFr)) continue;
    seen.add(note.textFr);
    out.push(note);
  }
  return out;
}

/**
 * Effets liés aux résultats de tests déjà confirmés : utilisés par les règles
 * de tests guidés et exportés pour être testables isolément (§51).
 */
export function testResultEffects(ctx: DiagnosticContext): { causes: CauseEffect[]; exclusions: Array<{ causeKey: string; reasonFr: string; reasonEn: string }> } {
  const causes: CauseEffect[] = [];
  const exclusions: Array<{ causeKey: string; reasonFr: string; reasonEn: string }> = [];
  for (const result of ctx.testResults ?? []) {
    const definition = TEST_BY_ID.get(result.testKey);
    if (!definition) continue;
    const interpretation = definition.interpretation.find((i) => i.outcome === result.outcome);
    if (!interpretation) continue;
    for (const cause of interpretation.confirms ?? []) {
      causes.push({
        causeKey: cause,
        labelFr: cause.replace(/_/g, ' '),
        labelEn: cause.replace(/_/g, ' '),
        delta: 0.6,
        weight: 'test',
        reasonFr: `${definition.titleFr} : ${interpretation.meaningFr}`,
        reasonEn: `${definition.titleEn}: ${interpretation.meaningEn}`,
        confirmedByTest: result.testKey,
      });
    }
    for (const cause of interpretation.excludes ?? []) {
      exclusions.push({
        causeKey: cause,
        reasonFr: `${definition.titleFr} : ${interpretation.meaningFr}`,
        reasonEn: `${definition.titleEn}: ${interpretation.meaningEn}`,
      });
    }
  }
  return { causes, exclusions };
}

export { buildHypotheses, composeConclusion as composeConclusionText } from './hypotheses.js';
export { assessSafety } from '../safety/index.js';
export { canIDrive } from '../safety/canIDrive.js';
export type { CanIDriveAnswer } from '../safety/canIDrive.js';
export type { SafetyAssessment } from '../safety/index.js';
export { MESSAGES };
export type { SymptomInput, PidKey, DataOrigin };

/** Instance partagée : le moteur est sans état, elle évite les allocations. */
export const diagnosticEngine = new DiagnosticEngine();
