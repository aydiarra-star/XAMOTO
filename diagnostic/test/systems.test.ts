/**
 * XAMOTO — Règles et limites PAR SYSTÈME (§15, §16, §33, §47).
 *
 * Le produit doit pouvoir dire, pour chaque partie du véhicule, ce qu'il sait
 * lire et ce qu'il ne sait pas lire. Ces vérifications garantissent deux choses :
 *
 *   1. aucun système n'est laissé sans règle NI sans limite déclarée (un trou
 *      silencieux serait interprété comme « tout va bien ») ;
 *   2. les règles par système ne produisent jamais une conclusion que les
 *      données ne soutiennent pas — c'est le cas des systèmes non lisibles par
 *      l'OBD : freinage, ABS, airbag, climatisation, réseau.
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_SYSTEMS,
  BRAKING_RULES,
  CLIMATE_RULES,
  COOLING_RULES,
  DTC_RULES,
  GUIDED_TESTS,
  NETWORK_RULES,
  RULES_BY_SYSTEM,
  SYSTEM_COVERAGE,
  TEST_BY_ID,
  TRANSMISSION_RULES,
  coverageOf,
  rulesBySystemView,
} from '@xamoto/diagnostic';
import { DTC_SYSTEM_LABELS, type DtcSystem } from '@xamoto/shared';
import { PARTS } from '../../backend/src/db/seed-data.js';
import { ALL_DTC_KNOWLEDGE } from '../src/knowledge/dtc.js';
import { SYMPTOM_DEFINITIONS, SYMPTOM_HYPOTHESES } from '../src/knowledge/symptoms.js';
import { sourceOf } from '../src/knowledge/sources.js';
import type { DiagnosticContext } from '../src/rules/types.js';
import { dtc, fixtureContext, reading } from './fixtures.js';

const PART_KEYS = new Set(PARTS.map((part) => part.partKey));

function runRules(rules: typeof BRAKING_RULES, ctx: DiagnosticContext) {
  return rules.filter((rule) => rule.applies(ctx)).flatMap((rule) => rule.apply(ctx));
}

describe('couverture par système (§15)', () => {
  it('chaque système de la nomenclature possède une ligne de couverture', () => {
    const declared = new Set(ALL_SYSTEMS);
    for (const system of Object.keys(DTC_SYSTEM_LABELS) as DtcSystem[]) {
      expect(declared.has(system), `système sans ligne de couverture : ${system}`).toBe(true);
    }
  });

  it('aucun système n’est laissé sans règle ET sans limite documentée', () => {
    for (const row of rulesBySystemView()) {
      const hasRules = row.ruleIds.length > 0;
      const hasLimits = Boolean(row.coverage?.limitsFr && row.coverage?.limitsEn);
      expect(hasRules || hasLimits, `système ${row.system} : ni règle, ni limite déclarée`).toBe(true);
    }
  });

  it('la couverture est bilingue, sourcée et actionnable', () => {
    for (const coverage of SYSTEM_COVERAGE) {
      expect(coverage.whatObdGivesFr.length, `${coverage.system}`).toBeGreaterThan(20);
      expect(coverage.whatObdGivesEn.length, `${coverage.system}`).toBeGreaterThan(20);
      expect(coverage.limitsFr.length, `${coverage.system}`).toBeGreaterThan(20);
      expect(coverage.limitsEn.length, `${coverage.system}`).toBeGreaterThan(20);
      expect(sourceOf(coverage.sourceId), `${coverage.system} cite la source inconnue ${coverage.sourceId}`).not.toBeNull();
      for (const testId of coverage.tests) {
        expect(TEST_BY_ID.has(testId), `${coverage.system} renvoie au test inconnu ${testId}`).toBe(true);
      }
    }
  });

  it('un système inconnu ne reçoit aucune couverture inventée', () => {
    expect(coverageOf('suspension_magnetique' as DtcSystem)).toBeNull();
  });

  it('les règles par système sont toutes identifiables et rattachées', () => {
    const systemRules = [BRAKING_RULES, CLIMATE_RULES, COOLING_RULES, NETWORK_RULES, TRANSMISSION_RULES].flat();
    for (const rule of systemRules) {
      expect(rule.systems?.length ?? 0, `${rule.id} : aucune système déclaré`).toBeGreaterThan(0);
      for (const system of rule.systems ?? []) {
        expect(RULES_BY_SYSTEM[system]?.some((r) => r.id === rule.id), `${rule.id} absent de ${system}`).toBe(true);
      }
    }
  });
});

describe('base documentaire : aucun renvoi dans le vide', () => {
  it('tous les tests cités par les règles existent réellement', () => {
    const allTests = new Set(GUIDED_TESTS.map((test) => test.id));
    const effects = [
      ...BRAKING_RULES,
      ...CLIMATE_RULES,
      ...COOLING_RULES,
      ...NETWORK_RULES,
      ...TRANSMISSION_RULES,
      ...DTC_RULES,
    ]
      .filter((rule) => rule.applies(fixtureContext({ dtcs: [dtc('C0035'), dtc('P0171'), dtc('U0100'), dtc('P0700'), dtc('B1000')] })))
      .flatMap((rule) => rule.apply(fixtureContext({ dtcs: [dtc('C0035'), dtc('P0171'), dtc('U0100'), dtc('P0700'), dtc('B1000')] })));

    for (const effect of effects) {
      if (effect.kind === 'test') {
        expect(allTests.has(effect.testKey), `test inconnu cité par une règle : ${effect.testKey}`).toBe(true);
      }
    }
    expect(effects.length).toBeGreaterThan(0);
  });

  it('chaque pièce citée par la base de connaissances existe dans le graphe de pièces', () => {
    const cited = new Set<string>();
    for (const knowledge of ALL_DTC_KNOWLEDGE) {
      for (const cause of knowledge.likelyCauses) for (const part of cause.parts ?? []) cited.add(part);
    }
    for (const seed of SYMPTOM_HYPOTHESES) for (const part of seed.parts) cited.add(part);

    const missing = [...cited].filter((part) => !PART_KEYS.has(part));
    expect(missing, `pièces citées mais absentes du graphe : ${missing.join(', ')}`).toHaveLength(0);
  });

  it('chaque symptôme oriente au moins une hypothèse ou un test', () => {
    for (const symptom of SYMPTOM_DEFINITIONS) {
      const seeds = SYMPTOM_HYPOTHESES.filter((seed) => seed.symptom === symptom.key);
      expect(seeds.length, `symptôme sans orientation : ${symptom.key}`).toBeGreaterThan(0);
      for (const seed of seeds) {
        for (const testId of seed.tests) {
          expect(TEST_BY_ID.has(testId), `${symptom.key} renvoie au test inconnu ${testId}`).toBe(true);
        }
        for (const part of seed.parts) {
          expect(PART_KEYS.has(part), `${symptom.key} cite la pièce inconnue ${part}`).toBe(true);
        }
      }
    }
  });
});

describe('freinage : un code de châssis ne désigne pas une pièce (§16)', () => {
  const ctx = fixtureContext({ dtcs: [dtc('C0035', { status: 'active' })] });

  it('la règle s’applique et impose l’ordre circuit → pièce', () => {
    expect(BRAKING_RULES.some((rule) => rule.applies(ctx))).toBe(true);
    const effects = runRules(BRAKING_RULES, ctx);
    const finding = effects.find((e) => e.kind === 'finding');
    expect(finding?.kind === 'finding' && finding.finding.detailFr).toMatch(/câblage|connecteur/);
    expect(finding?.kind === 'finding' && finding.finding.detailFr).toMatch(/jamais/);
  });

  it('plafonne la certitude et demande une mesure physique', () => {
    const effects = runRules(BRAKING_RULES, ctx);
    const cap = effects.find((e) => e.kind === 'certaintyCap');
    expect(cap?.kind === 'certaintyCap' && cap.level).toBe('possible');
    const missing = effects.filter((e) => e.kind === 'missing');
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((e) => e.kind === 'missing' && e.blocksConclusion)).toBe(true);
  });

  it('ne propose jamais une cause « confirmée » sur ce système', () => {
    const effects = runRules(BRAKING_RULES, ctx);
    for (const effect of effects) {
      if (effect.kind === 'cause') expect(effect.cause.delta).toBeLessThanOrEqual(0.5);
      if (effect.kind === 'finding') expect(effect.finding.certainty).not.toBe('confirmed');
    }
  });

  it('une pédale de frein molle est une urgence, sans hypothèse chiffrée', () => {
    const pedal = fixtureContext({ symptoms: [{ key: 'brake_soft_pedal', present: true, intensity: 'severe' }] });
    const effects = runRules(BRAKING_RULES, pedal);
    const safety = effects.find((e) => e.kind === 'safety');
    expect(safety?.kind === 'safety' && safety.level).toBe('critical');
    const finding = effects.find((e) => e.kind === 'finding' && e.finding.certainty === 'undeterminable');
    expect(finding, 'aucun constat d’indétermination sur la pédale molle').toBeTruthy();
    expect(effects.every((e) => e.kind !== 'cause')).toBe(true);
  });
});

describe('réseau, transmission, airbag, climatisation : refus d’inventer', () => {
  it('un code de communication interdit de conclure au calculateur à remplacer', () => {
    const ctx = fixtureContext({ dtcs: [dtc('U0100', { status: 'active' })], readings: [reading('battery_voltage', 11.6)] });
    const effects = runRules(NETWORK_RULES, ctx);
    const finding = effects.find((e) => e.kind === 'finding');
    expect(finding?.kind === 'finding' && finding.finding.detailFr).toMatch(/masse|alimentation/);
    expect(effects.some((e) => e.kind === 'certaintyCap')).toBe(true);
    expect(effects.filter((e) => e.kind === 'test').length).toBeGreaterThanOrEqual(2);
  });

  it('un code de boîte de vitesses reste « possible » tant que la boîte n’est pas relevée', () => {
    const ctx = fixtureContext({ dtcs: [dtc('P0700', { status: 'active' })] });
    const effects = runRules(TRANSMISSION_RULES, ctx);
    expect(effects.some((e) => e.kind === 'certaintyCap' && e.level === 'possible')).toBe(true);
    const missing = effects.find((e) => e.kind === 'missing');
    expect(missing?.kind === 'missing' && missing.itemFr).toMatch(/boîte/i);
    expect(effects.some((e) => e.kind === 'cause' && e.cause.causeKey === 'transmission_fluid')).toBe(true);
  });

  it('un code de carrosserie déclenche un avertissement de sécurité, jamais une hypothèse', () => {
    const ctx = fixtureContext({ dtcs: [dtc('B1000', { status: 'stored' })] });
    const bodyRules = RULES_BY_SYSTEM.airbag ?? [];
    const effects = bodyRules.flatMap((rule) => (rule.applies(ctx) ? rule.apply(ctx) : []));
    expect(effects.some((e) => e.kind === 'safety' && e.level === 'important')).toBe(true);
    expect(effects.every((e) => e.kind !== 'cause')).toBe(true);
    const finding = effects.find((e) => e.kind === 'finding');
    expect(finding?.kind === 'finding' && finding.finding.detailFr).toMatch(/ohmmètre|pyrotechnique|déployeur/);
  });

  it('une climatisation qui ne refroidit plus oriente vers le nettoyage avant le gaz', () => {
    const ctx = fixtureContext({ symptoms: [{ key: 'ac_not_cold', present: true }] });
    const effects = runRules(CLIMATE_RULES, ctx);
    const tests = effects.filter((e) => e.kind === 'test').map((e) => (e.kind === 'test' ? e.testKey : ''));
    expect(tests[0]).toBe('test_ac_visual');
    expect(tests).toContain('test_ac_pressure_pro');
    const causes = effects.filter((e) => e.kind === 'cause');
    const condenser = causes.find((e) => e.kind === 'cause' && e.cause.causeKey === 'ac_filter_dirty');
    expect(condenser?.kind === 'cause' && condenser.cause.delta).toBeGreaterThan(0);
    expect(effects.some((e) => e.kind === 'missing' && e.blocksConclusion)).toBe(true);
    // Aucune cause « climatisation » ne peut dépasser le stade d'hypothèse.
    for (const effect of causes) {
      if (effect.kind === 'cause') expect(effect.cause.delta).toBeLessThanOrEqual(0.5);
    }
  });

  it('une consommation de liquide avec surchauffe devient une urgence et impose le test de gaz', () => {
    const ctx = fixtureContext({
      symptoms: [
        { key: 'coolant_loss', present: true },
        { key: 'overheating', present: true, intensity: 'severe' },
      ],
      readings: [reading('coolant_temp', 108)],
    });
    const effects = runRules(COOLING_RULES, ctx);
    const finding = effects.find((e) => e.kind === 'finding');
    expect(finding?.kind === 'finding' && finding.finding.safety).toBe('critical');
    expect(effects.some((e) => e.kind === 'test' && e.testKey === 'test_combustion_gases_coolant')).toBe(true);
    expect(effects.some((e) => e.kind === 'missing' && e.blocksConclusion)).toBe(true);
  });
});

describe('les règles par système restent déterministes', () => {
  it('deux exécutions donnent exactement le même résultat', () => {
    const ctx = fixtureContext({
      dtcs: [dtc('C0035', { status: 'active' }), dtc('U0121', { status: 'active' }), dtc('P0700', { status: 'stored' })],
      symptoms: [{ key: 'jerking', present: true }],
      readings: [reading('battery_voltage', 12.1)],
    });
    const all = [...BRAKING_RULES, ...NETWORK_RULES, ...TRANSMISSION_RULES, ...CLIMATE_RULES, ...COOLING_RULES];
    const first = JSON.stringify(runRules(all, ctx));
    const second = JSON.stringify(runRules(all, ctx));
    expect(second).toBe(first);
  });
});
