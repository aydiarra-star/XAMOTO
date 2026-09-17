/**
 * XAMOTO — Vérification des réponses IA (§16, §35, §51).
 *
 * « L'IA ne doit pas inventer un diagnostic. »
 *
 * Toute réponse produite par un LLM passe par ce validateur AVANT d'être
 * affichée. En cas d'écart, la réponse est rejetée et XAMOTO affiche la
 * réponse déterministe du moteur de diagnostic.
 *
 * Contrôles effectués :
 *  1. codes défaut inconnus de la base XAMOTO,
 *  2. valeurs numériques avec unité qui ne figurent ni dans le contexte ni dans
 *     un document cité,
 *  3. garanties de sécurité ou affirmations de certitude interdites,
 *  4. absence de mention des données manquantes quand elles sont bloquantes,
 *  5. absence de sources alors que la réponse énonce un fait technique,
 *  6. valeurs constructeur inventées (intervalles, couples, quantités).
 */
import type { KnowledgeDocument } from '@xamoto/shared';
import { findDtcKnowledge } from '@xamoto/diagnostic';
import type { ContextBuildResult } from '../assistant/context.js';

export interface ValidationViolation {
  type:
    | 'unknown_dtc'
    | 'invented_value'
    | 'unsupported_guarantee'
    | 'missing_disclosure'
    | 'unsourced_claim'
    | 'invented_specification';
  severity: 'error' | 'warning';
  detailFr: string;
  detailEn: string;
  excerpt?: string;
}

export interface ValidationResult {
  checked: boolean;
  passed: boolean;
  violations: ValidationViolation[];
}

const GUARANTEE_PATTERNS: Array<{ pattern: RegExp; fr: string; en: string }> = [
  { pattern: /\b(vous pouvez rouler (sans|sans aucun) (risque|danger|probl[eè]me))\b/i, fr: 'Garantie de sécurité donnée sans données suffisantes.', en: 'Safety guarantee given without sufficient data.' },
  { pattern: /\b(aucun (risque|danger) (du tout)?)\b/i, fr: 'Affirmation d’absence totale de risque.', en: 'Claim of total absence of risk.' },
  { pattern: /\b(100 ?%|cent pour cent) (s[uû]r|certain|garanti)/i, fr: 'Affirmation de certitude absolue.', en: 'Claim of absolute certainty.' },
  { pattern: /\b(c['’]est (s[uû]r et certain|certain)|j['’]en suis certain|sans aucun doute possible)\b/i, fr: 'Certitude affirmée sans réserve.', en: 'Certainty asserted without reservation.' },
  { pattern: /\b(garantis?(sont)?|garantie) (que )?(le probl[eè]me|la panne|la r[eé]paration)/i, fr: 'Garantie sur la panne ou la réparation.', en: 'Guarantee about the fault or repair.' },
  { pattern: /\b(il est (totalement )?inutile de (consulter|v[eé]rifier))\b/i, fr: 'Incitation à ne pas vérifier.', en: 'Encouragement not to check.' },
];

