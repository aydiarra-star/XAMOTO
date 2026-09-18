/**
 * XAMOTO — Multilingue (§40).
 *
 * Français par défaut, anglais disponible, et repères en WOLOF là où le
 * cahier des charges le demande (messages de sécurité et de diagnostic).
 * Le wolof n'est jamais une traduction automatique : seules des formulations
 * relues sont affichées.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  LOCALES,
  LOCALE_LABELS,
  isWolofDisplayable,
  normalizeLocale,
  wolofEntry,
  wolofEntryForFrench,
  wolofReport,
  type Locale,
  type WolofReport,
} from '@xamoto/shared';
import { getStoredLocale, setStoredLocale } from './api';

export type { Locale };

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /**
   * Traduit un texte. En wolof, le texte n'est renvoyé que s'il figure au
   * catalogue partagé ET qu'il n'est pas une consigne de sécurité en attente de
   * relecture ; sinon le français (langue de référence) est affiché et
   * l'interface signale l'état de la traduction (§40, §41).
   */
  t: (fr: string, en: string) => string;
  /** État réel de la langue wolof : ce qui est traduit, ce qui reste en français. */
  wolof: WolofReport;
  /** Vrai si le texte affiché provient du repli français en mode wolof. */
  isFallback: (fr: string) => boolean;
}

export { LOCALES, LOCALE_LABELS };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale());

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale: (next: Locale) => {
        setLocaleState(next);
        setStoredLocale(next);
      },
      t: (fr, en) => {
        if (locale === 'fr') return fr;
        if (locale === 'en') return en;
        // Wolof : uniquement une entrée enregistrée et affichable.
        const entry = wolofEntryForFrench(fr);
        return entry && isWolofDisplayable(entry) ? entry.wo : fr;
      },
      wolof: wolofReport(),
      isFallback: (fr) => {
        if (locale !== 'wo') return false;
        const entry = wolofEntryForFrench(fr);
        return !entry || !isWolofDisplayable(entry);
      },
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n doit être utilisé dans I18nProvider');
  return context;
}

/* ───────────────────────── Libellés normalisés (§10, §11, §33) ───────────── */

/**
 * Version wolof d'un libellé du catalogue. Renvoie une chaîne vide si la
 * traduction n'est pas affichable : l'appelant ne présente alors pas de faux
 * libellé wolof, il retombe sur le français.
 */
function woLabel(key: string): string {
  const entry = wolofEntry(key);
  return entry && isWolofDisplayable(entry) ? entry.wo : '';
}

/** Rend un libellé dans la langue active, avec repli explicite sur le français. */
export function labelText(entry: { fr: string; en: string; wo?: string }, locale: Locale): string {
  if (locale === 'en') return entry.en;
  if (locale === 'wo') return entry.wo && entry.wo.trim().length > 0 ? entry.wo : entry.fr;
  return entry.fr;
}

/**
 * Lecture d'un libellé traduit par clé libre. Renvoie toujours un libellé :
 * une clé inattendue ne doit jamais afficher « undefined » à l'utilisateur.
 */
export function labelOf<T extends { fr: string; en: string }>(
  map: Record<string, T>,
  key: string | null | undefined,
  fallback: T,
): T {
  if (!key) return fallback;
  return (map[key] as T | undefined) ?? fallback;
}

/** Version « courte » : la chaîne traduite, jamais vide. */
export function pickLabel<T extends { fr: string; en: string; wo?: string }>(
  map: Record<string, T>,
  key: string | null | undefined,
  locale: Locale,
  fallback: T,
): string {
  return labelText(labelOf(map, key, fallback), locale);
}

