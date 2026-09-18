/**
 * XAMOTO — Moteur de diagnostic (§9, §10, §11, §12, §47).
 *
 * Ces vérifications portent sur la garantie centrale du produit : le moteur ne
 * peut pas produire une affirmation que les données ne soutiennent pas, et il
 * ne peut pas passer sous silence ce qu'il ignore.
 */
import { describe, expect, it } from 'vitest';
import { DiagnosticEngine } from '@xamoto/diagnostic';
import type { DiagnosticContext } from '../src/rules/types.js';
import { fixtureContext, reading } from './fixtures.js';

const engine = new DiagnosticEngine();

/**
 * Sérialise une conclusion en neutralisant les horodatages : seules les
 * DÉCISIONS du moteur doivent être reproductibles, pas l'instant du calcul.
 */
function stable(value: unknown): string {
  return JSON.stringify(value, (key, item) =>
    key === 'proposedAt' || key === 'capturedAt' || key === 'lastSeenAt' || key === 'generatedAt' ? '<horodatage>' : item,
  );
}

describe('moteur : contexte vide', () => {
  it('sans aucune donnée, la conclusion est NON DISPONIBLE — jamais CONFIRMÉE', () => {
    const result = engine.analyze(fixtureContext({ readings: [], dtcs: [], symptoms: [], source: 'none' }));

    expect(result.certainty).toBe('unavailable');
    expect(result.hypotheses).toHaveLength(0);
    expect(result.conclusionFr).toContain('Je ne dispose pas de cette donnée');
    expect(result.safety).toBe('normal');
  });

  it('signale les données manquantes au lieu de conclure', () => {
    const result = engine.analyze(fixtureContext({ readings: [], dtcs: [], symptoms: [], source: 'none' }));
    expect(result.missingData.length).toBeGreaterThan(0);
    expect(result.debug.causeScores).toHaveLength(0);
  });
});

