/**
 * XAMOTO — Base de connaissances (§15, §16, §33, §47).
 *
 * La base documentaire est la seule autorité de l'assistant. Ces vérifications
 * garantissent qu'aucune définition n'est publiée sans source, sans test
 * associé, ou sans les deux langues.
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_DTC_KNOWLEDGE,
  FALLBACK_TESTS,
  GUIDED_TESTS,
  KNOWLEDGE_SOURCES,
  MAINTENANCE_DEFINITIONS,
  SYMPTOM_DEFINITIONS,
  TEST_BY_ID,
  describeUnknownDtc,
  findDtcKnowledge,
  getTests,
  sourceOf,
} from '@xamoto/diagnostic';

const SAFETY_LEVELS = ['normal', 'attention', 'important', 'critical'];

describe('codes défaut documentés', () => {
  it('la base contient un volume utile de définitions', () => {
    expect(ALL_DTC_KNOWLEDGE.length).toBeGreaterThanOrEqual(30);
  });

  it('chaque code porte sa source, ses deux langues et une gravité valide', () => {
    for (const dtc of ALL_DTC_KNOWLEDGE) {
      expect(dtc.code, `code mal formé : ${dtc.code}`).toMatch(/^[PCBU][0-3][0-9A-F]{3}$/);
      expect(dtc.simpleFr.length, `${dtc.code} : explication française absente`).toBeGreaterThan(10);
      expect(dtc.simpleEn.length, `${dtc.code} : explication anglaise absente`).toBeGreaterThan(10);
      expect(SAFETY_LEVELS).toContain(dtc.severity);
      expect(dtc.sourceId, `${dtc.code} : aucune source`).toBeTruthy();
    }
  });

  it('aucune définition ne cite une source inconnue', () => {
    for (const dtc of ALL_DTC_KNOWLEDGE) {
      const source = sourceOf(dtc.sourceId);
      expect(source, `${dtc.code} cite la source inconnue ${dtc.sourceId}`).not.toBeNull();
    }
  });

  it('chaque cause possible est expliquée dans les deux langues', () => {
    for (const dtc of ALL_DTC_KNOWLEDGE) {
      for (const cause of dtc.likelyCauses) {
        expect(cause.key, `${dtc.code} : cause sans clé`).toBeTruthy();
        expect(cause.labelFr.length, `${dtc.code}/${cause.key} : libellé français absent`).toBeGreaterThan(3);
        expect(cause.labelEn.length, `${dtc.code}/${cause.key} : libellé anglais absent`).toBeGreaterThan(3);
      }
    }
  });

  it('chaque test associé existe réellement (sinon le conseil serait inapplicable)', () => {
    for (const dtc of ALL_DTC_KNOWLEDGE) {
      for (const testId of dtc.relatedTests) {
        expect(TEST_BY_ID.has(testId), `${dtc.code} renvoie au test inconnu ${testId}`).toBe(true);
      }
    }
  });

  it('les codes sont uniques : deux définitions contradictoires sont impossibles', () => {
    const codes = ALL_DTC_KNOWLEDGE.map((dtc) => dtc.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('codes défaut non documentés (§16)', () => {
  it('un code inconnu n’est jamais inventé', () => {
    expect(findDtcKnowledge('P1234')).toBeUndefined();
    expect(findDtcKnowledge('P9999')).toBeUndefined();
  });

  it('la recherche est insensible à la casse', () => {
    expect(findDtcKnowledge('p0420')?.code).toBe('P0420');
  });

  it('un code inconnu est décrit par sa nomenclature, sans cause proposée', () => {
    const description = describeUnknownDtc('P1234');
    expect(description).not.toBeNull();
    expect(description?.system).toBeTruthy();
    expect(description?.familyFr.length).toBeGreaterThan(5);
    // Aucune cause n'est proposée : la fonction ne décrit que la famille.
    expect(Object.keys(description ?? {}).sort()).toEqual(['familyEn', 'familyFr', 'system']);
    expect(JSON.stringify(description)).not.toMatch(/cause/i);
  });

  it('une chaîne vide ne produit aucune description', () => {
    expect(describeUnknownDtc('')).toBeNull();
  });
});

describe('tests guidés (§17)', () => {
  it('chaque test est complet et exécutable', () => {
    for (const test of GUIDED_TESTS) {
      expect(test.id).toMatch(/^test_/);
      expect(test.titleFr.length).toBeGreaterThan(5);
      expect(test.titleEn.length).toBeGreaterThan(5);
      expect(test.objectiveFr.length).toBeGreaterThan(10);
      expect(test.stepsFr.length, `${test.id} : aucune étape`).toBeGreaterThan(0);
      expect(test.stepsEn.length, `${test.id} : étapes anglaises absentes`).toBe(test.stepsFr.length);
      expect(SAFETY_LEVELS).toContain(test.safety);
      expect(test.durationMin).toBeGreaterThan(0);
    }
  });

  it('les identifiants de test sont uniques', () => {
    const ids = GUIDED_TESTS.map((test) => test.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('les tests de repli existent et sont proposés quand rien de spécifique ne s’applique', () => {
    for (const id of FALLBACK_TESTS) {
      expect(TEST_BY_ID.has(id), `test de repli inconnu : ${id}`).toBe(true);
    }
    const resolved = getTests(FALLBACK_TESTS);
    expect(resolved).toHaveLength(FALLBACK_TESTS.length);
  });

  it('un test inexistant est ignoré, jamais inventé', () => {
    expect(getTests(['test_qui_nexiste_pas'])).toHaveLength(0);
  });
});

describe('symptômes', () => {
  it('chaque symptôme est déclarable et traduit', () => {
    expect(SYMPTOM_DEFINITIONS.length).toBeGreaterThan(10);
    for (const symptom of SYMPTOM_DEFINITIONS) {
      expect(symptom.labelFr.length).toBeGreaterThan(3);
      expect(symptom.labelEn.length).toBeGreaterThan(3);
      expect(SAFETY_LEVELS).toContain(symptom.safety);
      expect(Array.isArray(symptom.systems)).toBe(true);
    }
  });
});

describe('sources documentaires (§15)', () => {
  it('chaque source indique son éditeur, sa fiabilité et sa version', () => {
    expect(KNOWLEDGE_SOURCES.length).toBeGreaterThanOrEqual(5);
    for (const source of KNOWLEDGE_SOURCES) {
      expect(source.id).toMatch(/^src_/);
      expect(source.publisher.length).toBeGreaterThan(2);
      expect(source.version.length).toBeGreaterThan(0);
      expect(['official', 'licensed', 'technical', 'community', 'xamoto']).toContain(source.reliability);
    }
  });

  it('une source inconnue n’est jamais fabriquée', () => {
    expect(sourceOf('src_inexistante')).toBeNull();
  });
});

describe('entretien (§22)', () => {
  it('chaque définition porte un intervalle et une source', () => {
    expect(MAINTENANCE_DEFINITIONS.length).toBeGreaterThan(10);
    for (const item of MAINTENANCE_DEFINITIONS) {
      expect(item.kind.length).toBeGreaterThan(2);
      expect(item.labelFr.length).toBeGreaterThan(2);
      expect(item.labelEn.length).toBeGreaterThan(2);
      const hasInterval = Boolean(item.intervalKmRange) || Boolean(item.intervalMonthsRange);
      expect(hasInterval, `${item.kind} : aucun intervalle (ni km, ni mois)`).toBe(true);
      if (item.intervalKmRange) {
        expect(item.intervalKmRange[0]).toBeLessThanOrEqual(item.intervalKmRange[1]);
      }
      if (item.intervalMonthsRange) {
        expect(item.intervalMonthsRange[0]).toBeLessThanOrEqual(item.intervalMonthsRange[1]);
      }
      expect(item.sourceId).toBeTruthy();
    }
  });

  it('aucune définition d’entretien ne cite une source inconnue', () => {
    for (const item of MAINTENANCE_DEFINITIONS) {
      expect(sourceOf(item.sourceId), `${item.kind} cite ${item.sourceId}`).not.toBeNull();
    }
  });
});
