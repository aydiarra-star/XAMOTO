/**
 * XAMOTO — Niveaux de certitude et de sécurité (§10, §11).
 *
 * Ces deux échelles gouvernent tout le produit : si elles sont fausses, une
 * conclusion peut être surévaluée. Elles sont donc vérifiées en premier.
 */
import { describe, expect, it } from 'vitest';
import { CERTAINTY_RANK, SAFETY_RANK, capCertainty, certaintyAtLeast, safetyAtLeast, weakestCertainty, worstSafety } from '@xamoto/shared';

describe('niveaux de sécurité (§11)', () => {
  it('classe les niveaux du plus sûr au plus grave', () => {
    expect(SAFETY_RANK.normal).toBeLessThan(SAFETY_RANK.attention);
    expect(SAFETY_RANK.attention).toBeLessThan(SAFETY_RANK.important);
    expect(SAFETY_RANK.important).toBeLessThan(SAFETY_RANK.critical);
  });

  it('retient TOUJOURS le niveau le plus grave — la sécurité ne se moyenne pas', () => {
    expect(worstSafety(['normal', 'attention'])).toBe('attention');
    expect(worstSafety(['attention', 'critical', 'normal'])).toBe('critical');
    expect(worstSafety(['important', 'attention'])).toBe('important');
  });

  it('retourne normal quand aucune raison ne s’applique', () => {
    expect(worstSafety([])).toBe('normal');
  });

  it('compare un niveau à un seuil', () => {
    expect(safetyAtLeast('critical', 'important')).toBe(true);
    expect(safetyAtLeast('attention', 'important')).toBe(false);
    expect(safetyAtLeast('important', 'important')).toBe(true);
  });
});

describe('niveaux de certitude (§10)', () => {
  it('classe les niveaux du plus faible au plus fort', () => {
    expect(CERTAINTY_RANK.unavailable).toBeLessThan(CERTAINTY_RANK.undeterminable);
    expect(CERTAINTY_RANK.undeterminable).toBeLessThan(CERTAINTY_RANK.possible);
    expect(CERTAINTY_RANK.possible).toBeLessThan(CERTAINTY_RANK.strongly_compatible);
    expect(CERTAINTY_RANK.strongly_compatible).toBeLessThan(CERTAINTY_RANK.confirmed);
  });

  it('retient la certitude la PLUS FAIBLE : on n’hérite pas d’une certitude qu’on n’a pas', () => {
    expect(weakestCertainty(['confirmed', 'possible'])).toBe('possible');
    expect(weakestCertainty(['strongly_compatible', 'undeterminable', 'possible'])).toBe('undeterminable');
    expect(weakestCertainty(['confirmed', 'strongly_compatible'])).toBe('strongly_compatible');
  });

  it('une conclusion sans donnée ne peut pas être présentée comme confirmée', () => {
    expect(weakestCertainty(['confirmed', 'unavailable'])).toBe('unavailable');
  });

  it('sans aucune évidence, le niveau est NON DISPONIBLE (jamais CONFIRMÉ)', () => {
    // §47-1 : une liste vide signifie « aucune donnée ». Le défaut prudent est
    // donc le niveau le plus faible, pas le plus fort.
    expect(weakestCertainty([])).toBe('unavailable');
  });

  it('le plafond de certitude ne peut que réduire, jamais renforcer', () => {
    expect(capCertainty('confirmed', 'possible')).toBe('possible');
    expect(capCertainty('possible', 'confirmed')).toBe('possible');
    expect(capCertainty('possible', null)).toBe('possible');
    expect(capCertainty('undeterminable', 'possible')).toBe('undeterminable');
  });

  it('compare une certitude à un seuil', () => {
    expect(certaintyAtLeast('confirmed', 'strongly_compatible')).toBe(true);
    expect(certaintyAtLeast('possible', 'strongly_compatible')).toBe(false);
  });
});