const SPECIFICATION_PATTERNS: Array<{ pattern: RegExp; fr: string; en: string }> = [
  { pattern: /(intervalle|tous les|every)\s+\d[\d\s]{2,}(km|kilom[eè]tres|miles)/i, fr: 'Intervalle d’entretien énoncé comme valeur ferme (les sources XAMOTO donnent des plages).', en: 'Service interval stated as a firm value (XAMOTO sources provide ranges).' },
  { pattern: /\b(couple de serrage|torque)[^\n]{0,30}\d+\s*(nm|n\.m|m\.?kg)\b/i, fr: 'Couple de serrage chiffré : valeur constructeur non disponible dans XAMOTO.', en: 'Numeric tightening torque: manufacturer value not available in XAMOTO.' },
  { pattern: /\b(pr[eé]conis[eé]|recommand[eé] par le constructeur)\s*:?\s*(de l['’])?(huile|oil)[^\n]{0,40}\b(5w|10w|15w|0w)/i, fr: 'Spécification d’huile constructeur inventée.', en: 'Invented manufacturer oil specification.' },
];

const UNIT_VALUE = /(-?\d+(?:[.,]\d+)?)\s*(°c|°f|v\b|volts?|km\/h|km\b|tr\/min|rpm|%|bar|kpa|psi|g\/s|l\/100)/gi;

function normalizeNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

/**
 * Vérifie la réponse. `allowedDocuments` sert à autoriser les valeurs qui
 * figurent explicitement dans les sources (elles sont alors légitimes).
 */
export function validateAnswer(
  answer: string,
  contextResult: ContextBuildResult,
  citedDocuments: KnowledgeDocument[] = [],
): ValidationResult {
  const violations: ValidationViolation[] = [];
  const { pack } = contextResult;

  /* 1. Codes défaut mentionnés -------------------------------------------------- */
  const mentioned = [...new Set((answer.toUpperCase().match(/\b[PCBU][0-3][0-9A-F]{3}\b/g) ?? []).map((c) => c))];
  const knownInContext = new Set(pack.dtcs.map((d) => d.code.toUpperCase()));
  const citedText = citedDocuments.map((d) => `${d.titleFr} ${d.titleEn} ${d.contentFr} ${d.contentEn}`).join(' ').toUpperCase();
  for (const code of mentioned) {
    if (knownInContext.has(code)) continue;
    if (findDtcKnowledge(code)) continue;
    if (citedText.includes(code)) continue;
    violations.push({
      type: 'unknown_dtc',
      severity: 'error',
      detailFr: `Le code ${code} est mentionné alors qu’il ne figure ni dans les données du véhicule, ni dans la base XAMOTO, ni dans les documents cités.`,
      detailEn: `Code ${code} is mentioned although it appears neither in the vehicle data, nor in the XAMOTO knowledge base, nor in the cited documents.`,
      excerpt: code,
    });
  }

  /* 2. Valeurs numériques avec unité ------------------------------------------- */
  const contextValues = new Set<number>();
  for (const reading of pack.readings) {
    if (typeof reading.value === 'number') {
      contextValues.add(reading.value);
      contextValues.add(Math.round(reading.value));
    }
  }
  for (const hypothesis of pack.hypotheses) {
    const numbers = hypothesis.reasoning.join(' ').match(/-?\d+(?:[.,]\d+)?/g) ?? [];
    for (const n of numbers) contextValues.add(normalizeNumber(n));
  }
  const citedNumbers = new Set<number>();
  for (const doc of citedDocuments) {
    const numbers = `${doc.contentFr} ${doc.contentEn}`.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
    for (const n of numbers) citedNumbers.add(normalizeNumber(n));
  }
  // Valeurs générales de référence largement documentées (bornes usuelles).
  const commonThresholds = new Set([12, 12.2, 12.4, 12.6, 13, 13.5, 14, 14.5, 14.8, 15, 60, 70, 75, 80, 90, 95, 100, 105, 110, 112, 120, 0.1, 0.9, 25, 10, 20, 50, 1500, 45]);

  let match: RegExpExecArray | null;
  const regex = new RegExp(UNIT_VALUE);
  while ((match = regex.exec(answer)) !== null) {
    const value = normalizeNumber(match[1] as string);
    if (contextValues.has(value) || citedNumbers.has(value) || commonThresholds.has(value)) continue;
    violations.push({
      type: 'invented_value',
      severity: 'error',
      detailFr: `La valeur « ${match[0]} » n’apparaît ni dans les données du véhicule ni dans les documents cités.`,
      detailEn: `The value "${match[0]}" appears neither in the vehicle data nor in the cited documents.`,
      excerpt: match[0],
    });
  }

  /* 3. Garanties interdites ----------------------------------------------------- */
  for (const rule of GUARANTEE_PATTERNS) {
    const found = rule.pattern.exec(answer);
    if (found) {
      violations.push({ type: 'unsupported_guarantee', severity: 'error', detailFr: rule.fr, detailEn: rule.en, excerpt: found[0] });
    }
  }

  /* 4. Spécifications inventées ------------------------------------------------- */
  for (const rule of SPECIFICATION_PATTERNS) {
    const found = rule.pattern.exec(answer);
    if (found && citedDocuments.length === 0 && !citedText.includes(found[0].toUpperCase().slice(0, 20))) {
      violations.push({ type: 'invented_specification', severity: 'error', detailFr: rule.fr, detailEn: rule.en, excerpt: found[0] });
    }
  }

  /* 5. Divulgation des données manquantes -------------------------------------- */
  const blockingMissing = pack.session?.missingData ?? [];
  const hasHedging = /(ne dispose pas|ne poss[eè]de pas|donn[eé]es insuffisantes|insufficient|do not have|pas disponible)/i.test(answer);
  if (blockingMissing.length > 0 && !hasHedging) {
    violations.push({
      type: 'missing_disclosure',
      severity: 'warning',
      detailFr: 'Le diagnostic indique des données manquantes bloquantes, mais la réponse ne le mentionne pas.',
      detailEn: 'The diagnosis reports blocking missing data, but the answer does not mention it.',
    });
  }

  /* 6. Affirmation technique sans source --------------------------------------- */
  const statesFacts = /\b(il faut remplacer|vous devez remplacer|la cause est|le probl[eè]me vient de|la panne est)\b/i.test(answer);
  if (statesFacts && citedDocuments.length === 0) {
    violations.push({
      type: 'unsourced_claim',
      severity: 'warning',
      detailFr: 'La réponse affirme une cause ou un remplacement sans document source cité.',
      detailEn: 'The answer asserts a cause or a replacement without a cited source document.',
    });
  }

  const errors = violations.filter((v) => v.severity === 'error');
  return { checked: true, passed: errors.length === 0, violations };
}

/** Message affiché à l'utilisateur lorsque la réponse LLM est rejetée. */
export const VALIDATION_FALLBACK_FR =
  'La réponse générée n’a pas passé les contrôles de XAMOTO (donnée non vérifiable détectée). XAMOTO affiche donc l’analyse issue du moteur de diagnostic, qui ne contient que des informations vérifiables.';
export const VALIDATION_FALLBACK_EN =
  'The generated answer did not pass XAMOTO checks (unverifiable data detected). XAMOTO therefore displays the analysis from the diagnostic engine, which contains only verifiable information.';
