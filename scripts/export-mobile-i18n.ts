/**
 * XAMOTO — Génération du catalogue wolof de l'application mobile (Flutter).
 *
 * Le catalogue vit dans `shared/src/i18n.ts` : c'est là que la relecture a lieu,
 * là que le statut d'une traduction est décidé. L'application Dart consomme ce
 * catalogue, mais elle ne doit pas le RECOPIER — une liste recopiée finit par
 * diverger, et une divergence sur un texte de sécurité est inacceptable.
 *
 * Ce script produit donc `app/mobile/lib/i18n/catalogue.g.dart`, et
 * `tools/test/mobile_contract.test.ts` échoue si le fichier livré n'est plus
 * exactement celui que produit ce script.
 *
 * Exécution : npm run mobile:i18n
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { WOLOF_CATALOGUE } from '../shared/src/i18n.js';

const OUTPUT = resolve(import.meta.dirname, '../app/mobile/lib/i18n/catalogue.g.dart');

/** Échappe une chaîne pour un littéral Dart entre apostrophes. */
function dart(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')}'`;
}

function entry(scope: string, status: string): string {
  const scopeName = { ui: 'WolofScope.ui', label: 'WolofScope.label', safety: 'WolofScope.safety' }[scope];
  const statusName = { reviewed: 'WolofStatus.reviewed', draft: 'WolofStatus.draft' }[status];
  if (!scopeName || !statusName) throw new Error(`portée ou statut inconnu : ${scope}/${status}`);
  return `${scopeName}, ${statusName}`;
}

export function renderWolofCatalogue(): string {
  const rows = WOLOF_CATALOGUE.map((item) => {
    const [scope, status] = entry(item.scope, item.status).split(', ');
    const parts = [
      `key: ${dart(item.key)}`,
      `fr: ${dart(item.fr)}`,
      `en: ${dart(item.en)}`,
      `wo: ${dart(item.wo)}`,
      `scope: ${scope}`,
      `status: ${status}`,
      `reviewer: ${item.reviewer === null ? 'null' : dart(item.reviewer)}`,
    ];
    if (item.note !== undefined) parts.push(`note: ${dart(item.note)}`);
    return `  WolofEntry(\n    ${parts.join(',\n    ')},\n  ),`;
  });

  return `// GÉNÉRÉ — NE PAS MODIFIER À LA MAIN.
// Source : shared/src/i18n.ts (catalogue relu par des locuteurs natifs).
// Régénération : npm run mobile:i18n
//
// Règle inscrite dans le code : une entrée \`safety\` non relue (status != reviewed)
// n'est JAMAIS affichée en wolof. Le repli français est expliqué à l'utilisateur.

import 'catalogue_entry.dart';

const List<WolofEntry> kWolofCatalogue = <WolofEntry>[
${rows.join('\n')}
];
`;
}

/* Exécution directe : écrit le fichier. */
const invokedDirectly = process.argv[1]?.endsWith('export-mobile-i18n.ts') ?? false;
if (invokedDirectly) {
  const content = renderWolofCatalogue();
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, content, 'utf8');
  console.log(`\n✔ ${OUTPUT}`);
  console.log(`  entrées wolof : ${WOLOF_CATALOGUE.length}`);
  console.log(`  dont sécurité : ${WOLOF_CATALOGUE.filter((item) => item.scope === 'safety').length} (aucune affichable sans relecture)`);
}
