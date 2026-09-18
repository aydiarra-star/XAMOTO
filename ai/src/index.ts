/**
 * XAMOTO — Couche IA (§13 → §16, §35).
 *
 * Architecture imposée :
 *
 *   Question utilisateur
 *     → identification du contexte (véhicule, données, historique)
 *     → recherche documentaire (RAG)
 *     → moteur de règles + moteur de sécurité (déjà exécutés)
 *     → analyse
 *     → LLM (optionnel)
 *     → réponse structurée
 *     → VÉRIFICATION
 *     → utilisateur
 *
 * Sans clé LLM configurée, l'étape LLM est remplacée par le composeur
 * déterministe : le produit reste complet et vérifiable.
 */
export { retrieve, allSources, documentById, RAG_DOCUMENTS, tokenize } from './rag/index.js';
export type { RetrievalQuery, RetrievedDocument } from './rag/index.js';
export { buildAiContext, serializeContext } from './assistant/context.js';
export type { BuildContextInput, ContextBuildResult } from './assistant/context.js';
export { detectIntent, composeDeterministicAnswer, ASSISTANT_INTENTS } from './assistant/qa.js';
export type { AssistantAnswer, AssistantIntent, ComposeInput } from './assistant/qa.js';
export { createLlmProvider, buildSystemPrompt, buildUserPrompt, OpenAiCompatibleProvider, AnthropicProvider, UnavailableLlmProvider } from './assistant/llm.js';
export type { LlmProvider, LlmConfig, LlmRequest } from './assistant/llm.js';
export { validateAnswer, VALIDATION_FALLBACK_FR, VALIDATION_FALLBACK_EN } from './validation/index.js';
export type { ValidationResult, ValidationViolation } from './validation/index.js';
export { askXamoto } from './assistant/index.js';
export type { AskInput, AskResult } from './assistant/index.js';
