/**
 * XAMOTO — Langues et traductions (§40, §41).
 *
 * Le produit est annoncé multilingue (français, anglais, wolof). Une langue
 * n'est pas un décor : soit un texte existe réellement, soit XAMOTO le dit.
 *
 * Règles inscrites dans le code (et non dans une charte) :
 *
 * 1. **Aucune traduction automatique n'est affichée comme fiable.** Un texte
 *    wolof n'est montré que s'il figure dans ce catalogue, avec son statut.
 * 2. **Une consigne de sécurité n'est jamais traduite à l'aveugle.** Si une
 *    entrée est marquée `safetyCritical` et n'a pas été relue (`status` autre
 *    que `reviewed`), elle n'est PAS affichée en wolof : le français est montré,
 *    et l'interface le signale. Un mot approximatif sur le freinage ou la
 *    température moteur peut coûter cher.
 * 3. **Le repli est visible.** `wolofReport()` expose ce qui est relu, ce qui
 *    reste provisoire et ce qui manque : l'utilisateur et le traducteur savent
 *    exactement où en est la langue.
 *
 * Le catalogue est donc à la fois la table de traduction ET la liste de travail
 * des relecteurs.
 */

export const LOCALES = ['fr', 'en', 'wo'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  wo: 'Wolof',
};

/** Langue de référence : celle dans laquelle tous les textes sont rédigés. */
export const REFERENCE_LOCALE: Locale = 'fr';

export type WolofScope =
  /** Navigation, boutons, titres : un mot approximatif ne crée pas de risque. */
  | 'ui'
  /** Libellés normalisés (niveaux, origines, statuts) : affichés avec le statut. */
  | 'label'
  /** Consignes de sécurité, refus, avertissements : relecture obligatoire. */
  | 'safety';

export type WolofStatus =
  /** Relu par un locuteur natif nommé — affichable partout. */
  | 'reviewed'
  /** Proposition XAMOTO — affichable seulement si `safetyCritical === false`. */
  | 'draft';

export interface WolofEntry {
  /** Identifiant technique stable. */
  key: string;
  /** Texte français de référence : c'est la source de la traduction. */
  fr: string;
  /** Équivalent anglais, quand une interface anglaise doit l'afficher. */
  en: string;
  /** Proposition wolof. */
  wo: string;
  scope: WolofScope;
  status: WolofStatus;
  /** Nom du relecteur natif. Obligatoire dès que `status === 'reviewed'`. */
  reviewer: string | null;
  /** Précision utile au relecteur (contexte, ambiguïté possible). */
  note?: string;
}

/**
 * Catalogue. `safetyCritical` est dérivé de `scope` : c'est volontaire, pour
 * qu'on ne puisse pas marquer « dangereux » un texte en oubliant le drapeau.
 */
