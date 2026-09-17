/**
 * XAMOTO — Point d'entrée du serveur (§34, §37).
 *
 * Démarrage :
 *   npm run dev      (API + application web)
 *   npm --workspace backend run start
 *
 * Aucune clé d'API n'est nécessaire : sans fournisseur LLM configuré, XAMOTO
 * fonctionne intégralement avec son moteur déterministe et sa base documentaire.
 */
import { buildApp } from './app.js';
import { config } from './config.js';
import { closeDb } from './db/index.js';
import { databaseHealthy, seedStatus } from './db/seed.js';

async function main(): Promise<void> {
  const app = await buildApp({ seed: true });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Signal ${signal} reçu : arrêt propre de XAMOTO.`);
    try {
      await app.close();
      closeDb();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.port, host: config.host });
    const banner = [
      '',
      '  XAMOTO — Connaître sa voiture.',
      '  Comprendre · Diagnostiquer · Agir',
      '',
      `  API          : http://${config.host}:${config.port}/api`,
      `  Interface    : http://${config.host}:${config.port}/`,
      `  Base         : ${config.dbPath}`,
      `  Base saine   : ${databaseHealthy() ? 'oui' : 'non'}`,
      `  IA           : ${config.llm.provider === 'none' ? 'déterministe (aucun LLM configuré)' : config.llm.provider}`,
      `  Marché       : Sénégal / Afrique de l’Ouest (contexte, jamais cause de panne)`,
      '',
    ].join('\n');
    app.log.info(banner);
    app.log.info(`Amorçage : ${JSON.stringify(seedStatus())}`);
  } catch (error) {
    app.log.error({ err: error }, 'Impossible de démarrer le serveur XAMOTO');
    process.exit(1);
  }
}

void main();
