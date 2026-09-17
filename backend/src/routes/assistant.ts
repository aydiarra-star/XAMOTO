/**
 * XAMOTO — Assistant IA (§13 → §16).
 *
 * Chaîne respectée à la lettre :
 *   question → contexte véhicule → recherche documentaire (RAG)
 *   → moteur de règles (déjà exécuté) → analyse → LLM (optionnel)
 *   → réponse structurée → VÉRIFICATION → utilisateur.
 *
 * Le LLM ne décide jamais : il reformule. La réponse est vérifiée, et en cas
 * d'échec c'est la réponse déterministe qui est servie (§47-6).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { askXamoto, buildAiContext, createLlmProvider, documentById, serializeContext, validateAnswer } from '@xamoto/ai';
import { buildMaintenancePlan } from '@xamoto/diagnostic';
import { LOCALES } from '@xamoto/shared';
import { all, audit, get, id, jsonParse, now, run, type Row } from '../db/index.js';
import { assertVehicleAccess, authenticate, type AuthUser } from '../auth/index.js';
import { canIDriveForContext, loadScanSnapshot, vehicleRowToApi } from '../services/scanService.js';
import { config } from '../config.js';

const askSchema = z.object({
  question: z.string().min(2, 'Posez une question.').max(2000),
  vehicleId: z.string().nullable().optional(),
  diagnosticSessionId: z.string().nullable().optional(),
  conversationId: z.string().nullable().optional(),
  // Trois langues possibles ; l'assistant explique lui-même le repli éventuel.
  locale: z.enum(LOCALES).default('fr'),
});

export async function assistantRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.post('/api/assistant/ask', async (request, reply) => {
    const user = request.user as AuthUser;
    const parsed = askSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Question invalide.', details: parsed.error.flatten() } });
    const data = parsed.data;

    /* ── Contexte : uniquement des données réelles de l'utilisateur ──────── */
    let vehicle: Record<string, unknown> | null = null;
    let vehicleId: string | null = null;
    let diagnosticRow: Row | undefined;
    let contextResult;
    let maintenance: NonNullable<import('@xamoto/shared').AiContextPack['maintenance']> = [];
    let repairs: Array<{ description: string; performedAt: string }> = [];
    let history: NonNullable<import('@xamoto/shared').AiContextPack['history']> = [];

    if (data.vehicleId) {
      vehicleId = data.vehicleId;
      assertVehicleAccess(vehicleId, user);
      const row = get<Row>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
      if (row) {
        const spec = get<Row>(
          'SELECT * FROM vehicle_specs WHERE lower(brand) = lower(?) AND lower(model) = lower(?) AND ? BETWEEN year_from AND year_to LIMIT 1',
          [String(row.brand), String(row.model), Number(row.year)],
        );
        const apiVehicle = vehicleRowToApi(row, spec);
        vehicle = apiVehicle;

        diagnosticRow = data.diagnosticSessionId
          ? get<Row>('SELECT * FROM diagnostic_sessions WHERE id = ? AND vehicle_id = ?', [data.diagnosticSessionId, vehicleId])
          : get<Row>('SELECT * FROM diagnostic_sessions WHERE vehicle_id = ? ORDER BY started_at DESC LIMIT 1', [vehicleId]);

        repairs = all<Row>('SELECT description, performed_at FROM repairs WHERE vehicle_id = ? ORDER BY performed_at DESC LIMIT 10', [vehicleId]).map((r) => ({
          description: String(r.description),
          performedAt: String(r.performed_at),
        }));

        history = all<Row>('SELECT type, title_fr, occurred_at FROM vehicle_events WHERE vehicle_id = ? ORDER BY occurred_at DESC LIMIT 15', [vehicleId]).map((r) => ({
          type: String(r.type) as NonNullable<import('@xamoto/shared').AiContextPack['history']>[number]['type'],
          titleFr: String(r.title_fr),
          occurredAt: String(r.occurred_at),
        }));

        const maintenanceRows = all<Row>('SELECT kind, performed_at, odometer_km FROM maintenance WHERE vehicle_id = ?', [vehicleId]).map((r) => ({
          kind: String(r.kind),
          performedAt: String(r.performed_at),
          odometerKm: r.odometer_km === null ? null : Number(r.odometer_km),
        }));
        try {
          maintenance = buildMaintenancePlan({
            vehicle: {
              fuelType: String(row.fuel_type) as never,
              odometerKm: Number(row.odometer_km),
              year: Number(row.year),
              engine: String(row.engine),
            },
            spec: null,
            history: maintenanceRows,
          }).map((item) => ({
            labelFr: item.labelFr,
            labelEn: item.labelEn,
            status: item.status,
            nextDueKm: item.nextDueKm ?? null,
            nextDueAt: item.nextDueAt ?? null,
          }));
        } catch {
          maintenance = [];
        }
      }
    }

    /* Le diagnostic est RELU depuis le moteur, avec les tests confirmés. */
    let context: import('@xamoto/diagnostic').DiagnosticContext | null = null;
    let result: import('@xamoto/diagnostic').DiagnosticResult | null = null;
    if (diagnosticRow && vehicleId) {
      const { loadContextAndResult } = await import('./diagnostic.js');
      const rebuilt = loadContextAndResult(diagnosticRow);
      context = rebuilt.context;
      result = rebuilt.result;
    }

    const mode: 'obd' | 'simulator' | 'none' = diagnosticRow
      ? (String(diagnosticRow.data_origin) === 'simulator' ? 'simulator' : 'obd')
      : vehicle
        ? 'none'
        : 'none';

    const built = buildAiContext({
      vehicle: vehicle as never,
      spec: ((vehicle?.spec ?? null) as never),
      diagnostic: result,
      context,
      canIDrive: context && result ? canIDriveForContext(context, result) : null,
      repairs,
      maintenance,
      history,
      mode,
    });

    /* ── Appel de la chaîne IA complète ──────────────────────────────────── */
    const llm = createLlmProvider(config.llm);
    const outcome = await askXamoto({ question: data.question, contextResult: built, locale: data.locale, llm });

    /* Une seconde vérification est appliquée à la réponse finale, quel que
       soit son producteur : le moteur déterministe comme le LLM. */
    const citedDocuments = outcome.answer.citations
      .map((citation) => documentById(citation.documentId))
      .filter((document): document is NonNullable<typeof document> => Boolean(document));
    const finalValidation = validateAnswer(outcome.answer.contentFr, built, citedDocuments);

    /* ── Persistance de la conversation (§30) ────────────────────────────── */
    let conversationId = data.conversationId ?? null;
    if (!conversationId) {
      conversationId = id('conv');
      run('INSERT INTO ai_conversations (id, user_id, vehicle_id, diagnostic_session_id, title, locale, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', [
        conversationId,
        user.id,
        vehicleId,
        diagnosticRow ? String(diagnosticRow.id) : null,
        data.question.slice(0, 80),
        data.locale,
        now(),
        now(),
      ]);
    } else {
      const existing = get<Row>('SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?', [conversationId, user.id]);
      if (!existing) return reply.code(404).send({ error: { code: 'not_found', message: 'Conversation introuvable.' } });
    }

    run(
      'INSERT INTO ai_messages (id, conversation_id, role, content_fr, content_en, citations, used_context, refused, refusal_reason_fr, refusal_reason_en, structured, engine, validation, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        id('msg'),
        conversationId,
        'user',
        data.question,
        data.question,
        '[]',
        '[]',
        0,
        null,
        null,
        null,
        'deterministic',
        null,
        now(),
      ],
    );
    run(
      'INSERT INTO ai_messages (id, conversation_id, role, content_fr, content_en, citations, used_context, refused, refusal_reason_fr, refusal_reason_en, structured, engine, validation, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        id('msg'),
        conversationId,
        'assistant',
        outcome.answer.contentFr,
        outcome.answer.contentEn,
        JSON.stringify(outcome.answer.citations),
        JSON.stringify(outcome.answer.usedContext),
        outcome.answer.refused ? 1 : 0,
        outcome.answer.refusalReasonFr ?? null,
        outcome.answer.refusalReasonEn ?? null,
        JSON.stringify(outcome.answer.structured),
        outcome.answer.engine,
        JSON.stringify(finalValidation),
        now(),
      ],
    );
    run('UPDATE ai_conversations SET updated_at = ? WHERE id = ?', [now(), conversationId]);
    audit('assistant.asked', 'ai_conversations', conversationId, user.id, { intent: outcome.answer.intent, engine: outcome.answer.engine, refused: outcome.answer.refused });

    return reply.send({
      conversationId,
      intent: outcome.answer.intent,
      answerFr: outcome.answer.contentFr,
      answerEn: outcome.answer.contentEn,
      refused: outcome.answer.refused,
      refusalReasonFr: outcome.answer.refusalReasonFr ?? null,
      refusalReasonEn: outcome.answer.refusalReasonEn ?? null,
      structured: outcome.answer.structured,
      engine: outcome.answer.engine,
      citations: outcome.answer.citations,
      usedContext: outcome.answer.usedContext,
      dataDisclosure: {
        availableFacts: built.availableFacts,
        missingFacts: built.missingFacts,
      },
      llm: outcome.llm,
      validation: finalValidation,
      // Transparence linguistique : langue demandée, langue réellement utilisée,
      // et la raison lorsqu'elles diffèrent.
      language: {
        ...outcome.language,
        notice: data.locale === 'en' ? outcome.language.noticeEn : outcome.language.noticeFr,
      },
      // Le contexte envoyé au modèle est restituable : l'utilisateur peut
      // vérifier ce que XAMOTO savait, et ce qu'il ne savait pas.
      contextAudit: serializeContext(built, outcome.language.effective),
    });
  });

  app.get('/api/assistant/conversations', async (request, reply) => {
    const user = request.user as AuthUser;
    const rows = all<Row>('SELECT * FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50', [user.id]);
    return reply.send({
      conversations: rows.map((row) => ({
        id: row.id,
        vehicleId: row.vehicle_id,
        diagnosticSessionId: row.diagnostic_session_id,
        title: row.title,
        locale: row.locale,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  });

  app.get('/api/assistant/conversations/:id/messages', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: conversationId } = request.params as { id: string };
    const conversation = get<Row>('SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?', [conversationId, user.id]);
    if (!conversation) return reply.code(404).send({ error: { code: 'not_found', message: 'Conversation introuvable.' } });
    const messages = all<Row>('SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC', [conversationId]).map((row) => ({
      id: row.id,
      role: row.role,
      contentFr: row.content_fr,
      contentEn: row.content_en,
      citations: jsonParse<unknown[]>(row.citations, []),
      usedContext: jsonParse<string[]>(row.used_context, []),
      refused: Number(row.refused) === 1,
      refusalReasonFr: row.refusal_reason_fr,
      refusalReasonEn: row.refusal_reason_en,
      structured: row.structured ? jsonParse<Record<string, unknown>>(row.structured, {}) : null,
      engine: row.engine,
      validation: row.validation ? jsonParse<Record<string, unknown>>(row.validation, {}) : null,
      createdAt: row.created_at,
    }));
    return reply.send({ conversation: { id: conversation.id, title: conversation.title, vehicleId: conversation.vehicle_id }, messages });
  });

  app.delete('/api/assistant/conversations/:id', async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: conversationId } = request.params as { id: string };
    const conversation = get<Row>('SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?', [conversationId, user.id]);
    if (!conversation) return reply.code(404).send({ error: { code: 'not_found', message: 'Conversation introuvable.' } });
    run('DELETE FROM ai_conversations WHERE id = ?', [conversationId]);
    return reply.send({ ok: true });
  });

  /** Documentation interne : ce que l'IA peut et ne peut pas faire (§14, §16). */
  app.get('/api/assistant/capabilities', async (_request, reply) => {
    return reply.send({
      canDo: [
        'Expliquer un code défaut documenté et sa signification.',
        'Traduire une mesure en langage clair, avec le niveau de certitude.',
        'Dire ce qui est mesuré, ce qui est documenté, ce qui est estimé.',
        'Dire « je ne dispose pas de cette donnée pour votre véhicule ».',
        'Proposer les tests qui départagent plusieurs causes possibles.',
        'Répondre en français et en anglais ; afficher les libellés wolof déjà relus.',
      ],
      cannotDo: [
        'Inventer une traduction : une explication technique n’est jamais rédigée en wolof sans relecture humaine.',
        'Inventer une valeur, une spécification ou un couple de serrage.',
        'Présenter une hypothèse comme une certitude.',
        'Garantir la sécurité du véhicule ou d’une réparation.',
        'Remplacer un professionnel ou un contrôle physique.',
      ],
      retrieval: 'Base documentaire XAMOTO (méthodes, relations, repères) — jamais de valeurs constructeur inventées.',
      llm: config.llm.provider === 'none' ? 'non configuré (réponses déterministes)' : config.llm.provider,
    });
  });
}