export const WOLOF_CATALOGUE: WolofEntry[] = [
  /* ─────────────────────────── Navigation et interface ─────────────────── */
  { key: 'nav.home', fr: 'Accueil', en: 'Home', wo: 'Kër gi', scope: 'ui', status: 'draft', reviewer: null },
  { key: 'nav.vehicles', fr: 'Véhicules', en: 'Vehicles', wo: 'Oto yi', scope: 'ui', status: 'draft', reviewer: null },
  { key: 'nav.diagnostic', fr: 'Diagnostic', en: 'Diagnosis', wo: 'Firiñe', scope: 'ui', status: 'draft', reviewer: null, note: 'Emprunt technique courant ; à confirmer.' },
  { key: 'nav.assistant', fr: 'Assistant', en: 'Assistant', wo: 'Jàngalekat', scope: 'ui', status: 'draft', reviewer: null },
  { key: 'nav.maintenance', fr: 'Entretien', en: 'Maintenance', wo: 'Saytu', scope: 'ui', status: 'draft', reviewer: null },
  { key: 'nav.garages', fr: 'Garages', en: 'Garages', wo: 'Garaz yi', scope: 'ui', status: 'draft', reviewer: null },
  { key: 'nav.reports', fr: 'Rapports', en: 'Reports', wo: 'Kayitu xibaar', scope: 'ui', status: 'draft', reviewer: null },
  { key: 'vehicle.car', fr: 'Voiture', en: 'Car', wo: 'Oto', scope: 'ui', status: 'draft', reviewer: null },
  { key: 'action.scan', fr: 'Lancer un scan', en: 'Start a scan', wo: 'Tàmbali scan bi', scope: 'ui', status: 'draft', reviewer: null },
  { key: 'simulation.mode', fr: 'MODE SIMULATION', en: 'SIMULATION MODE', wo: 'MODE SIMULATION', scope: 'ui', status: 'draft', reviewer: null, note: 'Mention technique : conservée telle quelle pour rester reconnaissable.' },

  /* ────────────────────────── Libellés normalisés (§10, §11, §33) ─────── */
  { key: 'certainty.confirmed', fr: 'CONFIRMÉ', en: 'CONFIRMED', wo: 'DÉGGAL NA', scope: 'label', status: 'draft', reviewer: null },
  { key: 'certainty.strongly_compatible', fr: 'FORTEMENT COMPATIBLE', en: 'STRONGLY COMPATIBLE', wo: 'DAÑU KO JÀPP', scope: 'label', status: 'draft', reviewer: null, note: 'Ancienne proposition « YU BÉPP MOO DÉGGÓÓ » écartée : le sens était inversé.' },
  { key: 'certainty.possible', fr: 'POSSIBLE', en: 'POSSIBLE', wo: 'MANA DOON', scope: 'label', status: 'draft', reviewer: null },
  { key: 'certainty.undeterminable', fr: 'INDÉTERMINABLE', en: 'UNDETERMINABLE', wo: 'MANU KO XAM', scope: 'label', status: 'draft', reviewer: null },
  { key: 'certainty.unavailable', fr: 'NON DISPONIBLE', en: 'NOT AVAILABLE', wo: 'AMUL', scope: 'label', status: 'draft', reviewer: null },
  { key: 'origin.measured', fr: 'Mesuré', en: 'Measured', wo: 'Natt na', scope: 'label', status: 'draft', reviewer: null },
  { key: 'origin.documented', fr: 'Documenté', en: 'Documented', wo: 'Ñu ko bind', scope: 'label', status: 'draft', reviewer: null },
  { key: 'origin.calculated', fr: 'Calculé', en: 'Calculated', wo: 'Ñu ko jàppe', scope: 'label', status: 'draft', reviewer: null },
  { key: 'origin.estimated', fr: 'Estimé', en: 'Estimated', wo: 'Ñu ko méngoo', scope: 'label', status: 'draft', reviewer: null },
  { key: 'origin.simulated', fr: 'Simulé', en: 'Simulated', wo: 'Simulation', scope: 'label', status: 'draft', reviewer: null },
  { key: 'origin.unknown', fr: 'Inconnu', en: 'Unknown', wo: 'Xamul', scope: 'label', status: 'draft', reviewer: null },
  { key: 'outcome.ok', fr: 'Conforme', en: 'Within range', wo: 'Baax na', scope: 'label', status: 'draft', reviewer: null },
  { key: 'outcome.out_of_range', fr: 'Hors plage', en: 'Out of range', wo: 'Mucc na', scope: 'label', status: 'draft', reviewer: null },
  { key: 'status.overdue', fr: 'En retard', en: 'Overdue', wo: 'Yeex na', scope: 'label', status: 'draft', reviewer: null },
  { key: 'status.ok', fr: 'À jour', en: 'Up to date', wo: 'Baax na', scope: 'label', status: 'draft', reviewer: null },

  /* ───────────────────────── Consignes de sécurité (§11, §12, §16) ─────── */
  {
    key: 'safety.critical',
    fr: 'CRITIQUE',
    en: 'CRITICAL',
    wo: '',
    scope: 'safety',
    status: 'draft',
    reviewer: null,
    note: 'Niveau 🔴. Un mot imprécis sur ce niveau peut faire rouler un véhicule en surchauffe.',
  },
  {
    key: 'safety.important',
    fr: 'IMPORTANT',
    en: 'IMPORTANT',
    wo: '',
    scope: 'safety',
    status: 'draft',
    reviewer: null,
  },
  {
    key: 'safety.attention',
    fr: 'ATTENTION',
    en: 'CAUTION',
    wo: '',
    scope: 'safety',
    status: 'draft',
    reviewer: null,
  },
  {
    key: 'safety.normal',
    fr: 'NORMAL',
    en: 'NORMAL',
    wo: '',
    scope: 'safety',
    status: 'draft',
    reviewer: null,
  },
  {
    key: 'drive.do_not_drive',
    fr: 'Il est déconseillé de continuer à rouler. Un contrôle s’impose avant de reprendre la route.',
    en: 'Continuing to drive is not advised. A check is required before driving on.',
    wo: '',
    scope: 'safety',
    status: 'draft',
    reviewer: null,
    note: 'Consigne de conduite : traduction obligatoirement relue avant affichage.',
  },
  {
    key: 'drive.drive_if_necessary',
    fr: 'Roulez uniquement si c’est nécessaire : trajets courts, à allure modérée, et faites contrôler le véhicule rapidement.',
    en: 'Drive only if necessary: short trips, moderate speed, and have the vehicle checked promptly.',
    wo: '',
    scope: 'safety',
    status: 'draft',
    reviewer: null,
  },
  {
    key: 'message.insufficient_data',
    fr: 'Je ne dispose pas de cette donnée pour votre véhicule.',
    en: 'I do not have this data for your vehicle.',
    wo: '',
    scope: 'safety',
    status: 'draft',
    reviewer: null,
    note: 'Phrase exigée par le §16 : traduction relue obligatoire.',
  },
  {
    key: 'message.no_guarantee',
    fr: 'XAMOTO fournit une aide au diagnostic : il ne remplace pas un professionnel et n’engage aucune garantie sur l’état du véhicule.',
    en: 'XAMOTO provides diagnostic assistance: it does not replace a professional and gives no guarantee on the vehicle condition.',
    wo: '',
    scope: 'safety',
    status: 'draft',
    reviewer: null,
  },
];

