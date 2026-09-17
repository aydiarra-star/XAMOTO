/**
 * XAMOTO — OBD : protocoles, trames et simulateur (§7, §30, §33, §47).
 *
 * Le codage des codes défaut est vérifié par aller-retour, le parsing des trames
 * sur des réponses réelles d'ELM327, et le simulateur sur ce qui le rend
 * acceptable : il est étiqueté, il est déterministe, et il ne prétend jamais
 * produire une donnée réelle.
 */
import { describe, expect, it } from 'vitest';
import {
  PID_BY_KEY,
  PID_BY_OBD,
  PID_DEFINITIONS,
  PROTOCOL_NAMES,
  SCENARIOS,
  SCENARIO_BY_ID,
  SimulatorAdapter,
  decodeDtcBytes,
  encodeDtcCode,
  extractBytes,
  isUnavailable,
  isValidDtc,
  parseDtcResponse,
  parseMode01,
  parseSupportedPids,
  protocolFromDpn,
} from '@xamoto/obd';

describe('codes défaut : codage et décodage (SAE J2012)', () => {
  it('décode les deux octets d’un code en clair', () => {
    // 0x04 0x20 → lettre P, chiffres 0-4-2-0 → P0420
    const decoded = decodeDtcBytes(0x04, 0x20);
    expect(decoded.code).toBe('P0420');
    expect(decoded.system).toBe('Groupe motopropulseur');
  });

  it('fait l’aller-retour sur les familles P, C, B et U', () => {
    for (const code of ['P0420', 'P0300', 'C1234', 'B1200', 'U0100']) {
      const bytes = encodeDtcCode(code);
      expect(bytes, `${code} n’a pas pu être encodé`).not.toBeNull();
      const [a, b] = bytes as [number, number];
      expect(decodeDtcBytes(a, b).code).toBe(code);
    }
  });

  it('refuse un code mal formé au lieu de le corriger', () => {
    for (const invalid of ['', 'X0420', 'P42', 'P04201', 'P04G0']) {
      expect(encodeDtcCode(invalid), `${invalid} aurait dû être refusé`).toBeNull();
      expect(isValidDtc(invalid)).toBe(false);
    }
    expect(isValidDtc('P0420')).toBe(true);
    expect(isValidDtc('u0100')).toBe(true);
  });
});

describe('trames DTC', () => {
  it('lit une réponse mode 03 contenant deux codes', () => {
    // 43 02 04 20 03 00 : mode 03, 2 codes, P0420 puis P0300.
    expect(parseDtcResponse('43 02 04 20 03 00')).toEqual(['P0420', 'P0300']);
  });

  it('ignore les emplacements vides (00 00) au lieu de produire P0000', () => {
    expect(parseDtcResponse('43 01 00 00 00 00')).toEqual([]);
  });

  it('supprime les doublons renvoyés par certains calculateurs', () => {
    expect(parseDtcResponse('43 02 04 20 04 20')).toEqual(['P0420']);
  });

  it('ne renvoie rien sur NO DATA', () => {
    expect(parseDtcResponse('NO DATA')).toEqual([]);
    expect(parseDtcResponse('')).toEqual([]);
  });
});

describe('dictionnaire de PID (J1979)', () => {
  it('contient les mesures indispensables au diagnostic', () => {
    for (const key of [
      'engine_rpm',
      'coolant_temp',
      'battery_voltage',
      'short_fuel_trim_b1',
      'long_fuel_trim_b1',
      'o2_b1s1_voltage',
      'maf_air_flow',
      'vehicle_speed',
    ]) {
      expect(PID_BY_KEY.has(key as never), `PID manquant : ${key}`).toBe(true);
    }
  });

  it('aucun doublon de clé ni de numéro OBD', () => {
    expect(PID_BY_KEY.size).toBe(PID_DEFINITIONS.length);
    expect(PID_BY_OBD.size).toBe(PID_DEFINITIONS.length);
  });

  it('chaque PID porte un libellé, une unité et une méthode de conversion', () => {
    for (const pid of PID_DEFINITIONS) {
      expect(pid.labelFr.length).toBeGreaterThan(2);
      expect(pid.labelEn.length).toBeGreaterThan(2);
      expect(typeof pid.unit).toBe('string');
      expect(typeof pid.decode).toBe('function');
      expect(pid.bytes).toBeGreaterThan(0);
    }
  });

  it('un octet « non disponible » (0xFF) n’est jamais décodé comme une valeur (§47-1)', () => {
    for (const pid of PID_DEFINITIONS) {
      const filled = new Array(pid.bytes).fill(0xff);
      expect(isUnavailable(filled), `${pid.key} : 0xFF aurait dû être « non disponible »`).toBe(true);
    }
  });
});

