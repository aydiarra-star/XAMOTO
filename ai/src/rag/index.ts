/**
 * XAMOTO — RAG automobile (§15).
 *
 * Recherche documentaire AVANT toute formulation : XAMOTO ne répond jamais
 * « depuis sa mémoire ». La recherche combine :
 *   – un classement lexical BM25 (fonctionne hors connexion, sans modèle),
 *   – des filtres structurés (codes défaut, systèmes, carburant),
 *   – la fiabilité de la source (une source officielle passe devant).
 *
 * Chaque résultat renvoie sa source, sa version et sa date : ces métadonnées
 * accompagnent la réponse affichée à l'utilisateur (§15, §33).
 */
import type { DtcSystem, FuelType, KnowledgeDocument, KnowledgeSource, SourceReliability } from '@xamoto/shared';
import { RAG_DOCUMENTS } from './corpus.js';
import { KNOWLEDGE_SOURCES, SOURCE_BY_ID } from '@xamoto/diagnostic';

export interface RetrievalQuery {
  /** Question de l'utilisateur (ou mots-clés du diagnostic). */
  text: string;
  dtcCodes?: string[];
  systems?: DtcSystem[];
  fuelTypes?: FuelType[];
  brands?: string[];
  topK?: number;
  /** Inclure uniquement des sources de fiabilité au moins égale. */
  minReliability?: SourceReliability;
}

export interface RetrievedDocument {
  document: KnowledgeDocument;
  source: KnowledgeSource | null;
  score: number;
  snippet: string;
  /** Termes de la requête retrouvés (transparence de la recherche). */
  matchedTerms: string[];
  /** Motif d'inclusion structuré (code défaut correspondant, système…). */
  structuredMatch?: string;
}

const RELIABILITY_RANK: Record<SourceReliability, number> = {
  official: 5,
  licensed: 4,
  technical: 3,
  xamoto: 2,
  community: 1,
};

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'a', 'à', 'au', 'aux', 'en', 'dans', 'sur', 'pour', 'par', 'avec', 'sans',
  'est', 'sont', 'ce', 'cet', 'cette', 'ces', 'mon', 'ma', 'mes', 'son', 'sa', 'ses', 'il', 'elle', 'je', 'tu', 'nous', 'vous', 'que', 'qui',
  'quoi', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'pourquoi', 'quand', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'with',
  'without', 'is', 'are', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'it', 'they', 'we', 'do', 'does', 'did', 'what',
  'which', 'how', 'why', 'when', 'can', 'could', 'should', 'would', 'be', 'been', 'was', 'were', 'have', 'has', 'had', 'i', 'me', 'and', 'or',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map((w) => (w.length > 6 ? w.slice(0, 6) : w));
}

interface IndexedDocument {
  doc: KnowledgeDocument;
  tokens: string[];
  termFrequency: Map<string, number>;
  length: number;
}