const BY_KEY = new Map(WOLOF_CATALOGUE.map((entry) => [entry.key, entry]));
const BY_FRENCH = new Map(WOLOF_CATALOGUE.map((entry) => [entry.fr, entry]));

export function wolofEntry(key: string): WolofEntry | undefined {
  return BY_KEY.get(key);
}

/** Retrouve l'entrée depuis le texte français (langue de référence). */
export function wolofEntryForFrench(french: string): WolofEntry | undefined {
  return BY_FRENCH.get(french);
}

/** Une consigne de sécurité exige une relecture ; un libellé, non. */
export function isSafetyCritical(entry: WolofEntry): boolean {
  return entry.scope === 'safety';
}

/**
 * Une entrée peut-elle être affichée en wolof ?
 * Une entrée relue : oui. Une proposition non relue : seulement si elle ne porte
 * aucune consigne de sécurité, et elle est affichée avec la mention de statut.
 */
export function isWolofDisplayable(entry: WolofEntry): boolean {
  if (!entry.wo.trim()) return false;
  if (entry.status === 'reviewed') return true;
  return !isSafetyCritical(entry);
}

/** Texte wolof utilisable pour cette clé, ou `null` s'il faut se rabattre. */
export function wolofText(key: string): string | null {
  const entry = BY_KEY.get(key);
  if (!entry || !isWolofDisplayable(entry)) return null;
  return entry.wo;
}

/** Reconnaît une langue demandée, avec repli sur la langue de référence. */
export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const short = value.toLowerCase().split(/[-_]/)[0];
  return (LOCALES as readonly string[]).includes(short ?? '') ? (short as Locale) : null;
}

/* ────────────────────────────── Rapport de langue ───────────────────────── */

