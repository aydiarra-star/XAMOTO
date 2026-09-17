/**
 * XAMOTO — Fixtures de test.
 *
 * Objectif : construire des contextes de diagnostic réalistes et lisibles, sans
 * jamais dépendre d'une base de données ni d'un adaptateur. Un test doit pouvoir
 * dire exactement ce qu'il mesure.
 */
import { PID_BY_KEY } from '@xamoto/obd';
import type { DataOrigin, PidKey } from '@xamoto/shared';
import type { DiagnosticContext, DtcInput, ReadingInput } from '../src/rules/types.js';

/** Mesure construite à partir du dictionnaire de PID réel (jamais d'unité inventée). */
export function reading(
  key: PidKey,
  value: number | null,
  unit?: string,
  options: { origin?: DataOrigin; supported?: boolean; series?: number[]; condition?: ReadingInput['condition'] } = {},
): ReadingInput {
  const definition = PID_BY_KEY.get(key);
  if (!definition) throw new Error(`PID inconnu dans les fixtures : ${key}`);
  return {
    key,
    label: definition.labelFr,
    value,
    unit: unit ?? definition.unit,
    supported: options.supported ?? value !== null,
    origin: options.origin ?? 'measured',
    series: options.series,
    condition: options.condition ?? 'warm',
  };
}

/** PID déclaré non supporté par le véhicule : valeur absente, jamais zéro (§47-1). */
export function unsupportedReading(key: PidKey): ReadingInput {
  return { key, label: PID_BY_KEY.get(key)?.labelFr ?? key, value: null, unit: PID_BY_KEY.get(key)?.unit ?? '', supported: false, origin: 'unknown' };
}

export function dtc(code: string, options: Partial<DtcInput> = {}): DtcInput {
  return {
    code,
    status: options.status ?? 'stored',
    occurrences: options.occurrences ?? 1,
    origin: options.origin ?? 'measured',
    lastSeenAt: options.lastSeenAt ?? '2026-01-15T10:00:00.000Z',
    returnedAfterClear: options.returnedAfterClear,
    freezeFrame: options.freezeFrame,
  };
}

export function fixtureContext(overrides: Partial<DiagnosticContext> = {}): DiagnosticContext {
  return {
    vehicle: {
      id: 'veh_test',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2014,
      engine: '1.6 16v',
      fuelType: 'essence',
      odometerKm: 145000,
    },
    spec: null,
    readings: [],
    dtcs: [],
    symptoms: [],
    history: { previousScans: [], repairs: [] },
    source: 'obd',
    testResults: [],
    mode: 'standard',
    ...overrides,
  };
}
