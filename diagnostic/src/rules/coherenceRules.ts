/**
 * XAMOTO — Règles de cohérence et de contexte.
 *
 * Elles ne diagnostiquent rien : elles empêchent XAMOTO de conclure sur des
 * données incohérentes, insuffisantes, ou acquises dans de mauvaises conditions.
 * C'est le garde-fou du principe 4 (« toujours indiquer lorsque les données
 * sont insuffisantes »).
 */
import { MESSAGES } from '@xamoto/shared';
import type { Rule, RuleEffect } from './types.js';
import { pidEvidence } from './types.js';

const SOURCE_PRACTICE = 'src_xamoto_practice';

const supportedReadings = (ctx: Parameters<Rule['applies']>[0]) => ctx.readings.filter((r) => r.supported && r.value !== null);

export const ruleNoDataAtAll: Rule = {
  id: 'rule_no_data',
  domain: 'coherence',
  titleFr: 'Absence totale de données',
  titleEn: 'Total absence of data',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => supportedReadings(ctx).length === 0 && ctx.dtcs.length === 0,
  apply: () => [
    {
      kind: 'finding',
      finding: {
        kind: 'coherence',
        titleFr: 'Aucune donnée exploitable',
        titleEn: 'No usable data',
        detailFr: MESSAGES.insufficientDataFr,
        detailEn: MESSAGES.insufficientDataEn,
        certainty: 'unavailable',
        safety: 'normal',
        evidence: [],
        origin: 'unknown',
      },
    },
    { kind: 'certaintyCap', level: 'unavailable', reasonFr: 'Aucune donnée mesurée ni aucun code défaut n’est disponible.', reasonEn: 'No measured data and no fault code are available.' },
    { kind: 'missing', itemFr: 'Un scan OBD (moteur tournant et moteur chaud) ou la déclaration de symptômes', itemEn: 'An OBD scan (engine running and warm) or a declaration of symptoms', blocksConclusion: true },
  ],
};

export const ruleSimulationMode: Rule = {
  id: 'rule_simulation',
  domain: 'coherence',
  titleFr: 'Données issues du simulateur',
  titleEn: 'Data coming from the simulator',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => ctx.source === 'simulator' || supportedReadings(ctx).some((r) => r.origin === 'simulated'),
  apply: () => [
    {
      kind: 'finding',
      finding: {
        kind: 'coherence',
        titleFr: `${MESSAGES.simulationFr} — données simulées`,
        titleEn: `${MESSAGES.simulationEn} — simulated data`,
        detailFr: MESSAGES.simulationNoticeFr,
        detailEn: MESSAGES.simulationNoticeEn,
        certainty: 'possible',
        safety: 'normal',
        evidence: [],
        origin: 'simulated',
      },
    },
    {
      kind: 'note',
      textFr:
        'Cette analyse est pédagogique : les défauts et les mesures proviennent d’un scénario de simulation, pas de votre véhicule. Le raisonnement appliqué est identique à celui utilisé sur des données réelles.',
      textEn:
        'This analysis is educational: faults and measurements come from a simulation scenario, not from your vehicle. The reasoning applied is identical to the one used on real data.',
    },
  ],
};

export const ruleDataIncoherence: Rule = {
  id: 'rule_incoherence',
  domain: 'coherence',
  titleFr: 'Incohérence entre deux mesures',
  titleEn: 'Inconsistency between two measurements',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => {
    const rpm = ctx.readings.find((r) => r.key === 'engine_rpm');
    const speed = ctx.readings.find((r) => r.key === 'vehicle_speed');
    if (!rpm?.supported || !speed?.supported || rpm.value === null || speed.value === null) return false;
    return speed.value > 5 && rpm.value < 200;
  },
  apply: (ctx) => {
    const rpm = ctx.readings.find((r) => r.key === 'engine_rpm');
    const speed = ctx.readings.find((r) => r.key === 'vehicle_speed');
    return [
      {
        kind: 'finding',
        finding: {
          kind: 'coherence',
          titleFr: 'Données incohérentes : vitesse non nulle avec régime moteur nul',
          titleEn: 'Inconsistent data: non-zero speed with zero engine speed',
          detailFr:
            'Ces deux mesures ne peuvent pas être vraies simultanément sur un véhicule en fonctionnement normal. Cela indique une erreur de lecture (adaptateur, PID, véhicule en roue libre moteur coupé). Aucune conclusion technique ne sera tirée de ces données.',
          detailEn:
            'These two measurements cannot both be true on a normally operating vehicle. This indicates a reading error (adapter, PID, vehicle coasting with the engine off). No technical conclusion will be drawn from this data.',
          certainty: 'undeterminable',
          safety: 'attention',
          evidence: [rpm ? pidEvidence(rpm) : { kind: 'pid', ref: 'engine_rpm', label: 'régime' }, speed ? pidEvidence(speed) : { kind: 'pid', ref: 'vehicle_speed', label: 'vitesse' }],
          origin: 'measured',
        },
      },
      { kind: 'certaintyCap', level: 'possible', reasonFr: 'Incohérence détectée entre mesures : XAMOTO ne conclura pas sur ces données.', reasonEn: 'Inconsistency detected between measurements: XAMOTO will not conclude on this data.' },
    ];
  },
};

