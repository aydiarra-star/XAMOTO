/**
 * XAMOTO — Procédures : contrôle après réparation (§19), second avis (§20) et
 * inspection avant achat (§21).
 *
 * Ces trois fonctions prennent des décisions qui coûtent de l'argent à
 * l'utilisateur (reprendre la route, payer une réparation, acheter un véhicule).
 * Elles sont donc vérifiées sur ce qu'elles refusent de dire autant que sur ce
 * qu'elles affirment.
 */
import { describe, expect, it } from 'vitest';
import { DiagnosticEngine, buildInspectionReport, compareAfterRepair, secondOpinion } from '@xamoto/diagnostic';
import type { DiagnosticContext } from '../src/rules/types.js';
import { dtc, fixtureContext, reading } from './fixtures.js';

const engine = new DiagnosticEngine();

describe('contrôle après réparation (§19)', () => {
  const before = {
    sessionId: 'scan_before',
    finishedAt: '2026-01-10T09:00:00.000Z',
    dtcCodes: ['P0300', 'P0301'],
    readings: [reading('long_fuel_trim_b1', 22.5, '%'), reading('coolant_temp', 89, '°C'), reading('engine_rpm', 800, 'tr/min')],
  };
  const afterClean = {
    sessionId: 'scan_after',
    finishedAt: '2026-01-20T09:00:00.000Z',
    dtcCodes: [],
    readings: [reading('long_fuel_trim_b1', 3.2, '%'), reading('coolant_temp', 88, '°C'), reading('engine_rpm', 780, 'tr/min')],
    kmSinceRepair: 180,
    driveCycles: 4,
  };

  it('déclare le défaut résolu seulement après des kilomètres et des cycles réels', () => {
    const verification = compareAfterRepair({ before, after: afterClean, repairDescription: 'Remplacement bobine + bougies', repairDate: '2026-01-12' });
    expect(verification.verdict).toBe('resolved');
    expect(verification.dtcRemaining).toEqual([]);
    expect(verification.certainty).toBe('strongly_compatible');
    expect(verification.summaryFr.length).toBeGreaterThan(30);
    expect(verification.summaryEn.length).toBeGreaterThan(30);
  });

  it('reste prudent si le véhicule n’a pas encore roulé depuis la réparation', () => {
    const noDrive = compareAfterRepair({
      before,
      after: { ...afterClean, kmSinceRepair: 0, driveCycles: 0 },
      repairDescription: 'Effacement des défauts',
      repairDate: '2026-01-12',
    });
    expect(noDrive.verdict).toBe('resolved');
    expect(noDrive.certainty).toBe('possible');
  });

  it('signale un défaut qui persiste au lieu de rassurer', () => {
    const verification = compareAfterRepair({
      before,
      after: { ...afterClean, dtcCodes: ['P0300'], kmSinceRepair: 200, driveCycles: 5 },
      repairDescription: 'Remplacement bobine',
      repairDate: '2026-01-12',
    });
    expect(verification.verdict).toBe('still_present');
    expect(verification.dtcRemaining).toContain('P0300');
  });

  it('signale un défaut NOUVEAU apparu après l’intervention', () => {
    const verification = compareAfterRepair({
      before,
      after: { ...afterClean, dtcCodes: ['P0420'], kmSinceRepair: 300, driveCycles: 6 },
      repairDescription: 'Remplacement catalyseur',
      repairDate: '2026-01-12',
    });
    expect(verification.verdict).toBe('new_issue');
    expect(verification.dtcNew).toEqual(['P0420']);
  });

  it('annonce une donnée insuffisante plutôt qu’une conclusion (§47-1)', () => {
    const verification = compareAfterRepair({
      before,
      after: { sessionId: 'scan_after', finishedAt: '2026-01-20T09:00:00.000Z', dtcCodes: [], readings: [] },
      repairDescription: 'Intervention inconnue',
      repairDate: '2026-01-12',
    });
    expect(verification.verdict).toBe('insufficient_data');
    expect(verification.certainty).toBe('unavailable');
  });

  it('une comparaison contenant une mesure simulée est marquée « simulated »', () => {
    const verification = compareAfterRepair({
      before,
      after: { ...afterClean, readings: [reading('long_fuel_trim_b1', 3.2, '%', { origin: 'simulated' }), ...afterClean.readings.slice(1)] },
      repairDescription: 'Simulation',
      repairDate: '2026-01-12',
    });
    expect(verification.dataOrigin).toBe('simulated');
  });

  it('décrit l’évolution des mesures dans les deux langues', () => {
    const verification = compareAfterRepair({ before, after: afterClean, repairDescription: 'Injection', repairDate: '2026-01-12' });
    const trim = verification.valuesChanged.find((value) => value.key === 'long_fuel_trim_b1');
    expect(trim?.before).toBe(22.5);
    expect(trim?.after).toBe(3.2);
  });
});

