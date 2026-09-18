/**
 * XAMOTO — Configuration serveur.
 * Aucune variable n'est obligatoire : XAMOTO démarre et fonctionne complet
 * sans clé d'API (IA déterministe, base SQLite locale, simulateur OBD).
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface XamotoConfig {
  port: number;
  host: string;
  env: 'development' | 'production' | 'test';
  publicUrl: string;
  jwtSecret: string;
  sessionTtlHours: number;
  dbPath: string;
  llm: {
    provider: string;
    openAiKey?: string;
    openAiModel?: string;
    baseUrl?: string;
    anthropicKey?: string;
    anthropicModel?: string;
  };
  rateLimitMax: number;
  logLevel: string;
  /** Répertoire de l'application web compilée (déploiement mono-service). */
  webDist: string;
}

function env(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

export function loadConfig(): XamotoConfig {
  const dbPath = resolve(process.cwd(), env('XAMOTO_DB_PATH', './data/xamoto.sqlite'));
  mkdirSync(dirname(dbPath), { recursive: true });

  return {
    port: Number(env('PORT', '3000')),
    host: env('HOST', '0.0.0.0'),
    env: (env('NODE_ENV', 'development') as XamotoConfig['env']) ?? 'development',
    publicUrl: env('XAMOTO_PUBLIC_URL', `http://localhost:${env('PORT', '3000')}`),
    jwtSecret: env('XAMOTO_JWT_SECRET', 'xamoto-development-secret-change-in-production'),
    sessionTtlHours: Number(env('XAMOTO_SESSION_TTL_HOURS', '720')),
    dbPath,
    llm: {
      provider: env('XAMOTO_LLM_PROVIDER', 'none'),
      openAiKey: process.env.OPENAI_API_KEY,
      openAiModel: process.env.OPENAI_MODEL,
      baseUrl: process.env.XAMOTO_LLM_BASE_URL,
      anthropicKey: process.env.ANTHROPIC_API_KEY,
      anthropicModel: process.env.ANTHROPIC_MODEL,
    },
    rateLimitMax: Number(env('XAMOTO_RATE_LIMIT_MAX', '300')),
    logLevel: env('XAMOTO_LOG_LEVEL', 'info'),
    webDist: resolve(process.cwd(), env('XAMOTO_WEB_DIST', './app/web/dist')),
  };
}

export const config = loadConfig();
