/**
 * XAMOTO — Niveaux normalisés.
 *
 * Ces énumérations sont la colonne vertébrale du produit (§10, §11, §16, §47).
 * Aucun module ne doit contourner ces niveaux ni en inventer d'autres.
 */

/** §10 — Niveau de certitude d'une conclusion. */
export const CERTAINTY_LEVELS = [
  'confirmed',
  'strongly_compatible',
  'possible',
  'undeterminable',
  'unavailable',
] as const;
export type CertaintyLevel = (typeof CERTAINTY_LEVELS)[number];

/** Ordre de force décroissant — sert au tri et à la comparaison. */
export const CERTAINTY_RANK: Record<CertaintyLevel, number> = {
  confirmed: 5,
  strongly_compatible: 4,
  possible: 3,
  undeterminable: 2,
  unavailable: 1,
};

export const CERTAINTY_LABELS: Record<CertaintyLevel, { fr: string; en: string; wo: string }> = {
  confirmed: {
    fr: 'CONFIRMÉ',
    en: 'CONFIRMED',
    wo: 'DÉGGÓÓ',
  },
  strongly_compatible: {
    fr: 'FORTEMENT COMPATIBLE',
    en: 'STRONGLY COMPATIBLE',
    wo: 'YU BÉPP MOO DÉGGÓÓ',
  },
  possible: {
    fr: 'POSSIBLE',
    en: 'POSSIBLE',
    wo: 'MANA DOON',
  },
  undeterminable: {
    fr: 'INDÉTERMINABLE',
    en: 'UNDETERMINABLE',
    wo: 'MANU KO XAM',
  },
  unavailable: {
    fr: 'NON DISPONIBLE',
    en: 'NOT AVAILABLE',
    wo: 'AMUL',
  },
};

/** §11 — Niveau de sécurité associé à un constat. */
export const SAFETY_LEVELS = ['normal', 'attention', 'important', 'critical'] as const;
export type SafetyLevel = (typeof SAFETY_LEVELS)[number];

export const SAFETY_RANK: Record<SafetyLevel, number> = {
  normal: 0,
  attention: 1,
  important: 2,
  critical: 3,
};

export const SAFETY_LABELS: Record<SafetyLevel, { fr: string; en: string; icon: string; color: string }> = {
  normal: { fr: 'NORMAL', en: 'NORMAL', icon: '🟢', color: '#22c55e' },
  attention: { fr: 'ATTENTION', en: 'CAUTION', icon: '🟡', color: '#eab308' },
  important: { fr: 'IMPORTANT', en: 'IMPORTANT', icon: '🟠', color: '#f97316' },
  critical: { fr: 'CRITIQUE', en: 'CRITICAL', icon: '🔴', color: '#ef4444' },
};

/** §33 — Provenance d'une donnée. */
export const DATA_ORIGINS = [
  'measured',
  'documented',
  'calculated',
  'estimated',
  'simulated',
  'unknown',
] as const;
export type DataOrigin = (typeof DATA_ORIGINS)[number];

export const DATA_ORIGIN_LABELS: Record<DataOrigin, { fr: string; en: string }> = {
  measured: { fr: 'Mesuré', en: 'Measured' },
  documented: { fr: 'Documenté', en: 'Documented' },
  calculated: { fr: 'Calculé', en: 'Calculated' },
  estimated: { fr: 'Estimé', en: 'Estimated' },
  simulated: { fr: 'Simulé', en: 'Simulated' },
  unknown: { fr: 'Inconnu', en: 'Unknown' },
};

/** §15 — Fiabilité d'une source documentaire. */
export const SOURCE_RELIABILITY = ['official', 'licensed', 'technical', 'community', 'xamoto'] as const;
export type SourceReliability = (typeof SOURCE_RELIABILITY)[number];

export const SOURCE_RELIABILITY_LABELS: Record<SourceReliability, { fr: string; en: string }> = {
  official: { fr: 'Constructeur / officiel', en: 'OEM / official' },
  licensed: { fr: 'Base sous licence', en: 'Licensed database' },
  technical: { fr: 'Documentation technique', en: 'Technical documentation' },
  community: { fr: 'Communauté (à vérifier)', en: 'Community (to verify)' },
  xamoto: { fr: 'Validé par XAMOTO', en: 'Validated by XAMOTO' },
};

/** §36 — Rôles et permissions. */
export const ROLES = ['user', 'technician', 'garage', 'fleet_manager', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, { fr: string; en: string }> = {
  user: { fr: 'Utilisateur', en: 'User' },
  technician: { fr: 'Technicien', en: 'Technician' },
  garage: { fr: 'Garage', en: 'Garage' },
  fleet_manager: { fr: 'Gestionnaire de flotte', en: 'Fleet manager' },
  admin: { fr: 'Administrateur', en: 'Administrator' },
};

/**
 * Trie des constats du plus grave au moins grave.
 * Utilisé partout : liste de défauts, rapport, « Puis-je rouler ? ».
 */
export function worstSafety(levels: SafetyLevel[]): SafetyLevel {
  return levels.reduce<SafetyLevel>(
    (worst, current) => (SAFETY_RANK[current] > SAFETY_RANK[worst] ? current : worst),
    'normal',
  );
}

/** Le niveau de certitude le plus faible d'un lot (règle de prudence). */
export function weakestCertainty(levels: CertaintyLevel[]): CertaintyLevel {
  return levels.reduce<CertaintyLevel>(
    (weakest, current) => (CERTAINTY_RANK[current] < CERTAINTY_RANK[weakest] ? current : weakest),
    'confirmed',
  );
}

export function safetyAtLeast(level: SafetyLevel, threshold: SafetyLevel): boolean {
  return SAFETY_RANK[level] >= SAFETY_RANK[threshold];
}
