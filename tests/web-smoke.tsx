/**
 * XAMOTO — Vérification de rendu de l'interface web.
 *
 * Objectif : garantir qu'AUCUN écran de l'application web ne plante au premier
 * rendu (imports, contextes, accès à des données absentes). Le rendu est fait
 * hors navigateur, sans effets : c'est donc le pire cas qui est testé — celui
 * d'un utilisateur sans véhicule et sans données chargées.
 *
 * Exécution : npx tsx tests/web-smoke.tsx
 */
import { createElement, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider, labelText, useI18n, CERTAINTY_LABELS, SAFETY_LABELS } from '../app/web/src/i18n';
import { CertaintyBadge, SafetyBadge } from '../app/web/src/components';
import { AuthProvider } from '../app/web/src/auth';
import { VehicleProvider } from '../app/web/src/vehicle-context';
import LoginScreen from '../app/web/src/screens/Login';
import HomeScreen from '../app/web/src/screens/Home';
import VehiclesScreen from '../app/web/src/screens/Vehicles';
import VehicleDetailScreen from '../app/web/src/screens/VehicleDetail';
import ScanScreen from '../app/web/src/screens/Scan';
import DiagnosticScreen from '../app/web/src/screens/Diagnostic';
import CanIDriveScreen from '../app/web/src/screens/CanIDrive';
import GuidedTestsScreen from '../app/web/src/screens/GuidedTests';
import AssistantScreen from '../app/web/src/screens/Assistant';
import PostRepairScreen from '../app/web/src/screens/PostRepair';
import SecondOpinionScreen from '../app/web/src/screens/SecondOpinion';
import MaintenanceScreen from '../app/web/src/screens/Maintenance';
import InspectionScreen from '../app/web/src/screens/Inspection';
import ReportScreen from '../app/web/src/screens/Report';
import GaragesScreen from '../app/web/src/screens/Garages';
import AlertsScreen from '../app/web/src/screens/Alerts';

/* ── Environnement minimal (pas de navigateur disponible) ─────────────────── */
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
  location: { pathname: '/', origin: 'http://localhost:3000' },
  addEventListener: () => undefined,
  matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
};

const screens: Array<[string, ComponentType]> = [
  ['Login', LoginScreen],
  ['Home', HomeScreen],
  ['Vehicles', VehiclesScreen],
  ['VehicleDetail', VehicleDetailScreen],
  ['Scan', ScanScreen],
  ['Diagnostic', DiagnosticScreen],
  ['CanIDrive', CanIDriveScreen],
  ['GuidedTests', GuidedTestsScreen],
  ['Assistant', AssistantScreen],
  ['PostRepair', PostRepairScreen],
  ['SecondOpinion', SecondOpinionScreen],
  ['Maintenance', MaintenanceScreen],
  ['Inspection', InspectionScreen],
  ['Report', ReportScreen],
  ['Garages', GaragesScreen],
  ['Alerts', AlertsScreen],
];

/** Routes nécessitant un paramètre (`:id`) : l'écran doit gérer une route vide. */
const routes: Record<string, string> = {
  VehicleDetail: '/vehicles/veh_test',
  Diagnostic: '/diagnostics/diag_test',
  CanIDrive: '/diagnostics/diag_test/rouler',
  GuidedTests: '/diagnostics/diag_test/tests',
  Report: '/reports/diag_test',
};

const failures: string[] = [];
let checked = 0;

for (const [name, Screen] of screens) {
  try {
    const html = renderToString(
      createElement(
        I18nProvider,
        null,
        createElement(
          AuthProvider,
          null,
          createElement(
            VehicleProvider,
            null,
            createElement(MemoryRouter, { initialEntries: [routes[name] ?? '/'] }, createElement(Screen)),
          ),
        ),
      ),
    );
    checked += 1;
    if (html.trim().length < 20) throw new Error('rendu vide');
    process.stdout.write(`✔ Écran ${name} rendu (${html.length} caractères)\n`);
  } catch (error) {
    failures.push(`${name} : ${(error as Error).message}`);
    process.stdout.write(`✘ Écran ${name} — ${(error as Error).message}\n`);
  }
}

/* ── Multilingue : ce qui est affiché en wolof, et ce qui ne l'est pas ───── */

/**
 * Sonde de langue : elle rend exactement ce que l'utilisateur verrait si sa
 * langue était le wolof. Elle vérifie deux choses opposées :
 *   - un libellé relu (ou provisoire mais non critique) s'affiche en wolof ;
 *   - une consigne de sécurité non relue s'affiche en FRANÇAIS, jamais dans un
 *     wolof approximatif.
 */
function LocaleProbe(): JSX.Element {
  const { t, locale, wolof } = useI18n();
  return createElement(
    'div',
    null,
    createElement('span', { id: 'locale' }, locale),
    createElement('span', { id: 'nav' }, t('Accueil', 'Home')),
    createElement('span', { id: 'notice' }, locale === 'wo' ? wolof.noticeFr : ''),
    createElement(SafetyBadge, { level: 'critical' }),
    createElement(CertaintyBadge, { level: 'unavailable' }),
  );
}

store.set('xamoto.locale', 'wo');
const wolofHtml = renderToString(createElement(I18nProvider, null, createElement(LocaleProbe)));
store.delete('xamoto.locale');

const expectations: Array<[string, boolean, string]> = [
  ['Le wolof est la langue active', wolofHtml.includes('>wo<'), 'locale'],
  ['Un libellé du catalogue s’affiche en wolof', wolofHtml.includes('Kër gi'), 'nav.home'],
  ['Le bandeau annonce la relecture en cours', wolofHtml.includes('relecture'), 'wolofReport'],
  ['Une consigne de sécurité reste en français', wolofHtml.includes('CRITIQUE') && !wolofHtml.includes('NORMAL'), 'safety.critical'],
  ['Un libellé non critique passe en wolof', wolofHtml.includes('AMUL'), 'certainty.unavailable'],
  [
    'Aucun mot wolof n’est fabriqué pour la sécurité',
    labelText(SAFETY_LABELS.critical!, 'wo') === 'CRITIQUE' && labelText(CERTAINTY_LABELS.unavailable!, 'wo') === 'AMUL',
    'labelText',
  ],
];

process.stdout.write('\nLangue wolof :\n');
for (const [label, ok, detail] of expectations) {
  if (ok) {
    checked += 1;
    process.stdout.write(`✔ ${label} — ${detail}\n`);
  } else {
    failures.push(`${label} (${detail})`);
    process.stdout.write(`✘ ${label} — ${detail}\n`);
  }
}

process.stdout.write(`\n=== ${checked}/${screens.length + expectations.length} vérifications de rendu réussies (${screens.length} écrans + ${expectations.length} contrôles de langue) ===\n`);
if (failures.length > 0) {
  process.stdout.write(`\nÉchecs :\n${failures.map((failure) => `  ✘ ${failure}`).join('\n')}\n`);
  process.exitCode = 1;
}
