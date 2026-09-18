/**
 * XAMOTO — Vérification statique du Dart, sans SDK Dart.
 *
 * Pourquoi ce fichier existe : cet environnement n'a pas de compilateur Dart
 * (`pub.dev` injoignable, aucun SDK installable), donc le code de `app/mobile`
 * n'est jamais compilé ici. Trois familles d'erreurs sont pourtant rattrapables
 * sans compilateur, et ce sont précisément celles qu'une relecture humaine rate :
 *
 *   1. un délimiteur oublié (`{`, `(`, `[`) — un fichier déséquilibré ne compile
 *      jamais, quelle que soit la qualité du reste ;
 *   2. un symbole inexistant (`Api.quoteAnalysis`, `Routes.inspection`) — le nom
 *      est écrit ailleurs, et une faute de frappe ne se voit pas à la lecture ;
 *   3. un import qui ne sert à rien (et, plus grave à l'inverse, un import qui
 *      manque : cela, seul `flutter analyze` peut le dire **complètement**).
 *
 * Ce que ce test n'est PAS : un compilateur. Il ne vérifie ni les types, ni la
 * nullabilité, ni les appels de méthodes. `flutter analyze`, `flutter test` et un
 * essai sur un appareil restent la seule preuve d'exécution — c'est écrit dans
 * `app/mobile/README.md` et dans `docs/09-tests.md`.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const MOBILE = resolve(__dirname, '../../app/mobile/lib');

/** Tous les fichiers `.dart` sous `lib/`, chemin relatif à `lib/`. */
function dartFiles(dir = MOBILE): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) found.push(...dartFiles(path));
    else if (entry.name.endsWith('.dart')) found.push(relative(MOBILE, path));
  }
  return found.sort();
}

/**
 * Retire commentaires et chaînes littérales.
 *
 * Indispensable pour compter les délimiteurs : une parenthèse dans un texte
 * affiché (« (démo) ») ou dans un commentaire ne doit pas compter. Les
 * interpolations `${…}` d'une chaîne sont donc ignorées elles aussi : c'est
 * pour cela que la recherche de symboles utilise en plus le texte brut.
 */
function stripCode(source: string): string {
  const out: string[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    const next = source[index + 1];
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
    } else if (char === '/' && next === '*') {
      index += 2;
      while (index + 1 < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 2;
    } else if (char === "'" || char === '"') {
      const triple = source.startsWith(char.repeat(3), index);
      const quote = triple ? char.repeat(3) : char;
      index += quote.length;
      while (index < source.length) {
        if (source.startsWith(quote, index)) {
          index += quote.length;
          break;
        }
        index += source[index] === '\\' ? 2 : 1;
      }
    } else {
      out.push(char);
      index += 1;
    }
  }
  return out.join('');
}

/** Noms déclarés au premier niveau : classes, énumérations, fonctions, constantes. */
function declaredNames(source: string): Set<string> {
  const patterns = [
    /^\s*(?:abstract\s+)?(?:interface\s+)?(?:base\s+)?(?:final\s+)?class\s+(\w+)/gm,
    /^\s*(?:abstract\s+)?(?:interface\s+)?(?:base\s+)?(?:final\s+)?mixin\s+(\w+)/gm,
    /^\s*enum\s+(\w+)/gm,
    /^\s*typedef\s+(\w+)/gm,
    /^\s*extension\s+(\w+)/gm,
    /^\s*(?:const|final)\s+[\w<>, ?]+\s+(\w+)\s*=/gm,
    /^\s*(?:String|int|double|bool|void|DateTime|List<[\w<>]+>|Map<[\w<>, ]+>)\s+(\w+)\s*\(/gm,
  ];
  const names = new Set<string>();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) names.add(match[1]!);
  }
  return names;
}

const files = dartFiles();
const read = (file: string): string => readFileSync(resolve(MOBILE, file), 'utf8');

