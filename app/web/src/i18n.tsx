/**
 * XAMOTO — Multilingue (§40).
 *
 * Français par défaut, anglais disponible, et repères en WOLOF là où le
 * cahier des charges le demande (messages de sécurité et de diagnostic).
 * Le wolof n'est jamais une traduction automatique : seules des formulations
 * relues sont affichées.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { getStoredLocale, setStoredLocale } from './api';

export type Locale = 'fr' | 'en';

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (fr: string, en: string, wo?: string) => string;
}

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
      t: (fr, en, wo) => {
        if (locale === 'fr') return fr;
        return en;
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

export const CERTAINTY_LABELS: Record<string, { fr: string; en: string; wo: string; color: string; help: string }> = {
  confirmed: {
    fr: 'CONFIRMÉ',
    en: 'CONFIRMED',
    wo: 'DÉGGÓÓ',
    color: '#16a34a',
    help: 'Une mesure ou un test réalisé sur le véhicule le confirme.',
  },
  strongly_compatible: {
    fr: 'FORTEMENT COMPATIBLE',
    en: 'STRONGLY COMPATIBLE',
    wo: 'YU BÉPP MOO DÉGGÓÓ',
    color: '#0284c7',
    help: 'Les données vont clairement dans ce sens, mais un test reste nécessaire.',
  },
  possible: {
    fr: 'POSSIBLE',
    en: 'POSSIBLE',
    wo: 'MANA DOON',
    color: '#ca8a04',
    help: 'Cause plausible : d’autres causes restent possibles.',
  },
  undeterminable: {
    fr: 'INDÉTERMINABLE',
    en: 'UNDETERMINABLE',
    wo: 'MANU KO XAM',
    color: '#64748b',
    help: 'Les données ne permettent pas de trancher.',
  },
  unavailable: {
    fr: 'NON DISPONIBLE',
    en: 'NOT AVAILABLE',
    wo: 'AMUL',
    color: '#475569',
    help: 'XAMOTO ne dispose pas de cette donnée pour ce véhicule.',
  },
};

export const SAFETY_LABELS: Record<string, { fr: string; en: string; icon: string; color: string }> = {
  normal: { fr: 'NORMAL', en: 'NORMAL', icon: '🟢', color: '#22c55e' },
  attention: { fr: 'ATTENTION', en: 'CAUTION', icon: '🟡', color: '#eab308' },
  important: { fr: 'IMPORTANT', en: 'IMPORTANT', icon: '🟠', color: '#f97316' },
  critical: { fr: 'CRITIQUE', en: 'CRITICAL', icon: '🔴', color: '#ef4444' },
};

export const ORIGIN_LABELS: Record<string, { fr: string; en: string }> = {
  measured: { fr: 'Mesuré', en: 'Measured' },
  documented: { fr: 'Documenté', en: 'Documented' },
  calculated: { fr: 'Calculé', en: 'Calculated' },
  estimated: { fr: 'Estimé', en: 'Estimated' },
  simulated: { fr: 'Simulé', en: 'Simulated' },
  unknown: { fr: 'Inconnu', en: 'Unknown' },
};

export const OUTCOME_LABELS: Record<string, { fr: string; en: string }> = {
  ok: { fr: 'Conforme', en: 'Within range' },
  out_of_range: { fr: 'Hors plage', en: 'Out of range' },
  intermittent: { fr: 'Intermittent', en: 'Intermittent' },
  not_testable: { fr: 'Non testable', en: 'Not testable' },
  no_signal: { fr: 'Aucun signal', en: 'No signal' },
  visual_damage: { fr: 'Dommage visible', en: 'Visible damage' },
  other: { fr: 'Autre', en: 'Other' },
};

export const STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  proposed: { fr: 'Proposé', en: 'Proposed' },
  accepted: { fr: 'Accepté', en: 'Accepted' },
  done: { fr: 'Réalisé', en: 'Done' },
  skipped: { fr: 'Non réalisable', en: 'Skipped' },
  ok: { fr: 'À jour', en: 'Up to date' },
  due_soon: { fr: 'À prévoir', en: 'Due soon' },
  overdue: { fr: 'En retard', en: 'Overdue' },
  unknown: { fr: 'Inconnu', en: 'Unknown' },
  running: { fr: 'En cours', en: 'Running' },
  completed: { fr: 'Terminé', en: 'Completed' },
  failed: { fr: 'Échec', en: 'Failed' },
};