export const CERTAINTY_LABELS: Record<string, { fr: string; en: string; wo: string; color: string; help: string }> = {
  confirmed: {
    fr: 'CONFIRMÉ',
    en: 'CONFIRMED',
    wo: woLabel('certainty.confirmed'),
    color: '#16a34a',
    help: 'Une mesure ou un test réalisé sur le véhicule le confirme.',
  },
  strongly_compatible: {
    fr: 'FORTEMENT COMPATIBLE',
    en: 'STRONGLY COMPATIBLE',
    wo: woLabel('certainty.strongly_compatible'),
    color: '#0284c7',
    help: 'Les données vont clairement dans ce sens, mais un test reste nécessaire.',
  },
  possible: {
    fr: 'POSSIBLE',
    en: 'POSSIBLE',
    wo: woLabel('certainty.possible'),
    color: '#ca8a04',
    help: 'Cause plausible : d’autres causes restent possibles.',
  },
  undeterminable: {
    fr: 'INDÉTERMINABLE',
    en: 'UNDETERMINABLE',
    wo: woLabel('certainty.undeterminable'),
    color: '#64748b',
    help: 'Les données ne permettent pas de trancher.',
  },
  unavailable: {
    fr: 'NON DISPONIBLE',
    en: 'NOT AVAILABLE',
    wo: woLabel('certainty.unavailable'),
    color: '#475569',
    help: 'XAMOTO ne dispose pas de cette donnée pour ce véhicule.',
  },
};

export const SAFETY_LABELS: Record<string, { fr: string; en: string; wo: string; icon: string; color: string }> = {
  // Mots de niveau = consignes de sécurité : tant qu'aucun locuteur natif ne les
  // a relus, `woLabel` renvoie une chaîne vide et le français s'affiche — le
  // bandeau de langue explique pourquoi.
  normal: { fr: 'NORMAL', en: 'NORMAL', wo: woLabel('safety.normal'), icon: '🟢', color: '#22c55e' },
  attention: { fr: 'ATTENTION', en: 'CAUTION', wo: woLabel('safety.attention'), icon: '🟡', color: '#eab308' },
  important: { fr: 'IMPORTANT', en: 'IMPORTANT', wo: woLabel('safety.important'), icon: '🟠', color: '#f97316' },
  critical: { fr: 'CRITIQUE', en: 'CRITICAL', wo: woLabel('safety.critical'), icon: '🔴', color: '#ef4444' },
};

export const ORIGIN_LABELS: Record<string, { fr: string; en: string; wo: string }> = {
  measured: { fr: 'Mesuré', en: 'Measured', wo: woLabel('origin.measured') },
  documented: { fr: 'Documenté', en: 'Documented', wo: woLabel('origin.documented') },
  calculated: { fr: 'Calculé', en: 'Calculated', wo: woLabel('origin.calculated') },
  estimated: { fr: 'Estimé', en: 'Estimated', wo: woLabel('origin.estimated') },
  simulated: { fr: 'Simulé', en: 'Simulated', wo: woLabel('origin.simulated') },
  unknown: { fr: 'Inconnu', en: 'Unknown', wo: woLabel('origin.unknown') },
};

export const OUTCOME_LABELS: Record<string, { fr: string; en: string; wo: string }> = {
  ok: { fr: 'Conforme', en: 'Within range', wo: woLabel('outcome.ok') },
  out_of_range: { fr: 'Hors plage', en: 'Out of range', wo: woLabel('outcome.out_of_range') },
  // Sans entrée au catalogue, la chaîne est vide : le français est affiché.
  intermittent: { fr: 'Intermittent', en: 'Intermittent', wo: '' },
  not_testable: { fr: 'Non testable', en: 'Not testable', wo: '' },
  no_signal: { fr: 'Aucun signal', en: 'No signal', wo: '' },
  visual_damage: { fr: 'Dommage visible', en: 'Visible damage', wo: '' },
  other: { fr: 'Autre', en: 'Other', wo: '' },
};

export const STATUS_LABELS: Record<string, { fr: string; en: string; wo: string }> = {
  proposed: { fr: 'Proposé', en: 'Proposed', wo: '' },
  accepted: { fr: 'Accepté', en: 'Accepted', wo: '' },
  done: { fr: 'Réalisé', en: 'Done', wo: '' },
  skipped: { fr: 'Non réalisable', en: 'Skipped', wo: '' },
  ok: { fr: 'À jour', en: 'Up to date', wo: woLabel('status.ok') },
  due_soon: { fr: 'À prévoir', en: 'Due soon', wo: '' },
  overdue: { fr: 'En retard', en: 'Overdue', wo: woLabel('status.overdue') },
  unknown: { fr: 'Inconnu', en: 'Unknown', wo: '' },
  running: { fr: 'En cours', en: 'Running', wo: '' },
  completed: { fr: 'Terminé', en: 'Completed', wo: '' },
  failed: { fr: 'Échec', en: 'Failed', wo: '' },
};
