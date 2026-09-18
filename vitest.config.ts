/**
 * XAMOTO — Configuration des tests automatisés (vitest).
 *
 * Deux niveaux de vérification :
 *   • `tests/`            : parcours complets de bout en bout (API, base, HTTP) ;
 *   • `*​/test/*.test.ts`  : vérifications unitaires du moteur, de l'OBD, de l'IA
 *                           et des règles de sécurité.
 *
 * Les alias reprennent exactement ceux du dépôt (`@xamoto/*` → source des
 * paquets) : un test importe donc le même code que la production.
 */
import { defineConfig } from 'vitest/config';

function pkg(name: string): string {
  return new URL(`./${name}/src/index.ts`, import.meta.url).pathname;
}

export default defineConfig({
  resolve: {
    alias: {
      '@xamoto/shared': pkg('shared'),
      '@xamoto/obd': pkg('obd'),
      '@xamoto/diagnostic': pkg('diagnostic'),
      '@xamoto/ai': pkg('ai'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'app/web/**'],
    // Les tests unitaires ne doivent jamais dépendre d'une base ni d'un réseau.
    globals: false,
    testTimeout: 15000,
  },
});