/**
 * Imports inutilisés connus, antérieurs à ce contrôle.
 *
 * Ils ne cassent rien (l'analyseur les signale comme avertissements) : ils sont
 * donc **listés** plutôt que supprimés à l'aveugle. Le test échoue si un NOUVEAU
 * import inutilisé apparaît, ce qui empêche la dette de grossir. Le jour où
 * `flutter analyze` tourne sur un poste équipé, cette liste doit devenir vide.
 */
const KNOWN_UNUSED_IMPORTS = [
  'screens/guided_tests_screen.dart → ../api/api_client.dart',
  'screens/maintenance_screen.dart → ../widgets/badges.dart',
  'screens/vehicles_screen.dart → ../api/models/vehicle.dart',
];

describe('Dart : vérifications possibles sans SDK', () => {
  it('chaque fichier a des délimiteurs équilibrés', () => {
    const broken: string[] = [];
    for (const file of files) {
      const code = stripCode(read(file));
      for (const [open, close] of [
        ['(', ')'],
        ['[', ']'],
        ['{', '}'],
      ] as Array<[string, string]>) {
        const opens = code.split(open).length - 1;
        const closes = code.split(close).length - 1;
        if (opens !== closes) broken.push(`${file} : ${opens} ${open} vs ${closes} ${close}`);
      }
    }
    expect(files.length).toBeGreaterThanOrEqual(50);
    expect(broken, broken.join('\n')).toHaveLength(0);
  });

  it('tout symbole Api.x ou Routes.x utilisé existe réellement', () => {
    const endpoints = read('api/endpoints.dart');
    const routes = read('routes.dart');
    const apiNames = new Set([
      ...[...endpoints.matchAll(/static const String (\w+)/g)].map((match) => match[1]!),
      ...[...endpoints.matchAll(/static String (\w+)\(/g)].map((match) => match[1]!),
    ]);
    const routeNames = new Set([...routes.matchAll(/static const String (\w+)/g)].map((match) => match[1]!));

    const unknown: string[] = [];
    for (const file of files) {
      const code = read(file);
      for (const match of code.matchAll(/\bApi\.(\w+)/g)) {
        if (!apiNames.has(match[1]!)) unknown.push(`${file} : Api.${match[1]}`);
      }
      for (const match of code.matchAll(/\bRoutes\.(\w+)/g)) {
        if (!routeNames.has(match[1]!)) unknown.push(`${file} : Routes.${match[1]}`);
      }
    }
    expect(apiNames.size).toBeGreaterThanOrEqual(45);
    expect(unknown, unknown.join('\n')).toHaveLength(0);
  });

  it('aucun import inutilisé nouveau, aucun import cassé', () => {
    const missing: string[] = [];
    const unused: string[] = [];
    for (const file of files) {
      const source = read(file);
      const withoutImports = source.replace(/^\s*import .*$/gm, '');
      for (const match of source.matchAll(/import '([^']+)'/g)) {
        const target = match[1]!;
        if (target.startsWith('dart:') || target.startsWith('package:')) continue;
        const targetPath = resolve(dirname(resolve(MOBILE, file)), target);
        if (!existsSync(targetPath)) {
          missing.push(`${file} → ${target}`);
          continue;
        }
        const names = declaredNames(readFileSync(targetPath, 'utf8'));
        if (names.size === 0) continue;
        const used = [...names].some((name) => new RegExp(`\\b${name}\\b`).test(withoutImports));
        // Le texte BRUT est utilisé ici (et non le code nettoyé) : un symbole cité
        // dans une interpolation de chaîne (`'${formatDate(x)}'`) est bien utilisé.
        if (!used) unused.push(`${file} → ${target}`);
      }
    }
    expect(missing, missing.join('\n')).toHaveLength(0);
    expect(unused.sort(), 'liste des imports inutilisés (connus + nouveaux)').toEqual(KNOWN_UNUSED_IMPORTS);
  });
});