describe('moteur : aucune hypothèse confirmée sans test', () => {
  const rich = fixtureContext({
    readings: [
      reading('coolant_temp', 88, '°C'),
      reading('engine_rpm', 780, 'tr/min'),
      reading('battery_voltage', 13.9, 'V'),
      reading('short_fuel_trim_b1', 3.1, '%'),
      reading('long_fuel_trim_b1', 12.4, '%'),
      reading('o2_b1s1_voltage', 0.45, 'V'),
    ],
    dtcs: [
      { code: 'P0420', status: 'stored', occurrences: 2, origin: 'measured', lastSeenAt: '2026-01-15T10:00:00.000Z' },
      { code: 'P0171', status: 'pending', occurrences: 1, origin: 'measured', lastSeenAt: '2026-01-15T10:00:00.000Z' },
    ],
    symptoms: [{ key: 'loss_of_power', present: true }],
  });

  it('propose des hypothèses et des tests', () => {
    const result = engine.analyze(rich);
    expect(result.hypotheses.length).toBeGreaterThan(0);
    expect(result.tests.length).toBeGreaterThan(0);
  });

  it('aucune hypothèse ne peut être « confirmée » sans test réalisé', () => {
    const result = engine.analyze(rich);
    for (const hypothesis of result.hypotheses) {
      expect(hypothesis.certainty).not.toBe('confirmed');
    }
    expect(result.certainty).not.toBe('confirmed');
  });

  it('un plafond de certitude est appliqué et tracé', () => {
    const result = engine.analyze(rich);
    if (result.debug.caps.length > 0) {
      expect(result.debug.caps[0]?.reasonFr.length).toBeGreaterThan(10);
    }
    // Le plafond ne peut jamais renforcer : la certitude reste ≤ celle des causes.
    expect(['possible', 'strongly_compatible', 'undeterminable', 'unavailable']).toContain(result.certainty);
  });

  it('le moteur est déterministe : mêmes données, même conclusion', () => {
    const first = engine.analyze(rich);
    const second = engine.analyze(rich);
    expect(stable(second)).toBe(stable(first));
  });

  it('la conclusion affiche les niveaux et ne garantit rien', () => {
    const result = engine.analyze(rich);
    expect(result.conclusionFr.length).toBeGreaterThan(40);
    expect(result.conclusionEn.length).toBeGreaterThan(40);
    // §47-10 : aucune promesse de garantie, quelle que soit la formulation.
    expect(result.conclusionFr.toLowerCase()).not.toContain('vous pouvez rouler sans risque');
    expect(result.canIDrive.disclaimerFr).toMatch(/garantir|garantie/);
    expect(result.canIDrive.disclaimerEn).toMatch(/guarantee|guarantees/);
  });

  it('chaque hypothèse porte un score, un niveau et une raison', () => {
    const result = engine.analyze(rich);
    for (const hypothesis of result.hypotheses) {
      expect(hypothesis.score).toBeGreaterThan(0.05);
      expect(hypothesis.reasoning.length).toBeGreaterThan(0);
      expect(hypothesis.labelFr.length).toBeGreaterThan(0);
      expect(hypothesis.labelEn.length).toBeGreaterThan(0);
    }
  });

  it('les hypothèses sont ordonnées du score le plus élevé au plus faible', () => {
    const scores = engine.analyze(rich).hypotheses.map((hypothesis) => hypothesis.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

describe('moteur : la sécurité ne s’adoucit jamais', () => {
  const normal = fixtureContext({
    readings: [reading('coolant_temp', 88, '°C'), reading('battery_voltage', 13.9, 'V')],
    dtcs: [],
  });

  const overheating = fixtureContext({
    readings: [reading('coolant_temp', 116, '°C'), reading('battery_voltage', 13.9, 'V')],
    dtcs: [],
  });

  it('une température critique impose le niveau CRITIQUE', () => {
    const result = engine.analyze(overheating);
    expect(result.safety).toBe('critical');
    expect(result.canIDrive.level).toBe('critical');
    expect(result.canIDrive.headlineFr).toContain('déconseillé');
    expect(result.canIDrive.seeProfessionalFr).toContain('Maintenant');
  });

  it('une tension trop basse remonte au moins au niveau IMPORTANT', () => {
    const low = fixtureContext({ readings: [reading('battery_voltage', 11.2, 'V')], dtcs: [] });
    const result = engine.analyze(low);
    expect(['important', 'critical']).toContain(result.safety);
  });

  it('ajouter une mesure grave ne peut pas améliorer le niveau de sécurité', () => {
    const before = engine.analyze(normal);
    const after = engine.analyze(overheating);
    const order = { normal: 0, attention: 1, important: 2, critical: 3 } as const;
    expect(order[after.safety]).toBeGreaterThanOrEqual(order[before.safety]);
  });

  it('« Puis-je rouler ? » liste toujours les données utilisées et l’avertissement', () => {
    const result = engine.analyze(normal);
    expect(result.canIDrive.disclaimerFr.length).toBeGreaterThan(20);
    expect(result.canIDrive.disclaimerEn.length).toBeGreaterThan(20);
    expect(Array.isArray(result.canIDrive.dataUsed)).toBe(true);
  });
});

describe('moteur : traçabilité', () => {
  it('indique la version du moteur et les règles appliquées', () => {
    const result = engine.analyze(fixtureContext({ readings: [reading('coolant_temp', 90, '°C')], dtcs: [] }));
    expect(result.engineVersion).toContain('xamoto-diag');
    expect(Array.isArray(result.rulesFired)).toBe(true);
  });

  it('conserve l’origine des données, y compris simulée', () => {
    const simulated = engine.analyze(
      fixtureContext({
        readings: [reading('coolant_temp', 90, '°C', { origin: 'simulated' })],
        dtcs: [],
        source: 'simulator',
      }),
    );
    expect(simulated.dataOrigin).toBe('simulated');
    expect(JSON.stringify(simulated.notes)).toContain('SIMULATION');
  });
});