function buildIndex(documents: KnowledgeDocument[]): { index: IndexedDocument[]; idf: Map<string, number>; avgLength: number } {
  const index: IndexedDocument[] = documents.map((doc) => {
    const text = `${doc.titleFr} ${doc.titleEn} ${doc.contentFr} ${doc.contentEn} ${doc.tags.join(' ')} ${(doc.relatesTo.dtc ?? []).join(' ')}`;
    const tokens = tokenize(text);
    const termFrequency = new Map<string, number>();
    for (const token of tokens) termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    return { doc, tokens, termFrequency, length: tokens.length };
  });
  const documentFrequency = new Map<string, number>();
  for (const item of index) {
    for (const term of new Set(item.tokens)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  const N = index.length;
  for (const [term, df] of documentFrequency) {
    idf.set(term, Math.log(1 + (N - df + 0.5) / (df + 0.5)));
  }
  const avgLength = index.reduce((sum, item) => sum + item.length, 0) / Math.max(index.length, 1);
  return { index, idf, avgLength };
}

const { index: DOCUMENT_INDEX, idf: DOCUMENT_IDF, avgLength: AVG_LENGTH } = buildIndex(RAG_DOCUMENTS);

/** Extrait la phrase la plus pertinente pour la requête (snippet affichable). */
function buildSnippet(doc: KnowledgeDocument, terms: string[], locale: 'fr' | 'en'): string {
  const text = locale === 'fr' ? doc.contentFr : doc.contentEn;
  const sentences = text.split(/(?<=[.!?])\s+/);
  let best = sentences[0] ?? text;
  let bestScore = -1;
  for (const sentence of sentences) {
    const tokens = new Set(tokenize(sentence));
    const score = terms.reduce((acc, term) => acc + (tokens.has(term) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }
  return best.length > 420 ? `${best.slice(0, 417)}…` : best;
}

/**
 * Recherche documentaire. Déterministe : à entrée identique, résultat identique.
 */
export function retrieve(query: RetrievalQuery): RetrievedDocument[] {
  const locale: 'fr' | 'en' = /[àâçéèêëîïôûùüÿœ]/i.test(query.text) || /\b(le|la|les|est|pourquoi|puis|je|ma|mon|comment)\b/i.test(query.text) ? 'fr' : 'en';
  const terms = tokenize(query.text);
  const dtcCodes = (query.dtcCodes ?? []).map((c) => c.toUpperCase());
  const topK = query.topK ?? 4;
  const k1 = 1.2;
  const b = 0.75;

  const results: RetrievedDocument[] = [];

  for (const item of DOCUMENT_INDEX) {
    let score = 0;
    const matchedTerms: string[] = [];

    for (const term of terms) {
      const tf = item.termFrequency.get(term) ?? 0;
      if (tf === 0) continue;
      const idf = DOCUMENT_IDF.get(term) ?? 0;
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * item.length) / AVG_LENGTH)));
      matchedTerms.push(term);
    }

    // Correspondance structurée : un code défaut cité dans la question pèse lourd.
    let structuredMatch: string | undefined;
    for (const code of dtcCodes) {
      if ((item.doc.relatesTo.dtc ?? []).includes(code)) {
        score += 4;
        structuredMatch = `Code défaut ${code} traité dans ce document`;
      }
      if (`${item.doc.tags.join(' ')} ${item.doc.contentFr}`.toUpperCase().includes(code)) {
        score += 1.5;
        structuredMatch = structuredMatch ?? `Code ${code} mentionné dans le document`;
      }
    }
    for (const system of query.systems ?? []) {
      if ((item.doc.relatesTo.systems ?? []).includes(system)) {
        score += 1.2;
        structuredMatch = structuredMatch ?? `Système concerné : ${system}`;
      }
    }
    for (const fuel of query.fuelTypes ?? []) {
      if ((item.doc.relatesTo.fuelTypes ?? []).includes(fuel)) {
        score += 0.6;
        structuredMatch = structuredMatch ?? `Motorisation concernée : ${fuel}`;
      }
    }
    for (const brand of query.brands ?? []) {
      const normalized = brand.toLowerCase();
      if (item.doc.contentFr.toLowerCase().includes(normalized) || (item.doc.relatesTo.brands ?? []).some((b) => b.toLowerCase() === normalized)) {
        score += 0.4;
      }
    }

    if (score <= 0) continue;

    const source = SOURCE_BY_ID.get(item.doc.sourceId) ?? null;
    if (query.minReliability && source && RELIABILITY_RANK[source.reliability] < RELIABILITY_RANK[query.minReliability]) continue;

    // Une source plus fiable passe devant, à pertinence comparable.
    if (source) score *= 1 + (RELIABILITY_RANK[source.reliability] - 1) * 0.06;

    results.push({
      document: item.doc,
      source,
      score: Number(score.toFixed(3)),
      snippet: buildSnippet(item.doc, matchedTerms, locale),
      matchedTerms: [...new Set(matchedTerms)].slice(0, 8),
      structuredMatch,
    });
  }

  results.sort((a, b2) => b2.score - a.score);
  return results.slice(0, topK);
}

/** Toutes les sources utilisables pour le rapport (§25 : section « sources »). */
export function allSources(): KnowledgeSource[] {
  return KNOWLEDGE_SOURCES;
}

export function documentById(id: string): KnowledgeDocument | undefined {
  return RAG_DOCUMENTS.find((d) => d.id === id);
}

export { RAG_DOCUMENTS };
