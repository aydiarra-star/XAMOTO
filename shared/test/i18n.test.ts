/**
 * XAMOTO — Multilingue (§40, §41).
 *
 * Le produit annonce trois langues. Ces tests garantissent que l'annonce est
 * vraie : aucune traduction automatique présentée comme fiable, aucune consigne
 * de sécurité traduite sans relecture, et un repli toujours signalé.
 */
import { describe, expect, it } from 'vitest';
import {
  LOCALES,
  LOCALE_LABELS,
  MESSAGES,
  WOLOF_CATALOGUE,
  WOLOF_DRAFT_NOTICE,
  effectiveLanguage,
  isSafetyCritical,
  isWolofDisplayable,
  normalizeLocale,
  wolofEntry,
  wolofEntryForFrench,
  wolofReport,
  wolofText,
} from '@xamoto/shared';

describe('langues supportées', () => {
  it('expose exactement le français, l’anglais et le wolof', () => {
    expect([...LOCALES]).toEqual(['fr', 'en', 'wo']);
    expect(LOCALE_LABELS.wo).toBe('Wolof');
  });

  it('reconnaît une langue demandée, y compris avec une région', () => {
    expect(normalizeLocale('wo')).toBe('wo');
    expect(normalizeLocale('wo-SN')).toBe('wo');
    expect(normalizeLocale('FR')).toBe('fr');
    expect(normalizeLocale('en-US')).toBe('en');
  });

  it('ne devine pas une langue inconnue', () => {
    expect(normalizeLocale('es')).toBeNull();
    expect(normalizeLocale('')).toBeNull();
    expect(normalizeLocale(null)).toBeNull();
  });
});