export const ruleColdEngineLimits: Rule = {
  id: 'rule_cold_engine',
  domain: 'coherence',
  titleFr: 'Mesures effectuées moteur froid',
  titleEn: 'Measurements taken with a cold engine',
  sourceId: 'src_sae_j1979',
  applies: (ctx) => {
    const coolant = ctx.readings.find((r) => r.key === 'coolant_temp');
    return coolant?.supported === true && coolant.value !== null && coolant.value < 60;
  },
  apply: (ctx => {
    const coolant = ctx.readings.find((r) => r.key === 'coolant_temp') as NonNullable<ReturnType<typeof ctx.readings.find>>;
    const hasTrimRules = ctx.readings.some((r) => r.key.startsWith('long_fuel_trim') || r.key.startsWith('short_fuel_trim'));
    const effects: RuleEffect[] = [
      {
        kind: 'note',
        textFr: `Mesures effectuées moteur froid (${coolant.value} °C). Les données de mélange et de dépollution ne sont interprétables qu’une fois le moteur chaud et en boucle fermée : un scan à chaud est nécessaire.`,
        textEn: `Measurements taken with a cold engine (${coolant.value} °C). Mixture and emission data can only be interpreted once the engine is warm and in closed loop: a warm scan is required.`,
        level: 'attention',
      },
      {
        kind: 'missing',
        itemFr: 'Un scan moteur chaud (température du liquide supérieure à environ 70 °C)',
        itemEn: 'A warm-engine scan (coolant temperature above about 70 °C)',
        blocksConclusion: true,
      },
    ];
    if (hasTrimRules) {
      effects.push({ kind: 'certaintyCap', level: 'possible', reasonFr: 'Moteur froid : les corrections de carburant mesurées à froid ne permettent pas de conclure.', reasonEn: 'Cold engine: fuel trims measured cold do not allow a conclusion.' });
    }
    return effects;
  }) as Rule['apply'],
};

export const ruleMissingCorePids: Rule = {
  id: 'rule_missing_pids',
  domain: 'coherence',
  titleFr: 'Mesures essentielles non disponibles',
  titleEn: 'Essential measurements not available',
  sourceId: SOURCE_PRACTICE,
  applies: (ctx) => {
    const required = ['engine_rpm', 'coolant_temp', 'battery_voltage'];
    return required.some((key) => {
      const r = ctx.readings.find((x) => x.key === key);
      return !r || !r.supported || r.value === null;
    });
  },
  apply: (ctx) => {
    const required: Array<[string, string, string]> = [
      ['engine_rpm', 'régime moteur', 'engine speed'],
      ['coolant_temp', 'température du liquide de refroidissement', 'coolant temperature'],
      ['battery_voltage', 'tension batterie', 'battery voltage'],
    ];
    const missing = required.filter(([key]) => {
      const r = ctx.readings.find((x) => x.key === key);
      return !r || !r.supported || r.value === null;
    });
    return [
      {
        kind: 'finding',
        finding: {
          kind: 'coherence',
          titleFr: `Mesure(s) non disponible(s) sur ce véhicule : ${missing.map((m) => m[1]).join(', ')}`,
          titleEn: `Measurement(s) not available on this vehicle: ${missing.map((m) => m[2]).join(', ')}`,
          detailFr:
            'XAMOTO ne remplace jamais une mesure absente par une valeur supposée. Le diagnostic se poursuivra sur les données réellement disponibles, avec un niveau de certitude plus faible.',
          detailEn:
            'XAMOTO never replaces a missing measurement with an assumed value. The diagnosis will continue on the data actually available, with a lower certainty level.',
          certainty: 'unavailable',
          safety: 'normal',
          evidence: [],
          origin: 'unknown',
        },
      },
      ...missing.map<RuleEffect>(([key, fr, en]) => ({
        kind: 'missing',
        itemFr: `Mesure « ${fr} » (PID ${key}) non fournie par ce véhicule ou non lue`,
        itemEn: `Measurement "${en}" (PID ${key}) not provided by this vehicle or not read`,
        blocksConclusion: false,
      })),
    ];
  },
};

export const ruleFreezeFrameContext: Rule = {
  id: 'rule_freeze_frame',
  domain: 'coherence',
  titleFr: 'Contexte du défaut (freeze frame)',
  titleEn: 'Fault context (freeze frame)',
  sourceId: 'src_sae_j1979',
  applies: (ctx) => ctx.dtcs.some((d) => d.freezeFrame && Object.keys(d.freezeFrame).length > 0),
  apply: (ctx) => {
    const effects: RuleEffect[] = [];
    for (const dtc of ctx.dtcs) {
      if (!dtc.freezeFrame) continue;
      const entries = Object.entries(dtc.freezeFrame).filter(([, v]) => v !== null && v !== undefined);
      if (entries.length === 0) continue;
      effects.push({
        kind: 'note',
        textFr: `Le calculateur a mémorisé le contexte du défaut ${dtc.code} au moment de son apparition : ${entries.map(([k, v]) => `${k} = ${v}`).join(', ')}. Comparer ces valeurs au fonctionnement actuel aide à reproduire le défaut.`,
        textEn: `The ECU stored the context of fault ${dtc.code} when it appeared: ${entries.map(([k, v]) => `${k} = ${v}`).join(', ')}. Comparing these values with current operation helps reproduce the fault.`,
      });
    }
    return effects;
  },
};

export const COHERENCE_RULES: Rule[] = [ruleNoDataAtAll, ruleSimulationMode, ruleDataIncoherence, ruleColdEngineLimits, ruleMissingCorePids, ruleFreezeFrameContext];
