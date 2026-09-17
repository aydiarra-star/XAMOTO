/**
 * XAMOTO — Orchestrateur de l'assistant.
 *
 * Enchaînement strict (§35) : contexte → recherche documentaire → composition
 * → (LLM optionnel) → vérification → réponse.
 *
 * Le LLM ne peut jamais dégrader la fiabilité : s'il échoue ou si sa sortie
 * ne passe pas la vérification, XAMOTO affiche la réponse déterministe et
 * indique pourquoi.
 */
import type { AiCitation } from '@xamoto/shared';
import { systemsFromCodes } from '@xamoto/diagnostic';
import { RAG_DOCUMENT_BY_ID } from '../rag/corpus.js';
import { retrieve, type RetrievedDocument } from '../rag/index.js';
import { composeDeterministicAnswer, detectIntent, type AssistantAnswer } from './qa.js';
import type { ContextBuildResult } from './context.js';
import { serializeContext } from './context.js';
import type { LlmProvider } from './llm.js';
import { UnavailableLlmProvider } from './llm.js';
import { validateAnswer, VALIDATION_FALLBACK_FR, VALIDATION_FALLBACK_EN, type ValidationResult } from '../validation/index.js';

export interface AskInput {
  question: string;
  contextResult: ContextBuildResult;
  locale?: 'fr' | 'en';
  llm?: LlmProvider;
}

export interface AskResult {
  answer: AssistantAnswer;
  validation: ValidationResult | null;
  /** Le LLM a-t-il été utilisé, et a-t-il été retenu ? */
  llm: { available: boolean; used: boolean; rejected: boolean; error?: string };
}

export async function askXamoto(input: AskInput): Promise<AskResult> {
  const locale = input.locale ?? 'fr';
  const { contextResult } = input;
  const llm = input.llm ?? new UnavailableLlmProvider();

  const intent = detectIntent(input.question);

  // 1. Recherche documentaire : toujours effectuée, même en mode déterministe
  //    (elle alimente les citations et la section « sources »).
  const retrieved: RetrievedDocument[] = retrieve({
    text: input.question,
    dtcCodes: contextResult.pack.dtcs.map((d) => d.code),
    systems: systemsFromCodes(contextResult.pack.dtcs.map((d) => d.code)),
    fuelTypes: contextResult.pack.vehicle?.fuelType ? [contextResult.pack.vehicle.fuelType] : undefined,
    brands: contextResult.pack.vehicle?.brand ? [contextResult.pack.vehicle.brand] : undefined,
    topK: 4,
  });

  // 2. Réponse déterministe : toujours calculée. Elle sert de référence et de
  //    repli garanti.
  const deterministic = composeDeterministicAnswer({
    question: input.question,
    intent,
    contextResult,
    retrieved,
  });

  // 3. LLM optionnel.
  if (!llm.available()) {
    return { answer: deterministic, validation: null, llm: { available: false, used: false, rejected: false } };
  }

  // Les salutations et demandes hors périmètre sont traitées directement :
  // aucun besoin de LLM, et donc aucun risque.
  if (intent === 'greeting' || intent === 'off_topic') {
    return {
      answer: deterministic,
      validation: null,
      llm: { available: true, used: false, rejected: false, error: 'Intention traitée par le moteur déterministe.' },
    };
  }

  const citedDocuments = retrieved.map((r) => r.document);
  try {
    const raw = await llm.complete({
      question: input.question,
      contextText: serializeContext(contextResult, locale),
      documents: retrieved.map((r) => ({
        title: r.document.titleFr,
        publisher: r.source?.publisher ?? 'XAMOTO',
        content: locale === 'fr' ? r.document.contentFr : r.document.contentEn,
      })),
      locale,
    });

    const validation = validateAnswer(raw, contextResult, citedDocuments);

    if (!validation.passed || raw.trim().length === 0) {
      // Rejet : on revient à la réponse du moteur, en toute transparence.
      const citations: AiCitation[] = citationsOf(retrieved);
      return {
        answer: {
          ...deterministic,
          contentFr: `${deterministic.contentFr}\n\n— Note de vérification : ${VALIDATION_FALLBACK_FR}`,
          contentEn: `${deterministic.contentEn}\n\n— Verification note: ${VALIDATION_FALLBACK_EN}`,
          citations: citations.length > 0 ? citations : deterministic.citations,
        },
        validation,
        llm: { available: true, used: false, rejected: true },
      };
    }

    const citations = citationsOf(retrieved);
    return {
      answer: {
        ...deterministic,
        contentFr: raw,
        contentEn: raw,
        engine: 'llm',
        citations: citations.length > 0 ? citations : deterministic.citations,
      },
      validation,
      llm: { available: true, used: true, rejected: false },
    };
  } catch (error) {
    return {
      answer: deterministic,
      validation: null,
      llm: { available: true, used: false, rejected: false, error: (error as Error).message },
    };
  }
}

function citationsOf(retrieved: RetrievedDocument[]): AiCitation[] {
  return retrieved
    .filter((r) => r.source !== null)
    .map((r) => ({
      documentId: r.document.id,
      sourceId: r.document.sourceId,
      title: r.document.titleFr,
      publisher: r.source?.publisher ?? 'XAMOTO',
      reliability: r.source?.reliability ?? 'xamoto',
      score: r.score,
      snippet: r.snippet,
    }));
}

export { RAG_DOCUMENT_BY_ID };
