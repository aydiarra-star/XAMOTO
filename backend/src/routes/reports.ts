/**
 * XAMOTO — Rapports partageables (§25).
 *
 * Un rapport XAMOTO contient toujours : ce qui a été mesuré, ce qui n'a pas pu
 * l'être, les niveaux de certitude et de sécurité, les sources, et la mention
 * explicite que XAMOTO ne garantit rien.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { all, audit, get, jsonParse, run, type Row } from '../db/index.js';
import { assertVehicleAccess, authenticate, optionalAuth, type AuthUser } from '../auth/index.js';
import { buildDiagnosticReport, reportByToken } from '../services/reportService.js';

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/reports', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as AuthUser;
    const schema = z.object({
      vehicleId: z.string(),
      sessionId: z.string(),
      kind: z.enum(['diagnostic', 'inspection', 'repair_verification', 'maintenance', 'passport']).default('diagnostic'),
      title: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_input', message: 'Paramètres de rapport invalides.' } });
    assertVehicleAccess(parsed.data.vehicleId, user);
    try {
      const report = await buildDiagnosticReport({
        userId: user.id,
        vehicleId: parsed.data.vehicleId,
        sessionId: parsed.data.sessionId,
        kind: parsed.data.kind,
        title: parsed.data.title,
      });
      audit('report.created', 'reports', report.reportId, user.id, { kind: parsed.data.kind });
      return reply.code(201).send({
        id: report.reportId,
        payload: report.payload,
        shareToken: report.shareToken,
        publicUrl: report.publicUrl,
        qrDataUrl: report.qrDataUrl,
        noticeFr:
          'Ce rapport peut être partagé par lien ou QR code. Il contient les données disponibles au moment du diagnostic, leurs limites et leurs sources.',
      });
    } catch (error) {
      return reply.code(404).send({ error: { code: 'report_unavailable', message: (error as Error).message } });
    }
  });

  app.get('/api/reports', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as AuthUser;
    const rows = all<Row>(
      `SELECT r.id, r.vehicle_id, r.session_id, r.kind, r.title, r.share_token, r.generated_at, v.brand, v.model
       FROM reports r LEFT JOIN vehicles v ON v.id = r.vehicle_id
       WHERE r.user_id = ? ORDER BY r.generated_at DESC LIMIT 100`,
      [user.id],
    );
    return reply.send({
      reports: rows.map((row) => ({
        id: row.id,
        vehicleId: row.vehicle_id,
        sessionId: row.session_id,
        kind: row.kind,
        title: row.title,
        vehicle: row.brand ? `${row.brand} ${row.model}` : null,
        shareToken: row.share_token,
        generatedAt: row.generated_at,
      })),
    });
  });

  /**
   * Consultation publique par jeton : lecture seule, sans authentification.
   * Le jeton est aléatoire et révocable par le propriétaire.
   */
  app.get('/api/reports/public/:token', { preHandler: optionalAuth }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const row = reportByToken(token);
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Rapport introuvable ou révoqué.' } });
    return reply.send({
      report: {
        id: row.id,
        kind: row.kind,
        title: row.title,
        generatedAt: row.generated_at,
        payload: jsonParse<Record<string, unknown>>(row.payload, {}),
      },
      noticeFr:
        'Rapport partagé en lecture seule. Il reflète l’état des données au moment du diagnostic : un problème peut évoluer sans nouveau scan.',
    });
  });

  app.delete('/api/reports/:id/share', { preHandler: authenticate }, async (request, reply) => {
    const user = request.user as AuthUser;
    const { id: reportId } = request.params as { id: string };
    const row = get<Row>('SELECT * FROM reports WHERE id = ? AND user_id = ?', [reportId, user.id]);
    if (!row) return reply.code(404).send({ error: { code: 'not_found', message: 'Rapport introuvable.' } });
    run('UPDATE reports SET share_token = NULL, public_url = NULL WHERE id = ?', [reportId]);
    audit('report.share_revoked', 'reports', reportId, user.id);
    return reply.send({ ok: true, noticeFr: 'Le lien de partage a été révoqué. Le rapport reste disponible pour vous.' });
  });
}
