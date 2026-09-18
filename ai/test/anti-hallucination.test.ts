/**
 * XAMOTO — IA : anti-hallucination (§13 → §16).
 *
 * C'est la garantie la plus importante du produit : l'assistant ne doit jamais
 * inventer un code défaut, une valeur, une spécification constructeur ou une
 * garantie de sécurité. Ces tests simulent un LLM qui délire pour vérifier que
 * XAMOTO le rejette et retombe sur sa réponse issue du moteur de règles.
 */
import { describe, expect, it } from 'vitest';
import {
  RAG_DOCUMENTS,
  VALIDATION_FALLBACK_EN,
  VALIDATION_FALLBACK_FR,
  askXamoto,
  buildAiContext,
  detectIntent,
  documentById,
  retrieve,
  validateAnswer,
  type ContextBuildResult,
  type LlmProvider,
} from '@xamoto/ai';
import { DiagnosticEngine } from '@xamoto/diagnostic';
import type { DiagnosticContext } from '../../diagnostic/src/rules/types.js';
import { dtc, fixtureContext, reading } from '../../diagnostic/test/fixtures.js';

const engine = new DiagnosticEngine();

const richContext: DiagnosticContext = fixtureContext({
  readings: [
    reading('coolant_temp', 88, '°C'),
    reading('engine_rpm', 780, 'tr/min'),
    reading('battery_voltage', 13.9, 'V'),
    reading('long_fuel_trim_b1', 21.4, '%'),
    reading('short_fuel_trim_b1', 4.2, '%'),
    reading('maf_air_flow', 3.1, 'g/s'),
  ],
  dtcs: [dtc('P0171', { status: 'stored', occurrences: 3 })],
  symptoms: [{ key: 'loss_of_power', present: true }],
});

function contextFor(context: DiagnosticContext): ContextBuildResult {
  const diagnostic = engine.analyze(context);
  const canIDrive = diagnostic.canIDrive;
  return buildAiContext({
    vehicle: context.vehicle,
    diagnostic,
    canIDrive,
    context,
    mode: context.source === 'simulator' ? 'simulator' : context.source === 'obd' ? 'obd' : 'none',
  });
}

describe('recherche documentaire (RAG)', () => {
  it('ne renvoie que des documents de la base XAMOTO, avec leur source', () => {
    const results = retrieve({ text: 'ratés d’allumage et perte de puissance', dtcCodes: ['P0300'], topK: 4 });
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(documentById(result.document.id)).toBeDefined();
      expect(result.source, `document sans source : ${result.document.id}`).not.toBeNull();
      expect(result.score).toBeGreaterThan(0);
      expect(result.snippet.length).toBeGreaterThan(10);
    }
  });

  it('est déterministe : même question, mêmes documents', () => {
    const a = retrieve({ text: 'pourquoi mon voyant moteur est allumé', topK: 3 });
    const b = retrieve({ text: 'pourquoi mon voyant moteur est allumé', topK: 3 });
    expect(b.map((r) => r.document.id)).toEqual(a.map((r) => r.document.id));
  });

  it('respecte le nombre de documents demandé', () => {
    expect(retrieve({ text: 'batterie', topK: 2 }).length).toBeLessThanOrEqual(2);
  });

  it('aucun document de la base ne cite une source inexistante', () => {
    for (const document of RAG_DOCUMENTS) {
      expect(document.titleFr.length).toBeGreaterThan(5);
      expect(document.contentFr.length).toBeGreaterThan(20);
      expect(document.sourceId).toMatch(/^src_/);
    }
  });
});