describe('second avis (§20)', () => {
  const context: DiagnosticContext = fixtureContext({
    readings: [reading('long_fuel_trim_b1', 24.8, '%'), reading('coolant_temp', 88, '°C'), reading('engine_rpm', 790, 'tr/min'), reading('maf_air_flow', 3.1, 'g/s')],
    dtcs: [dtc('P0171', { status: 'stored', occurrences: 3 })],
    symptoms: [{ key: 'loss_of_power', present: true }],
  });
  const result = engine.analyze(context);

  it('ne juge jamais le professionnel ni le prix', () => {
    const opinion = secondOpinion(
      {
        externalDiagnosis: 'Capteur MAF défaillant, à remplacer avec un devis de 180 000 FCFA',
        externalCauses: ['Capteur de débit d’air défaillant'],
        proposedRepair: 'Remplacement du capteur MAF',
        proposedAmount: 180000,
        currency: 'XOF',
        context,
      },
      result,
    );
    const text = `${opinion.summaryFr} ${opinion.disclaimerFr} ${opinion.questionsFr.join(' ')}`.toLowerCase();
    expect(text).toContain('aucun jugement');
    for (const forbidden of ['malhonnête', 'arnaque', 'trop cher', 'incompétent']) {
      expect(text).not.toContain(forbidden);
    }
    expect(opinion.disclaimerEn.toLowerCase()).toContain('no judgement');
  });

  it('rappelle ce que les données soutiennent vraiment', () => {
    const opinion = secondOpinion({ externalDiagnosis: 'Capteur MAF défaillant', context }, result);
    expect(opinion.confirmedElements.some((element) => element.label.includes('P0171'))).toBe(true);
    expect(opinion.confirmedElements.every((element) => element.certainty !== 'confirmed')).toBe(true);
  });

  it('ne confirme pas une cause que les données ne soutiennent pas', () => {
    const opinion = secondOpinion(
      { externalDiagnosis: 'Boîte de vitesses à remplacer', externalCauses: ['Boîte de vitesses HS'], context },
      result,
    );
    const everything = [...opinion.confirmedElements.map((e) => e.label), ...opinion.unconfirmedElements.map((e) => e.label)].join(' | ').toLowerCase();
    expect(everything).toContain('boîte');
    expect(opinion.unconfirmedElements.length).toBeGreaterThan(0);
    expect(opinion.unconfirmedElements[0]?.why).toMatch(/ni de confirmer ni d’écarter|ne suffisent pas/i);
  });

  it('propose des tests objectifs et des questions factuelles au garage', () => {
    const opinion = secondOpinion({ externalDiagnosis: 'Catalyseur HS', context }, result);
    expect(opinion.additionalTests.length).toBeGreaterThan(0);
    expect(opinion.questionsFr.length).toBeGreaterThanOrEqual(3);
    expect(opinion.questionsEn.length).toBe(opinion.questionsFr.length);
    expect(opinion.questionsFr.join(' ')).toMatch(/freeze frame|test/i);
  });

  it('sans scan préalable, annonce qu’il ne peut rien analyser', () => {
    const empty = engine.analyze(fixtureContext({ readings: [], dtcs: [], symptoms: [], source: 'none' }));
    const opinion = secondOpinion({ externalDiagnosis: 'Embrayage usé', context: fixtureContext({ readings: [], dtcs: [], symptoms: [], source: 'none' }) }, empty);
    expect(opinion.confirmedElements).toHaveLength(0);
    expect(opinion.summaryFr).toContain('ne dispose pas');
  });
});

