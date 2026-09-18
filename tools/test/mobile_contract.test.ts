/**
 * XAMOTO — Contrat entre l'application mobile (Dart) et le serveur (§7, §34).
 *
 * Pourquoi ce test existe : cet environnement ne peut pas exécuter `flutter test`
 * (aucun SDK Dart/Flutter téléchargeable). Le code Dart est donc livré SANS
 * exécution. Ce test comble une partie du risque, et seulement une partie :
 * il vérifie ce qui se vérifie sans compilateur — que le mobile et le serveur
 * parlent bien le même langage.
 *
 * Ce qui est vérifié ici :
 *   1. chaque écran déclaré dans `routes.dart` correspond à un fichier existant,
 *      et chaque écran est branché dans `app.dart` ;
 *   2. les phrases exigées par le §16 sont IDENTIQUES à celles du reste du
 *      produit — un mot changé sur mobile serait un mensonge de plus ;
 *   3. les identifiants de scénarios simulés correspondent au simulateur du
 *      serveur : la démonstration mobile ne peut pas proposer un scénario
 *      inexistant ;
 *   4. le catalogue wolof embarqué est exactement celui que produit
 *      `npm run mobile:i18n` (pas de traduction recopiée à la main).
 *
 * La vérification « chaque chemin appelé par le mobile existe côté serveur »
 * vit dans `tests/smoke.ts` : elle a besoin d'une application complète, et une
 * suite unitaire ne démarre pas de base de données.
 *
 * Ce qui n'est PAS vérifié, et qui doit être fait sur un poste avec SDK :
 * `flutter analyze`, `flutter test`, `flutter build apk`. C'est écrit dans
 * `app/mobile/README.md` : tant que ce n'est pas exécuté, le code Dart n'est pas
 * « livré », il est « proposé ».
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '@xamoto/obd';
import { MESSAGES } from '@xamoto/shared';
import { renderWolofCatalogue } from '../../scripts/export-mobile-i18n.js';

const mobile = resolve(__dirname, '../../app/mobile');
const read = (path: string): string => readFileSync(resolve(mobile, path), 'utf8');

/** Extrait les littéraux `/api/...` d'un fichier Dart. */
function apiPaths(source: string): string[] {
  const matches = source.match(/'(\/api\/[^']*)'/g) ?? [];
  return [...new Set(matches.map((match) => match.slice(1, -1)))];
}