describe('vérification des réponses (§16)', () => {
  const contextResult = contextFor(richContext);

  it('rejette un code défaut inventé par le LLM', () => {
    const validation = validateAnswer('Vous avez un code P2199 qui indique un problème de sonde lambda.', contextResult);
    expect(validation.passed).toBe(false);
    expect(validation.violations.some((v) => v.type === 'unknown_dtc' && v.severity === 'error')).toBe(true);
  });

  it('accepte un code réellement lu sur le véhicule', () => {
    const validation = validateAnswer('Le code P0171 signale un mélange trop pauvre sur la banque 1.', contextResult);
    expect(validation.violations.some((v) => v.type === 'unknown_dtc')).toBe(false);
  });

  it('rejette une valeur chiffrée absente des données', () => {
    const validation = validateAnswer('La pression de carburant mesurée est de 4,8 bar, il faut remplacer la pompe.', contextResult);
    expect(validation.passed).toBe(false);
    expect(validation.violations.some((v) => v.type === 'invented_value')).toBe(true);
  });

  it('accepte une valeur réellement mesurée, avec son unité', () => {
    const validation = validateAnswer('La tension batterie lue est de 13,9 V, ce qui est normal moteur tournant.', contextResult);
    expect(validation.violations.some((v) => v.type === 'invented_value')).toBe(false);
  });

  it('rejette une garantie de sécurité', () => {
    for (const answer of [
      'Vous pouvez rouler sans risque, ce n’est rien.',
      'Il n’y a aucun danger du tout.',
      'C’est sûr et certain, le catalyseur est mort.',
    ]) {
      const validation = validateAnswer(answer, contextResult);
      expect(validation.passed, `aurait dû être rejeté : ${answer}`).toBe(false);
      expect(validation.violations.some((v) => v.type === 'unsupported_guarantee')).toBe(true);
    }
  });

  it('rejette une spécification constructeur inventée', () => {
    const oil = validateAnswer('Utilisez de l’huile 5W30 préconisée par le constructeur, tous les 10000 km.', contextResult);
    expect(oil.violations.some((v) => v.type === 'invented_specification')).toBe(true);
    const torque = validateAnswer('Serrez la bougie au couple de serrage de 25 Nm.', contextResult);
    expect(torque.violations.some((v) => v.type === 'invented_specification')).toBe(true);
  });

  it('fournit un message de repli dans les deux langues', () => {
    expect(VALIDATION_FALLBACK_FR.length).toBeGreaterThan(20);
    expect(VALIDATION_FALLBACK_EN.length).toBeGreaterThan(20);
  });
});

describe('assistant : moteur déterministe sans LLM', () => {
  it('reconnaît les intentions utiles', () => {
    expect(detectIntent('Puis-je rouler avec ma voiture ?')).toBe('can_i_drive');
    expect(detectIntent('Que signifie P0420 ?')).toBe('dtc_meaning');
    expect(detectIntent('Quels tests puis-je faire ?')).toBe('which_tests');
    expect(detectIntent('Quelle est la capitale du Sénégal ?')).toBe('off_topic');
  });

  it('répond sans LLM et le dit honnêtement', async () => {
    const result = await askXamoto({ question: 'Pourquoi le voyant moteur est allumé ?', contextResult: contextFor(richContext) });
    expect(result.answer.engine).toBe('deterministic');
    expect(result.llm.available).toBe(false);
    expect(result.llm.used).toBe(false);
    expect(result.answer.contentFr.length).toBeGreaterThan(40);
    expect(result.answer.contentEn.length).toBeGreaterThan(40);
    expect(result.answer.contentFr).not.toMatch(/sans risque|aucun danger/i);
  });

  it('« puis-je rouler ? » renvoie toujours un niveau de sécurité et un avertissement', async () => {
    const result = await askXamoto({ question: 'Puis-je rouler ?', contextResult: contextFor(richContext) });
    expect(result.answer.structured.safety).toBeDefined();
    expect(result.answer.structured.certainty).toBeDefined();
    expect(result.answer.contentFr).toMatch(/garantir|garantie|professionnel/i);
  });

  it('répond en français quand la langue demandée est le wolof, et le signale', async () => {
    // Le wolof n'est pas produit par génération : une explication technique
    // écrite automatiquement en wolof serait une invention (§16, §40).
    const result = await askXamoto({ question: 'Puis-je rouler ?', contextResult: contextFor(richContext), locale: 'wo' });
    expect(result.language.requested).toBe('wo');
    expect(result.language.effective).toBe('fr');
    expect(result.language.fallback).toBe(true);
    expect(result.language.noticeFr).toMatch(/wolof/i);
    expect(result.answer.contentFr.length).toBeGreaterThan(40);
    // Aucun mot wolof inventé dans la réponse.
    expect(result.answer.contentFr).not.toMatch(/natt|déggóó|jàpp/i);
  });

  it('répond en anglais sans message de repli lorsque l’anglais est demandé', async () => {
    const result = await askXamoto({ question: 'What does P0420 mean?', contextResult: contextFor(richContext), locale: 'en' });
    expect(result.language.effective).toBe('en');
    expect(result.language.fallback).toBe(false);
    expect(result.language.noticeFr).toBe('');
  });

  it('affiche un système lisible, jamais la clé interne', async () => {
    const result = await askXamoto({ question: 'Que signifie P0420 ?', contextResult: contextFor(richContext) });
    expect(result.answer.contentFr).toContain('Dépollution');
    expect(result.answer.contentFr).not.toContain('Système concerné : depollution');
  });

  it('sans aucune donnée, l’assistant précise que le code n’a pas été lu sur le véhicule', async () => {
    const empty = fixtureContext({ readings: [], dtcs: [], symptoms: [], source: 'none' });
    const result = await askXamoto({ question: 'Que signifie P0420 ?', contextResult: contextFor(empty) });
    // Expliquer la signification générale d'un code documenté est légitime,
    // mais la réponse doit dire clairement qu'il n'a PAS été lu sur le véhicule.
    expect(result.answer.contentFr).toContain('ne figure pas dans le dernier scan de votre véhicule');
    expect(result.answer.contentFr).toContain('signification générale');
    expect(result.answer.contentFr).not.toMatch(/vous avez (un|le) code P0420/i);
  });

  it('un code non documenté déclenche la phrase exacte du §16', async () => {
    const empty = fixtureContext({ readings: [], dtcs: [], symptoms: [], source: 'none' });
    const result = await askXamoto({ question: 'Que signifie P1999 ?', contextResult: contextFor(empty) });
    expect(result.answer.refused).toBe(true);
    expect(result.answer.contentFr).toContain('Je ne dispose pas de cette donnée pour votre véhicule');
    expect(result.answer.contentFr).toContain('n’est pas documenté');
  });

  it('refuse une question hors périmètre au lieu de répondre à tout prix', async () => {
    const result = await askXamoto({ question: 'Quelle est la capitale du Sénégal ?', contextResult: contextFor(richContext) });
    expect(result.answer.refused).toBe(true);
    expect(result.answer.contentFr).toMatch(/périmètre|diagnostic/i);
  });
});