describe('inspection avant achat (§21)', () => {
  const context: DiagnosticContext = fixtureContext({
    readings: [
      reading('coolant_temp', 97, '°C'),
      reading('battery_voltage', 11.6, 'V'),
      reading('engine_rpm', 820, 'tr/min'),
      reading('long_fuel_trim_b1', 18.2, '%'),
      reading('short_fuel_trim_b1', 4.1, '%'),
    ],
    dtcs: [dtc('P0300', { status: 'stored', occurrences: 4 }), dtc('P0301', { status: 'stored', occurrences: 2 })],
    vehicle: { id: 'veh_test', brand: 'Toyota', model: 'Corolla', year: 2011, engine: '1.6', fuelType: 'essence', odometerKm: 268000 },
    source: 'obd',
  });
  const result = engine.analyze(context);

  it('produit une fiche complète, chiffrée et traduite', () => {
    const report = buildInspectionReport(context, result, { displayedOdometerKm: 268000, vehicleYear: 2011, sellerClaims: ['véhicule révisé', 'aucun défaut'] });
    expect(report.checklist.length).toBeGreaterThan(4);
    for (const item of report.checklist) {
      expect(item.labelFr.length).toBeGreaterThan(2);
      expect(item.labelEn.length).toBeGreaterThan(2);
      expect(['ok', 'watch', 'problem', 'not_checked']).toContain(item.verdict);
    }
    expect(report.scores.overall).toBeGreaterThanOrEqual(0);
    expect(report.scores.overall).toBeLessThanOrEqual(100);
    expect(report.redFlags.length).toBeGreaterThan(0);
  });

  it('ne transforme jamais une déclaration du vendeur en preuve', () => {
    const withClaims = buildInspectionReport(context, result, { sellerClaims: ['véhicule en parfait état'] });
    const text = [...withClaims.notes, ...withClaims.redFlags, ...withClaims.checklist.map((i) => i.detail ?? '')].join(' ');
    expect(text).toMatch(/déclar|vendeur|non vérifi/i);
  });

  it('liste ce qui n’a pas pu être contrôlé', () => {
    const report = buildInspectionReport(context, result, { notTestable: ['Essai routier impossible (véhicule non assuré)'] });
    const text = [...report.notes, ...report.checklist.map((i) => i.detail ?? '')].join(' ');
    expect(text.toLowerCase()).toContain('non');
    expect(report.checklist.some((item) => item.verdict === 'not_checked') || report.notes.length > 0).toBe(true);
  });

  it('un véhicule propre obtient un score élevé sans promesse d’achat', () => {
    const cleanContext = fixtureContext({
      readings: [reading('coolant_temp', 88, '°C'), reading('battery_voltage', 12.6, 'V'), reading('engine_rpm', 780, 'tr/min'), reading('long_fuel_trim_b1', 2.1, '%')],
      dtcs: [],
      source: 'obd',
    });
    const report = buildInspectionReport(cleanContext, engine.analyze(cleanContext), {});
    expect(report.scores.overall).toBeGreaterThanOrEqual(70);
    expect(report.redFlags).toHaveLength(0);
    const text = `${report.notes.join(' ')} ${report.checklist.map((i) => i.detail ?? '').join(' ')}`.toLowerCase();
    expect(text).not.toContain('garantie de bon achat');
  });
});