describe('trames ELM327 (couche isolée, §7)', () => {
  it('extrait les octets utiles et ignore les lignes de service', () => {
    expect(extractBytes('SEARCHING...\r41 0C 1A F8')).toEqual([0x41, 0x0c, 0x1a, 0xf8]);
    expect(extractBytes('OK')).toEqual([]);
  });

  it('lit une réponse de mode 01 avec son identifiant CAN', () => {
    const response = parseMode01('7E8 04 41 05 7B', '05');
    expect(response.ok).toBe(true);
    expect(response.bytes).toEqual([0x7b]);
  });

  it('signale une erreur plutôt qu’une valeur inventée', () => {
    for (const raw of ['NO DATA', 'UNABLE TO CONNECT', 'CAN ERROR']) {
      const response = parseMode01(raw, '05');
      expect(response.ok, `${raw} aurait dû être en erreur`).toBe(false);
      expect(response.bytes).toEqual([]);
      expect(response.error).toBeTruthy();
    }
  });

  it('déduit les PID supportés des masques 0100/0120', () => {
    const supported = parseSupportedPids({
      // 0x18 = 0b00011000 → les PID 04 et 05 sont annoncés supportés.
      '00': { raw: '41 00 18 00 00 00', at: '', bytes: [0x18, 0x00, 0x00, 0x00], ok: true },
      // Le masque 0120 couvre les PID 0x21 à 0x40 : le dernier bit vaut donc 0x40.
      '20': { raw: '41 20 00 00 00 01', at: '', bytes: [0x00, 0x00, 0x00, 0x01], ok: true },
    });
    expect([...supported].sort()).toEqual(['04', '05', '40']);
  });

  it('un masque illisible ne déclare aucun PID supporté', () => {
    expect(parseSupportedPids({ '00': { raw: '', at: '', bytes: [], ok: false } }).size).toBe(0);
  });

  it('nomme les protocoles usuels et rejette un identifiant inconnu', () => {
    expect(PROTOCOL_NAMES['6'] ?? Object.values(PROTOCOL_NAMES).join(' ')).toContain('ISO');
    expect(protocolFromDpn('A6')).toBeTruthy();
    expect(protocolFromDpn('ZZ')).toBeNull();
  });
});

describe('simulateur (§30, §31)', () => {
  it('propose huit scénarios documentés', () => {
    expect(SCENARIOS).toHaveLength(8);
    for (const scenario of SCENARIOS) {
      expect(scenario.labelFr.length).toBeGreaterThan(5);
      expect(scenario.labelEn.length).toBeGreaterThan(3);
      expect(scenario.descriptionFr.length).toBeGreaterThan(20);
      expect(SCENARIO_BY_ID.get(scenario.id)).toBe(scenario);
    }
  });

  it('chaque scénario décrit un véhicule de démonstration plausible', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.demoVehicle.brand.length).toBeGreaterThan(1);
      expect(scenario.demoVehicle.model.length).toBeGreaterThan(1);
      expect(scenario.demoVehicle.year).toBeGreaterThan(1990);
      expect(scenario.demoVehicle.fuelType).toBeTruthy();
    }
  });

  it('aucun code défaut de scénario n’est mal formé', () => {
    for (const scenario of SCENARIOS) {
      for (const dtc of scenario.dtcs) {
        expect(isValidDtc(dtc.code), `${scenario.id} : code invalide ${dtc.code}`).toBe(true);
      }
    }
  });

  it('le scan simulé annonce sa source et n’invente aucune donnée réelle', async () => {
    const adapter = new SimulatorAdapter({ scenario: 'engine_fault', seed: 7 });
    const snapshot = await adapter.scan();

    expect(snapshot.source).toBe('simulator');
    expect(snapshot.readings.length).toBeGreaterThan(5);
    for (const reading of snapshot.readings) {
      // §47-1 : un PID non supporté porte l'origine « unknown », pas « simulated ».
      expect(reading.origin, `${reading.key} : origine inattendue`).toBe(reading.supported ? 'simulated' : 'unknown');
    }
    for (const dtc of snapshot.dtcs) {
      expect(dtc.origin).toBe('simulated');
    }
    expect(snapshot.notes.some((note) => note.fr.includes('MODE SIMULATION'))).toBe(true);
  });

  it('un même scénario avec la même graine produit exactement les mêmes mesures', async () => {
    const first = await new SimulatorAdapter({ scenario: 'multiple_dtc', seed: 123, stepSeconds: 0 }).scan();
    const second = await new SimulatorAdapter({ scenario: 'multiple_dtc', seed: 123, stepSeconds: 0 }).scan();
    const values = (snapshot: typeof first) => snapshot.readings.map((r) => [r.key, r.value]);
    // Les horodatages diffèrent (ce sont des instants réels) : seules les mesures
    // doivent être reproductibles.
    expect(JSON.stringify(values(second))).toBe(JSON.stringify(values(first)));
    expect(JSON.stringify(second.dtcs.map((d) => d.code))).toBe(JSON.stringify(first.dtcs.map((d) => d.code)));
  });

  it('le scénario « plusieurs défauts » produit bien plusieurs codes', async () => {
    const snapshot = await new SimulatorAdapter({ scenario: 'multiple_dtc', seed: 5 }).scan();
    expect(snapshot.dtcs.length).toBeGreaterThan(1);
    expect(snapshot.milOn).toBe(true);
  });

  it('le scénario « moteur normal » ne produit aucun défaut', async () => {
    const snapshot = await new SimulatorAdapter({ scenario: 'normal_engine', seed: 5 }).scan();
    expect(snapshot.dtcs).toHaveLength(0);
    expect(snapshot.milOn).toBe(false);
  });

  it('l’effacement simulé ne dissimule pas la panne : le code revient', async () => {
    const adapter = new SimulatorAdapter({ scenario: 'engine_fault', seed: 3 });
    const before = await adapter.scan();
    const cleared = await adapter.clearDtcs();
    const after = await adapter.scan();
    expect(cleared.cleared).toBe(true);
    expect(cleared.noteFr).toContain('MODE SIMULATION');
    expect(after.dtcs.length).toBe(before.dtcs.length);
  });
});