export interface WolofReport {
  /** Nombre total d'entrées décrites. */
  total: number;
  /** Entrées effectivement affichables en wolof. */
  displayable: number;
  /** Entrées relues par un locuteur natif. */
  reviewed: number;
  /** Propositions XAMOTO en attente de relecture (libellés). */
  draftLabels: number;
  /** Textes de sécurité sans traduction : ils restent en français. */
  safetyPending: Array<{ key: string; fr: string }>;
  /** Le wolof est-il utilisable pour des consignes de sécurité aujourd'hui ? */
  safetyReady: boolean;
  noticeFr: string;
  noticeEn: string;
  noticeWo: string;
}

/**
 * État réel de la langue wolof. Sert à l'interface (mention affichée), à la
 * documentation et à la liste de travail des relecteurs natifs.
 */
export function wolofReport(): WolofReport {
  const reviewed = WOLOF_CATALOGUE.filter((entry) => entry.status === 'reviewed');
  const draftLabels = WOLOF_CATALOGUE.filter((entry) => entry.status === 'draft' && !isSafetyCritical(entry) && entry.wo.trim());
  const safetyPending = WOLOF_CATALOGUE.filter((entry) => isSafetyCritical(entry) && !isWolofDisplayable(entry)).map((entry) => ({
    key: entry.key,
    fr: entry.fr,
  }));
  const displayable = WOLOF_CATALOGUE.filter((entry) => isWolofDisplayable(entry)).length;
  const safetyReady = safetyPending.length === 0;

  return {
    total: WOLOF_CATALOGUE.length,
    displayable,
    reviewed: reviewed.length,
    draftLabels: draftLabels.length,
    safetyPending,
    safetyReady,
    noticeFr: safetyReady
      ? 'Traductions wolof relues : les consignes de sécurité s’affichent en wolof.'
      : `Version wolof partielle et en cours de relecture : ${displayable} libellés sont affichés en wolof, ${safetyPending.length} textes de sécurité restent en français. Aucune traduction automatique n’est utilisée.`,
    noticeEn: safetyReady
      ? 'Reviewed Wolof translations: safety instructions are displayed in Wolof.'
      : `Partial Wolof version, being reviewed: ${displayable} labels are shown in Wolof, ${safetyPending.length} safety texts remain in French. No machine translation is used.`,
    noticeWo: 'Wolof bi baaxul ba noppi : ñu koy saytu. Ñu ngi jàng ci farañse.',
  };
}

/** Mention courte affichée avec un texte provisoire (jamais pour une consigne). */
export const WOLOF_DRAFT_NOTICE = {
  fr: 'traduction en cours de relecture',
  en: 'translation under review',
  wo: 'ñu koy saytu',
} as const;

/**
 * Langue effective d'une réponse de l'assistant (§40).
 *
 * L'assistant ne traduit jamais ses propres phrases vers le wolof : une
 * explication technique rédigée automatiquement en wolof serait une invention.
 * Si la langue demandée est le wolof, la réponse est produite dans la langue de
 * référence (français) et un message explicite l'indique à l'utilisateur.
 */
export interface EffectiveLanguage {
  /** Langue demandée par l'utilisateur. */
  requested: Locale;
  /** Langue réellement utilisée pour rédiger la réponse. */
  effective: 'fr' | 'en';
  /** Vrai si l'on a dû s'écarter de la langue demandée. */
  fallback: boolean;
  noticeFr: string;
  noticeEn: string;
}

export function effectiveLanguage(requested: string | null | undefined): EffectiveLanguage {
  const locale = normalizeLocale(requested) ?? REFERENCE_LOCALE;
  if (locale === 'wo') {
    return {
      requested: 'wo',
      effective: REFERENCE_LOCALE === 'en' ? 'en' : 'fr',
      fallback: true,
      noticeFr:
        'Réponse rédigée en français : la version wolof des explications de diagnostic n’est pas encore relue par un locuteur natif. Le wolof est utilisé pour les libellés déjà validés.',
      noticeEn:
        'Answer written in French: the Wolof version of diagnostic explanations has not yet been reviewed by a native speaker. Wolof is used for the labels already validated.',
    };
  }
  return {
    requested: locale,
    effective: locale,
    fallback: false,
    noticeFr: '',
    noticeEn: '',
  };
}