/** Extrait les littéraux Dart d'une constante donnée. */
function dartConst(source: string, name: string): string | null {
  const match = new RegExp(`(?:const|final)\\s+String\\s+${name}\\s*=\\s*\\n?\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'm').exec(source);
  if (!match) return null;
  return match[1]!.replace(/\\'/g, "'").replace(/\\n/g, '\n');
}

describe('contrat mobile ↔ serveur', () => {
  it('le projet Dart est complet (pubspec, analyse, écrans, noyau)', () => {
    for (const file of [
      'pubspec.yaml',
      'analysis_options.yaml',
      'lib/main.dart',
      'lib/app.dart',
      'lib/routes.dart',
      'lib/api/endpoints.dart',
      'lib/core/levels.dart',
      'lib/core/data_origin.dart',
      'lib/core/disclaimer.dart',
      'lib/core/format.dart',
      'lib/obd/pid_decoder.dart',
      'lib/obd/elm327.dart',
      'lib/obd/dtc_reader.dart',
      'lib/obd/scan_session.dart',
      'lib/obd/simulator.dart',
      'lib/storage/local_db.dart',
      'lib/storage/repositories.dart',
      'lib/storage/sync_queue.dart',
      'lib/state/app_state.dart',
      'lib/state/sync_service.dart',
      'lib/i18n/catalogue.g.dart',
    ]) {
      expect(existsSync(resolve(mobile, file)), `fichier manquant : ${file}`).toBe(true);
    }
    // Le wolof n'est pas embarqué à la main : le catalogue est généré.
    expect(read('lib/i18n/catalogue.g.dart')).toContain('GÉNÉRÉ — NE PAS MODIFIER À LA MAIN');
  });

  it('le mobile construit ses chemins à partir des constantes, pas de littéraux dispersés', () => {
    const endpoints = read('lib/api/endpoints.dart');
    // Les écrans et l'état ne réécrivent pas un chemin complet à la main.
    for (const file of [
      'lib/state/app_state.dart',
      'lib/state/sync_service.dart',
      'lib/screens/guided_tests_screen.dart',
      'lib/screens/assistant_screen.dart',
      'lib/screens/quotes_screen.dart',
      'lib/screens/post_repair_screen.dart',
      'lib/screens/second_opinion_screen.dart',
      'lib/screens/inspection_screen.dart',
      'lib/screens/alerts_screen.dart',
    ]) {
      const literal = apiPaths(read(file)).filter((path) => !path.includes(':'));
      expect(literal, `${file} réécrit un chemin complet : ${literal.join(', ')}`).toHaveLength(0);
    }
    expect(endpoints).toContain('static const List<String> all');
  });

  it('chaque écran déclaré existe et est branché dans la navigation', () => {
    const routes = read('lib/routes.dart');
    const app = read('lib/app.dart');
    // Les clés de `screens` sont des identifiants (`home`, `vehicles`, …) : la
    // route se lit dans la constante correspondante, le fichier dans la valeur.
    const entries = [...routes.matchAll(/(\w+):\s*'(screens\/[a-z_]+\.dart)'/g)].map((match) => ({ route: match[1]!, file: match[2]! }));
    expect(entries.length).toBeGreaterThanOrEqual(12);

    for (const entry of entries) {
      expect(existsSync(resolve(mobile, 'lib', entry.file)), `écran manquant : ${entry.file}`).toBe(true);
      // Chaque écran déclaré est branché dans `app.dart` via sa constante de route.
      expect(app, `écran non branché : ${entry.route}`).toMatch(new RegExp(`Routes\\.${entry.route}\\b`));
    }
  });

  it('les phrases exigées sont identiques à celles du reste du produit (§16)', () => {
    const disclaimer = read('lib/core/disclaimer.dart');
    const pairs: Array<[string, string]> = [
      ['kInsufficientDataFr', MESSAGES.insufficientDataFr],
      ['kInsufficientDataEn', MESSAGES.insufficientDataEn],
      ['kSeveralCausesFr', MESSAGES.severalCausesFr],
      ['kSeveralCausesEn', MESSAGES.severalCausesEn],
      ['kTestRequiredFr', MESSAGES.testRequiredFr],
      ['kTestRequiredEn', MESSAGES.testRequiredEn],
      ['kSimulationFr', MESSAGES.simulationFr],
      ['kSimulationEn', MESSAGES.simulationEn],
      ['kSimulationNoticeFr', MESSAGES.simulationNoticeFr],
      ['kSimulationNoticeEn', MESSAGES.simulationNoticeEn],
      ['kNoGuaranteeFr', MESSAGES.noGuaranteeFr],
      ['kNoGuaranteeEn', MESSAGES.noGuaranteeEn],
    ];
    for (const [constant, expected] of pairs) {
      const actual = dartConst(disclaimer, constant);
      expect(actual, `constante introuvable ou différente : ${constant}`).toBe(expected);
    }
  });

  it('le simulateur du mobile ne propose que des scénarios que le serveur connaît', () => {
    const source = read('lib/obd/simulator.dart');
    const block = /kSimulatorScenarioIds[^=]*=\s*<String>\[([\s\S]*?)\]/.exec(source);
    expect(block, 'liste des scénarios introuvable').not.toBeNull();
    const ids = [...block![1]!.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]!);
    const serverIds = SCENARIOS.map((scenario) => scenario.id);
    expect(ids).toEqual(serverIds);
  });

  it('aucun mot wolof n’est recopié dans le code Dart', () => {
    // Le catalogue est la seule source de wolof : un mot écrit ailleurs serait
    // une traduction non relue, exactement ce que le §47-7 interdit.
    const files = [
      'lib/screens/home_screen.dart',
      'lib/screens/scan_screen.dart',
      'lib/screens/diagnostic_screen.dart',
      'lib/i18n/strings.dart',
    ];
    const suspects = ['Kër', 'Baax', 'Saytu', 'Tàmbali', 'MANA DOON', 'DÉGGAL'];
    for (const file of files) {
      const source = read(file);
      for (const suspect of suspects) {
        expect(source.includes(suspect), `mot wolof en dur dans ${file} : ${suspect}`).toBe(false);
      }
    }
  });

  it('le catalogue wolof embarqué est exactement celui généré depuis le catalogue partagé', () => {
    expect(read('lib/i18n/catalogue.g.dart')).toBe(renderWolofCatalogue());
  });

  it('le mode de lecture locale est décrit côté serveur et côté mobile', () => {
    // La leçon du §7 : le mobile lit, le serveur calcule. Le mode `local` doit
    // exister des deux côtés, sinon l'un des deux mentirait sur l'autre.
    const scanRoute = readFileSync(resolve(__dirname, '../../backend/src/routes/scan.ts'), 'utf8');
    expect(scanRoute).toContain("'local'");
    const session = read('lib/obd/scan_session.dart');
    expect(session).toContain("'mode': 'local'");
    // Toute mesure transmise porte une provenance explicite, et aucune ne peut
    // être marquée « simulée » : le serveur refuse ce cas, le mobile ne l'écrit pas.
    expect(session).toContain("origin: 'measured'");
    expect(session.includes("origin: 'simulated'"), 'le mobile ne fabrique pas de donnée simulée locale').toBe(false);
  });
});
