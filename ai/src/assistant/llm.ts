/**
 * XAMOTO — Fournisseur LLM optionnel (§34, §35).
 *
 * Le LLM est un COMPOSANT, pas le système. Il n'est jamais appelé seul :
 * il reçoit un contexte vérifié et des documents, et sa sortie est validée.
 *
 * Si aucun fournisseur n'est configuré, XAMOTO fonctionne en mode
 * déterministe : c'est le mode par défaut, et il produit des réponses
 * complètes sans aucune clé d'API.
 */
import { MESSAGES, XAMOTO_PRINCIPLES } from '@xamoto/shared';

export interface LlmRequest {
  question: string;
  contextText: string;
  documents: Array<{ title: string; publisher: string; content: string }>;
  locale: 'fr' | 'en';
}

export interface LlmProvider {
  readonly id: string;
  available(): boolean;
  complete(request: LlmRequest): Promise<string>;
}

export class UnavailableLlmProvider implements LlmProvider {
  readonly id = 'none';
  available(): boolean {
    return false;
  }
  async complete(): Promise<string> {
    throw new Error('Aucun fournisseur LLM configuré : XAMOTO utilise le moteur déterministe.');
  }
}

interface OpenAiOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id = 'openai-compatible';
  constructor(private options: OpenAiOptions) {}

  available(): boolean {
    return Boolean(this.options.apiKey);
  }

  async complete(request: LlmRequest): Promise<string> {
    const url = `${this.options.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model,
        temperature: 0,
        max_tokens: 900,
        messages: [
          { role: 'system', content: buildSystemPrompt(request.locale) },
          { role: 'user', content: buildUserPrompt(request) },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`LLM indisponible (${response.status})`);
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }
}

interface AnthropicOptions {
  apiKey: string;
  model: string;
}

export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic';
  constructor(private options: AnthropicOptions) {}

  available(): boolean {
    return Boolean(this.options.apiKey);
  }

  async complete(request: LlmRequest): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.options.model,
        max_tokens: 900,
        temperature: 0,
        system: buildSystemPrompt(request.locale),
        messages: [{ role: 'user', content: buildUserPrompt(request) }],
      }),
    });
    if (!response.ok) {
      throw new Error(`LLM indisponible (${response.status})`);
    }
    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    return data.content?.map((c) => c.text ?? '').join('\n') ?? '';
  }
}

/**
 * Prompt système : il reprend les principes absolus du produit (§47) et
 * interdit explicitement l'invention de données.
 */
export function buildSystemPrompt(locale: 'fr' | 'en'): string {
  const principles = XAMOTO_PRINCIPLES.map((p) => `${p.id}. ${locale === 'fr' ? p.fr : p.en}`).join('\n');
  if (locale === 'fr') {
    return `Tu es l'assistant XAMOTO, spécialisé dans la compréhension et le diagnostic automobile.

PRINCIPES ABSOLUS (non négociables) :
${principles}

RÈGLES DE RÉDACTION :
- Réponds UNIQUEMENT à partir du CONTEXTE VÉHICULE et des DOCUMENTS fournis. N'ajoute aucune donnée technique de ta propre initiative.
- Si une information manque, écris exactement : « ${MESSAGES.insufficientDataFr} »
- Si plusieurs causes restent possibles, écris : « ${MESSAGES.severalCausesFr} »
- N'invente jamais de valeur constructeur (couple de serrage, intervalle, spécification d'huile, référence de pièce).
- Ne promets jamais qu'un véhicule peut rouler sans risque. Ne prétends jamais être certain.
- Distingue toujours : fait mesuré / hypothèse possible / donnée absente.
- Cite les documents utilisés par leur titre.
- Réponses courtes, structurées, en français simple, sans jargon non expliqué.
- Ne parle pas de ton fonctionnement interne, ne mentionne pas de modèle de langage.`;
  }
  return `You are the XAMOTO assistant, specialised in automotive understanding and diagnosis.

ABSOLUTE PRINCIPLES (non-negotiable):
${principles}

WRITING RULES:
- Answer ONLY from the VEHICLE CONTEXT and the provided DOCUMENTS. Do not add technical data on your own initiative.
- If information is missing, write exactly: "${MESSAGES.insufficientDataEn}"
- Never invent a manufacturer value (torque, interval, oil specification, part reference).
- Never promise a vehicle is safe to drive. Never claim certainty.
- Always distinguish: measured fact / possible hypothesis / missing data.
- Cite the documents used by their title.
- Keep answers short, structured and in plain language.
- Do not discuss your internal workings or mention any language model.`;
}

export function buildUserPrompt(request: LlmRequest): string {
  const documents = request.documents
    .map((d, i) => `[DOCUMENT ${i + 1}] ${d.title} — ${d.publisher}\n${d.content}`)
    .join('\n\n');
  return `QUESTION DE L'UTILISATEUR :
${request.question}

${request.contextText}

DOCUMENTS AUTORISÉS :
${documents || '(aucun document pertinent)'}

Consigne : rédige la réponse en te limitant strictement à ce qui précède.`;
}

export interface LlmConfig {
  provider: string;
  openAiKey?: string;
  openAiModel?: string;
  baseUrl?: string;
  anthropicKey?: string;
  anthropicModel?: string;
}

export function createLlmProvider(config: LlmConfig): LlmProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAiCompatibleProvider({
        apiKey: config.openAiKey ?? '',
        model: config.openAiModel ?? 'gpt-4o-mini',
        baseUrl: config.baseUrl,
      });
    case 'anthropic':
      return new AnthropicProvider({
        apiKey: config.anthropicKey ?? '',
        model: config.anthropicModel ?? 'claude-3-5-haiku-latest',
      });
    default:
      return new UnavailableLlmProvider();
  }
}
