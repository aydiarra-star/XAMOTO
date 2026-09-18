/**
 * XAMOTO — Application HTTP (§37).
 *
 * Le serveur expose une API sécurisée et, en déploiement mono-service, sert
 * également l'application web compilée (app/web/dist) : un utilisateur peut
 * donc utiliser XAMOTO depuis un navigateur, sur mobile comme sur ordinateur.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { vehicleRoutes } from './routes/vehicles.js';
import { scanRoutes } from './routes/scan.js';
import { diagnosticRoutes } from './routes/diagnostic.js';
import { assistantRoutes } from './routes/assistant.js';
import { reportRoutes } from './routes/reports.js';
import { garageRoutes } from './routes/garages.js';
import { alertRoutes } from './routes/alerts.js';
import { syncRoutes } from './routes/sync.js';
import { seedAll } from './db/seed.js';

export interface BuildAppOptions {
  /** Amorce la base au démarrage (base de connaissances + mode démo). */
  seed?: boolean;
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger === false ? false : { level: config.logLevel, transport: config.env === 'development' ? undefined : undefined },
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: '1 minute',
    allowList: [],
  });

  /* ── Gestion d'erreurs : le statut porté par l'erreur est respecté ─────── */
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;
    const isServerError = statusCode >= 500;
    if (isServerError) app.log.error({ err: error, url: request.url }, 'erreur serveur');
    return reply.code(statusCode).send({
      error: {
        code: isServerError ? 'internal_error' : 'request_error',
        message: statusCode === 500 ? 'Une erreur interne est survenue. Aucune donnée n’a été inventée : réessayez.' : error.message,
      },
    });
  });

  /* ── Santé et présentation de l'API ───────────────────────────────────── */
  app.get('/api', async (_request, reply) => {
    return reply.send({
      name: 'XAMOTO API',
      tagline: 'Connaître sa voiture.',
      version: '1.0.0',
      pillars: ['Comprendre', 'Diagnostiquer', 'Agir'],
      llm: {
        provider: config.llm.provider === 'none' ? 'aucun (IA déterministe)' : config.llm.provider,
        notice:
          config.llm.provider === 'none'
            ? 'Aucun modèle de langage n’est configuré : XAMOTO répond avec son moteur déterministe et sa base documentaire. Le diagnostic est identique.'
            : 'Un modèle de langage est utilisé uniquement pour EXPLIQUER. Le diagnostic reste produit par le moteur de règles.',
      },
      principles: 'Voir §47 : aucune donnée inventée, aucune simulation présentée comme réelle, aucune hypothèse présentée comme certitude.',
    });
  });

  app.get('/api/health', async (_request, reply) => {
    return reply.send({ status: 'ok', time: new Date().toISOString(), env: config.env, database: 'sqlite', simulator: 'available' });
  });

  /* ── Amorçage de la base ──────────────────────────────────────────────── */
  if (options.seed !== false) {
    try {
      await seedAll({ withDemo: true });
      app.log.info('Base XAMOTO amorcée (base de connaissances + compte de démonstration).');
    } catch (error) {
      app.log.error({ err: error }, 'Amorçage de la base impossible');
    }
  }

  /* ── Routes métier ────────────────────────────────────────────────────── */
  await app.register(authRoutes);
  await app.register(vehicleRoutes);
  await app.register(scanRoutes);
  await app.register(diagnosticRoutes);
  await app.register(assistantRoutes);
  await app.register(reportRoutes);
  await app.register(garageRoutes);
  await app.register(alertRoutes);
  await app.register(syncRoutes);

  /* ── Application web (PWA) ────────────────────────────────────────────── */
  const webAvailable = existsSync(config.webDist) && existsSync(join(config.webDist, 'index.html'));
  if (webAvailable) {
    await app.register(fastifyStatic, { root: config.webDist, prefix: '/' });
  } else {
    app.log.warn(`Application web non trouvée (${config.webDist}). L’API seule est exposée. Lancez « npm run build ».`);
  }

  /*
   * Gestionnaire 404 unique (Fastify n'en autorise qu'un par instance) :
   *  — une route /api inconnue répond en JSON ;
   *  — une route d'interface retombe sur index.html (application monopage) ;
   *  — si l'application n'est pas construite, l'API explique quoi faire.
   */
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: { code: 'not_found', message: 'Ressource introuvable.' } });
    }
    if (webAvailable && request.method === 'GET') {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({
      error: {
        code: 'web_app_unavailable',
        message: 'L’application web n’est pas construite. Lancez « npm run build » puis redémarrez le serveur.',
      },
    });
  });

  return app;
}

export function publicDir(): string {
  return join(config.webDist);
}