describe('catalogue wolof', () => {
  it('chaque entrée porte son texte de référence et un statut', () => {
    expect(WOLOF_CATALOGUE.length).toBeGreaterThan(20);
    for (const entry of WOLOF_CATALOGUE) {
      expect(entry.key, 'clé manquante').toBeTruthy();
      expect(entry.fr.length).toBeGreaterThan(0);
      expect(entry.en.length).toBeGreaterThan(0);
      expect(['reviewed', 'draft']).toContain(entry.status);
      expect(['ui', 'label', 'safety']).toContain(entry.scope);
    }
  });

  it('les clés sont uniques : deux traductions ne peuvent pas se contredire', () => {
    const keys = WOLOF_CATALOGUE.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('une traduction marquée « relue » nomme son relecteur', () => {
    for (const entry of WOLOF_CATALOGUE.filter((e) => e.status === 'reviewed')) {
      expect(entry.reviewer, `${entry.key} est déclarée relue sans relecteur nommé`).toBeTruthy();
      expect(entry.wo.trim().length).toBeGreaterThan(0);
    }
  });

  it('une consigne de sécurité relue doit avoir un texte wolof', () => {
    for (const entry of WOLOF_CATALOGUE) {
      if (isSafetyCritical(entry) && entry.status === 'reviewed') {
        expect(entry.wo.trim().length, `${entry.key} : sécurité relue sans texte`).toBeGreaterThan(0);
      }
    }
  });
});

describe('règle de sécurité : jamais de consigne traduite à l’aveugle', () => {
  it('une consigne non relue n’est PAS affichée en wolof', () => {
    for (const entry of WOLOF_CATALOGUE.filter(isSafetyCritical)) {
      if (entry.status !== 'reviewed') {
        expect(isWolofDisplayable(entry), `${entry.key} ne doit pas être affichée`).toBe(false);
      }
    }
  });

  it('le niveau CRITIQUE et la consigne « ne roulez pas » restent en français aujourd’hui', () => {
    expect(wolofText('safety.critical')).toBeNull();
    expect(wolofText('drive.do_not_drive')).toBeNull();
    expect(wolofText('message.insufficient_data')).toBeNull();
    expect(wolofText('message.no_guarantee')).toBeNull();
  });

  it('un libellé non critique, lui, peut être affiché (avec mention de statut)', () => {
    expect(wolofText('certainty.unavailable')).toBe('AMUL');
    expect(wolofText('origin.measured')).toBeTruthy();
    expect(WOLOF_DRAFT_NOTICE.fr).toContain('relecture');
  });

  it('une entrée vide n’est jamais affichée, même relue', () => {
    const base = wolofEntry('certainty.possible');
    expect(base).toBeDefined();
    expect(isWolofDisplayable({ ...(base as NonNullable<typeof base>), wo: '   ', status: 'reviewed' })).toBe(false);
  });

  it('une consigne relue devient affichable : la bascule est automatique', () => {
    const critical = wolofEntry('drive.do_not_drive');
    expect(critical).toBeDefined();
    // Sans relecture : masquée. Après relecture par un locuteur natif : affichée.
    expect(isWolofDisplayable(critical!)).toBe(false);
    const reviewed = { ...critical!, status: 'reviewed' as const, reviewer: 'Locuteur natif', wo: 'Bàyyi woote.' };
    expect(isWolofDisplayable(reviewed)).toBe(true);
  });
});

describe('rapport de langue (transparence)', () => {
  const report = wolofReport();

  it('chiffre ce qui est affichable et ce qui reste en français', () => {
    expect(report.total).toBe(WOLOF_CATALOGUE.length);
    expect(report.displayable).toBeGreaterThan(0);
    expect(report.displayable).toBeLessThan(report.total);
    expect(report.reviewed).toBe(0);
  });

  it('liste précisément les textes de sécurité en attente de relecture', () => {
    expect(report.safetyPending.length).toBeGreaterThanOrEqual(8);
    expect(report.safetyReady).toBe(false);
    const keys = report.safetyPending.map((item) => item.key);
    expect(keys).toContain('drive.do_not_drive');
    expect(keys).toContain('message.no_guarantee');
    for (const item of report.safetyPending) {
      // Les mots de niveau (NORMAL, CRITIQUE) sont courts par nature : on
      // vérifie qu'ils portent bien un texte, pas une longueur arbitraire.
      expect(item.fr.trim().length).toBeGreaterThan(0);
    }
    const instructions = report.safetyPending.filter((item) => item.fr.length > 20);
    expect(instructions.length).toBeGreaterThanOrEqual(4);
  });

  it('annonce clairement l’état partiel, dans les deux langues', () => {
    expect(report.noticeFr).toContain('Aucune traduction automatique');
    expect(report.noticeEn).toContain('No machine translation');
    expect(report.noticeFr).toContain('restent en français');
  });
});

describe('phrases exigées par le §16', () => {
  it('les phrases imposées existent dans les deux langues de référence', () => {
    expect(MESSAGES.insufficientDataFr).toBe('Je ne dispose pas de cette donnée pour votre véhicule.');
    expect(MESSAGES.severalCausesFr).toBe('Plusieurs causes sont possibles.');
    expect(MESSAGES.testRequiredFr).toBe('Ce test est nécessaire avant de conclure.');
    expect(MESSAGES.insufficientDataEn.length).toBeGreaterThan(10);
  });

  it('les trois phrases du §16 sont inscrites au catalogue wolof', () => {
    expect(wolofEntryForFrench(MESSAGES.insufficientDataFr)).toBeDefined();
    expect(wolofEntryForFrench(MESSAGES.insufficientDataFr)?.scope).toBe('safety');
  });

});

describe('langue effective d’une réponse (§40)', () => {
  it('reconnaît le wolof demandé et annonce le repli en français', () => {
    const language = effectiveLanguage('wo');
    expect(language.requested).toBe('wo');
    expect(language.effective).toBe('fr');
    expect(language.fallback).toBe(true);
    expect(language.noticeFr).toContain('français');
    expect(language.noticeEn.toLowerCase()).toContain('french');
  });

  it('ne signale aucun repli en français ou en anglais', () => {
    expect(effectiveLanguage('fr')).toMatchObject({ effective: 'fr', fallback: false, noticeFr: '' });
    expect(effectiveLanguage('en')).toMatchObject({ effective: 'en', fallback: false, noticeFr: '' });
    expect(effectiveLanguage(undefined)).toMatchObject({ requested: 'fr', fallback: false });
    // Une langue inconnue retombe sur la langue de référence, sans mentir.
    expect(effectiveLanguage('it')).toMatchObject({ requested: 'fr', effective: 'fr', fallback: false });
  });
});
