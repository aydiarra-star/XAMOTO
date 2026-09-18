/**
 * XAMOTO — Commande d'amorçage de la base.
 *
 *   npm run seed                 : amorce la base de connaissances + références + démo
 *   npm --workspace backend run db:reset : vide les données applicatives puis réamorce
 */
import { closeDb } from './index.js';
import { DEMO_CREDENTIALS, databaseHealthy, resetApplicationData, seedDemo, seedKnowledge, seedReferenceData, seedStatus } from './seed.js';

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  const withoutDemo = process.argv.includes('--no-demo');

  if (reset) {
    console.log('• Réinitialisation des données applicatives (base de connaissances conservée)…');
    resetApplicationData();
  }

  console.log('• Base de connaissances…');
  const knowledge = seedKnowledge();
  console.log(`  ${knowledge.sources} sources, ${knowledge.documents} documents, ${knowledge.dtcs} codes défaut.`);

  console.log('• Données de référence…');
  const reference = seedReferenceData();
  console.log(`  ${reference.specs} fiches véhicules, ${reference.garages} garages (exemples), ${reference.parts} pièces.`);

  if (!withoutDemo) {
    console.log('• Compte de démonstration (données SIMULÉES)…');
    const demo = await seedDemo();
    if (demo) {
      console.log(`  Compte créé : ${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password}`);
      console.log(`  ${demo.vehicleIds.length} véhicules, ${demo.scanIds.length} diagnostics simulés.`);
    } else {
      console.log('  Compte déjà présent : rien à faire.');
    }
  }

  console.log('• État de la base :');
  for (const [key, value] of Object.entries(seedStatus())) {
    console.log(`  ${key.padEnd(14)} ${value}`);
  }
  console.log(`• Base saine : ${databaseHealthy() ? 'oui' : 'non'}`);
  console.log('');
  console.log('Rappel : les scans du compte de démonstration proviennent du SIMULATEUR');
  console.log('et portent toujours la mention « MODE SIMULATION ».');
  closeDb();
}

void main();