describe('assistant : un LLM qui délire est rejeté', () => {
  const hallucinating: LlmProvider = {
    id: 'test-hallucination',
    available: () => true,
    async complete() {
      return 'Vous avez un code P2199 : remplacez immédiatement le moteur, vous pouvez rouler sans risque.';
    },
  };

  it('retombe sur la réponse du moteur et le signale', async () => {
    const result = await askXamoto({
      question: 'Pourquoi le voyant moteur est allumé ?',
      contextResult: contextFor(richContext),
      llm: hallucinating,
    });
    expect(result.llm.rejected).toBe(true);
    expect(result.answer.engine).toBe('deterministic');
    expect(result.answer.contentFr).not.toContain('P2199');
    expect(result.answer.contentFr).toContain('vérification');
    expect(result.validation?.passed).toBe(false);
  });

  it('accepte un LLM qui respecte les données et cite ses sources', async () => {
    const honest: LlmProvider = {
      id: 'test-honest',
      available: () => true,
      async complete() {
        return 'Le code P0171 lu sur votre véhicule indique un mélange trop pauvre. Plusieurs causes sont possibles ; un test est nécessaire avant de conclure.';
      },
    };
    const result = await askXamoto({
      question: 'Pourquoi le voyant moteur est allumé ?',
      contextResult: contextFor(richContext),
      llm: honest,
    });
    expect(result.llm.used).toBe(true);
    expect(result.llm.rejected).toBe(false);
    expect(result.answer.engine).toBe('llm');
    expect(result.answer.contentFr).toContain('Plusieurs causes sont possibles');
  });

  it('un fournisseur en erreur ne casse pas la réponse (§47-9)', async () => {
    const broken: LlmProvider = {
      id: 'test-broken',
      available: () => true,
      async complete() {
        throw new Error('réseau indisponible');
      },
    };
    const result = await askXamoto({ question: 'Que signifie P0171 ?', contextResult: contextFor(richContext), llm: broken });
    expect(result.llm.error).toContain('réseau indisponible');
    expect(result.answer.engine).toBe('deterministic');
    expect(result.answer.contentFr.length).toBeGreaterThan(40);
  });
});
