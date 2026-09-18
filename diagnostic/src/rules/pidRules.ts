/**
 * XAMOTO — Règles fondées sur les données mesurées (§8, §12, §33).
 *
 * Ces règles peuvent CONFIRMER une OBSERVATION (une température mesurée à
 * 114 °C est un fait), mais jamais une CAUSE : une cause ne devient
 * « confirmée » que par un test guidé ou une corrélation forte explicitée.
 *
 * Toute valeur non supportée par le véhicule est ignorée — jamais traitée
 * comme normale (§8, §16).
 */
import type { CertaintyLevel } from '@xamoto/shared';
import type { DiagnosticContext, ReadingInput, Rule, RuleEffect } from './types.js';
import { pidEvidence } from './types.js';

const SOURCE_SAE = 'src_sae_j1979';
const SOURCE_PRACTICE = 'src_xamoto_practice';

const get = (ctx: DiagnosticContext, key: string): ReadingInput | null => {
  const r = ctx.readings.find((x) => x.key === key);
  if (!r || !r.supported || r.value === null) return null;
  return r;
};

/** Statistiques d'une série de mesures. */
const stats = (series?: number[]): { mean: number; std: number; min: number; max: number; amplitude: number } | null => {
  const values = (series ?? []).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length < 3) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { mean, std: Math.sqrt(variance), min, max, amplitude: max - min };
};

const engineRunning = (ctx: DiagnosticContext): boolean => {
  const rpm = get(ctx, 'engine_rpm');
  return rpm !== null && (rpm.value as number) > 350;
};

/** Réparation déjà effectuée pour cette cause, code disparu : indice d'exclusion. */
const repairedSuccessfully = (ctx: DiagnosticContext, causeKey: string, code: string): boolean => {
  const repairs = ctx.history?.repairs ?? [];
  if (repairs.length === 0) return false;
  const codes = new Set(ctx.dtcs.map((d) => d.code));
  if (codes.has(code)) return false;
  const keywords: Record<string, string[]> = {
    battery_worn: ['batterie'],
    alternator_weak: ['alternateur'],
    thermostat_stuck_open: ['thermostat'],
    o2_upstream_faulty: ['sonde o2', "sonde d'oxygène"],
    ignition_coil_1: ['bobine'],
    spark_plug_1: ['bougie'],
    fuel_filter_clogged: ['filtre à carburant'],
    fuel_cap_seal: ['bouchon'],
    egr_clogged: ['egr'],
  };
  const words = keywords[causeKey];
  if (!words) return false;
  return repairs.some((r) => words.some((w) => r.description.toLowerCase().includes(w)));
};

export const PID_RULES: Rule[] = [
  /* ─────────────────────────── Température moteur ─────────────────────────── */
  {
    id: 'rule_coolant_overtemp',
    domain: 'mesure',
    titleFr: 'Température du liquide de refroidissement élevée',
    titleEn: 'High coolant temperature',
    sourceId: SOURCE_PRACTICE,
    applies: (ctx) => {
      const t = get(ctx, 'coolant_temp');
      return t !== null && (t.value as number) >= 105;
    },
    apply: (ctx) => {
      const t = get(ctx, 'coolant_temp') as ReadingInput;
      const value = t.value as number;
      const critical = value >= 112;
      const effects: RuleEffect[] = [
        {
          kind: 'finding',
          finding: {
            kind: 'pid_anomaly',
            titleFr: `Température moteur élevée : ${value} °C mesuré`,
            titleEn: `High engine temperature: ${value} °C measured`,
            detailFr:
              'La mesure est un fait : le moteur dépasse la plage de fonctionnement normale. L’ORIGINE de cette surchauffe n’est pas encore établie — plusieurs causes restent possibles et un test est nécessaire.',
            detailEn:
              'The measurement is a fact: the engine exceeds the normal operating range. The ORIGIN of this overheating is not yet established — several causes remain possible and a test is required.',
            certainty: 'confirmed',
            safety: critical ? 'critical' : 'important',
            evidence: [pidEvidence(t)],
            origin: t.origin,
          },
        },
        {
          kind: 'safety',
          level: critical ? 'critical' : 'important',
          reasonFr: critical
            ? `Température moteur mesurée à ${value} °C : risque de dommage mécanique sévère. Arrêt du moteur et refroidissement recommandés avant de continuer.`
            : `Température moteur mesurée à ${value} °C, au-dessus de la plage normale.`,
          reasonEn: critical
            ? `Measured engine temperature of ${value} °C: risk of severe mechanical damage. Stopping the engine and cooling down is recommended.`
            : `Measured engine temperature of ${value} °C, above the normal range.`,
          evidence: [pidEvidence(t)],
        },
      ];
      const candidates: Array<[string, string, string, number]> = [
        ['coolant_level_low', 'Niveau de liquide de refroidissement insuffisant', 'Low coolant level', 0.16],
        ['fan_not_working', 'Ventilateur de refroidissement inopérant', 'Cooling fan not working', 0.1],
        ['thermostat_stuck_closed', 'Thermostat bloqué fermé', 'Thermostat stuck closed', 0.1],
        ['water_pump_weak', 'Pompe à eau faible', 'Weak water pump', 0.12],
        ['radiator_clogged', 'Radiateur obstrué ou entartré', 'Blocked or clogged radiator', 0.14],
        ['head_gasket', 'Joint de culasse', 'Head gasket', 0.08],
      ];
      for (const [key, fr, en, delta] of candidates) {
        effects.push({
          kind: 'cause',
          cause: {
            causeKey: key,
            labelFr: fr,
            labelEn: en,
            delta,
            weight: 'measured',
            reasonFr: `Température mesurée à ${value} °C : cette cause est compatible avec l’observation (elle ne la prouve pas).`,
            reasonEn: `Measured temperature ${value} °C: this cause is compatible with the observation (it does not prove it).`,
            evidence: [pidEvidence(t)],
          },
        });
      }
      effects.push(
        {
          kind: 'test',
          testKey: 'test_coolant_level',
          priority: 1,
          reasonFr: 'Premier contrôle à effectuer, moteur froid, pour vérifier le niveau et l’état du liquide.',
          reasonEn: 'First check, with a cold engine, to verify coolant level and condition.',
          forCause: 'coolant_level_low',
        },
        {
          kind: 'test',
          testKey: 'test_fan_operation',
          priority: 2,
          reasonFr: 'Vérifier que le ventilateur se déclenche : cause fréquente et peu coûteuse.',
          reasonEn: 'Check that the fan starts: a frequent and low-cost cause.',
          forCause: 'fan_not_working',
        },
        {
          kind: 'test',
          testKey: 'test_combustion_gases_coolant',
          priority: 4,
          reasonFr: 'À réaliser uniquement moteur froid, pour confirmer ou écarter un joint de culasse.',
          reasonEn: 'Only with a cold engine, to confirm or rule out a head gasket.',
          forCause: 'head_gasket',
        },
      );
      return effects;
    },
  },
  {
    id: 'rule_warm_up_incomplete',
    domain: 'mesure',
    titleFr: 'Moteur qui n’atteint pas sa température de fonctionnement',
    titleEn: 'Engine not reaching operating temperature',
    sourceId: SOURCE_SAE,
    applies: (ctx) => {
      const t = get(ctx, 'coolant_temp');
      const runtime = get(ctx, 'runtime_since_start');
      const ambient = get(ctx, 'ambient_temp');
      if (!t || !runtime) return false;
      const ambientValue = ambient?.value ?? 25;
      return (t.value as number) < 65 && (runtime.value as number) > 360 && ambientValue > 12;
    },
    apply: (ctx) => {
      const t = get(ctx, 'coolant_temp') as ReadingInput;
      const runtime = get(ctx, 'runtime_since_start') as ReadingInput;
      return [
        {
          kind: 'finding',
          finding: {
            kind: 'pid_anomaly',
            titleFr: `Température moteur encore basse (${t.value} °C) après ${Math.round((runtime.value as number) / 60)} minutes`,
            titleEn: `Engine still cool (${t.value} °C) after ${Math.round((runtime.value as number) / 60)} minutes`,
            detailFr:
              'La montée en température est plus lente qu’attendu. Cela peut venir du thermostat, d’un usage à l’arrêt, ou d’un temps froid. Un test de montée en température est nécessaire avant de conclure.',
            detailEn:
              'Warm-up is slower than expected. This may come from the thermostat, idling use, or cold weather. A warm-up test is required before concluding.',
            certainty: 'strongly_compatible',
            safety: 'attention',
            evidence: [pidEvidence(t), pidEvidence(runtime)],
            origin: t.origin,
          },
        },
        {
          kind: 'cause',
          cause: {
            causeKey: 'thermostat_stuck_open',
            labelFr: 'Thermostat bloqué ouvert',
            labelEn: 'Thermostat stuck open',
            delta: 0.28,
            weight: 'measured',
            reasonFr: `Température de ${t.value} °C après ${Math.round((runtime.value as number) / 60)} min de fonctionnement : le thermostat est la cause la plus fréquente de ce profil, sans être prouvée.`,
            reasonEn: `Temperature of ${t.value} °C after ${Math.round((runtime.value as number) / 60)} min: the thermostat is the most frequent cause of this profile, without being proven.`,
            evidence: [pidEvidence(t)],
            confirmedByTest: 'test_warm_up_curve',
            parts: ['thermostat'],
          },
        },
        { kind: 'test', testKey: 'test_warm_up_curve', priority: 1, reasonFr: 'Suivre la courbe de montée en température pour trancher.', reasonEn: 'Follow the warm-up curve to decide.', forCause: 'thermostat_stuck_open' },
        { kind: 'test', testKey: 'test_coolant_sensor_compare', priority: 3, reasonFr: 'Vérifier que la sonde de température ne fausse pas la lecture.', reasonEn: 'Verify the temperature sensor is not corrupting the reading.', forCause: 'coolant_temp_sensor_faulty' },
      ];
    },
  },

  /* ───────────────────────────── Tension / charge ─────────────────────────── */
  {
    id: 'rule_charging_voltage_low',
    domain: 'mesure',
    titleFr: 'Tension de charge insuffisante',
    titleEn: 'Insufficient charging voltage',
    sourceId: SOURCE_PRACTICE,
    applies: (ctx) => {
      const v = get(ctx, 'battery_voltage');
      return engineRunning(ctx) && v !== null && (v.value as number) < 13.0;
    },
    apply: (ctx) => {
      const v = get(ctx, 'battery_voltage') as ReadingInput;
      return [
        {
          kind: 'finding',
          finding: {
            kind: 'pid_anomaly',
            titleFr: `Tension de charge basse : ${v.value} V moteur tournant`,
            titleEn: `Low charging voltage: ${v.value} V with engine running`,
            detailFr:
              'Moteur tournant, la tension devrait se situer nettement au-dessus de la tension de repos. La mesure indique que la charge est insuffisante : l’origine (batterie, alternateur, courroie, connexions) reste à déterminer.',
            detailEn:
              'With the engine running, voltage should be clearly above rest voltage. The measurement indicates insufficient charging: the origin (battery, alternator, belt, connections) remains to be determined.',
            certainty: 'confirmed',
            safety: 'important',
            evidence: [pidEvidence(v)],
            origin: v.origin,
          },
        },
        {
          kind: 'cause',
          cause: { causeKey: 'alternator_weak', labelFr: 'Alternateur faible ou défaillant', labelEn: 'Weak or failed alternator', delta: 0.32, weight: 'measured', reasonFr: `Tension mesurée ${v.value} V moteur tournant.`, reasonEn: `Measured voltage ${v.value} V with engine running.`, evidence: [pidEvidence(v)], confirmedByTest: 'test_charging_voltage', parts: ['alternateur'] },
        },
        {
          kind: 'cause',
          cause: { causeKey: 'battery_worn', labelFr: 'Batterie en fin de vie', labelEn: 'Battery at end of life', delta: 0.2, weight: 'measured', reasonFr: 'Une batterie très faible peut absorber la charge et fausser la mesure : à vérifier en premier.', reasonEn: 'A very weak battery can absorb charge and corrupt the measurement: check it first.', confirmedByTest: 'test_battery_rest_voltage', parts: ['batterie'] },
        },
        {
          kind: 'cause',
          cause: { causeKey: 'belt_tension', labelFr: 'Courroie d’accessoires détendue', labelEn: 'Loose accessory belt', delta: 0.14, weight: 'documented', reasonFr: 'Cause courante d’une charge insuffisante, notamment par temps chaud.', reasonEn: 'Common cause of insufficient charging, especially in hot weather.', parts: ['courroie_accessoires'] },
        },
        { kind: 'test', testKey: 'test_charging_voltage', priority: 1, reasonFr: 'Mesurer la tension aux bornes moteur tournant, avec et sans consommateurs.', reasonEn: 'Measure voltage at the battery with the engine running, with and without consumers.', forCause: 'alternator_weak' },
        { kind: 'test', testKey: 'test_battery_rest_voltage', priority: 2, reasonFr: 'Écarter d’abord une batterie insuffisamment chargée.', reasonEn: 'First rule out an undercharged battery.', forCause: 'battery_worn' },
      ];
    },
  },
  {
    id: 'rule_rest_voltage_low',
    domain: 'mesure',
    titleFr: 'Tension de repos basse',
    titleEn: 'Low rest voltage',
    sourceId: SOURCE_PRACTICE,
    applies: (ctx) => {
      const v = get(ctx, 'battery_voltage');
      return !engineRunning(ctx) && v !== null && (v.value as number) < 12.2;
    },
    apply: (ctx) => {
      const v = get(ctx, 'battery_voltage') as ReadingInput;
      return [
        {
          kind: 'finding',
          finding: {
            kind: 'pid_anomaly',
            titleFr: `Tension de repos basse : ${v.value} V`,
            titleEn: `Low rest voltage: ${v.value} V`,
            detailFr:
              'Contact mis sans démarrage, la tension mesurée est basse. Cela peut correspondre à une batterie insuffisamment chargée ou vieillissante.',
            detailEn:
              'Ignition on without starting, measured voltage is low. This may correspond to an undercharged or ageing battery.',
            certainty: 'confirmed',
            safety: 'attention',
            evidence: [pidEvidence(v)],
            origin: v.origin,
          },
        },
        { kind: 'cause', cause: { causeKey: 'battery_worn', labelFr: 'Batterie insuffisamment chargée ou en fin de vie', labelEn: 'Undercharged or ageing battery', delta: 0.34, weight: 'measured', reasonFr: `Tension de repos mesurée à ${v.value} V.`, reasonEn: `Measured rest voltage ${v.value} V.`, evidence: [pidEvidence(v)], confirmedByTest: 'test_battery_rest_voltage', parts: ['batterie'] } },
        { kind: 'cause', cause: { causeKey: 'parasitic_drain', labelFr: 'Consommateur parasite à l’arrêt', labelEn: 'Parasitic drain when parked', delta: 0.12, weight: 'documented', reasonFr: 'Une batterie qui se vide à l’arrêt peut aussi produire une tension basse. Test de décharge à prévoir.', reasonEn: 'A battery draining while parked can also produce low voltage. Drain test required.', confirmedByTest: 'test_parasitic_drain' } },
        { kind: 'test', testKey: 'test_battery_rest_voltage', priority: 2, reasonFr: 'Confirmer la mesure de tension de repos après repos complet.', reasonEn: 'Confirm rest voltage after a full rest period.', forCause: 'battery_worn' },
        { kind: 'test', testKey: 'test_charging_voltage', priority: 1, reasonFr: 'Vérifier si le véhicule recharge correctement cette batterie.', reasonEn: 'Check whether the vehicle correctly charges this battery.', forCause: 'alternator_weak' },
      ];
    },
  },
  {
    id: 'rule_charging_voltage_high',
    domain: 'mesure',
    titleFr: 'Tension de charge trop élevée',
    titleEn: 'Charging voltage too high',
    sourceId: SOURCE_PRACTICE,
    applies: (ctx) => {
      const v = get(ctx, 'battery_voltage');
      return engineRunning(ctx) && v !== null && (v.value as number) > 14.9;
    },
    apply: (ctx) => {
      const v = get(ctx, 'battery_voltage') as ReadingInput;
      return [
        { kind: 'finding', finding: { kind: 'pid_anomaly', titleFr: `Tension de charge élevée : ${v.value} V`, titleEn: `High charging voltage: ${v.value} V`, detailFr: 'Une tension de charge trop élevée peut endommager la batterie et les équipements électroniques.', detailEn: 'A charging voltage that is too high can damage the battery and electronic equipment.', certainty: 'confirmed', safety: 'important', evidence: [pidEvidence(v)], origin: v.origin } },
        { kind: 'cause', cause: { causeKey: 'alternator_regulator', labelFr: 'Régulateur d’alternateur défaillant', labelEn: 'Faulty alternator regulator', delta: 0.4, weight: 'measured', reasonFr: `Tension mesurée ${v.value} V moteur tournant.`, reasonEn: `Measured voltage ${v.value} V with engine running.`, confirmedByTest: 'test_charging_voltage', parts: ['alternateur'] } },
        { kind: 'safety', level: 'important', reasonFr: 'Surcharge électrique : faire contrôler le circuit de charge rapidement.', reasonEn: 'Electrical overload: have the charging circuit checked promptly.' },
        { kind: 'test', testKey: 'test_charging_voltage', priority: 1, reasonFr: 'Confirmer la tension de charge dans plusieurs conditions.', reasonEn: 'Confirm charging voltage under several conditions.', forCause: 'alternator_regulator' },
      ];
    },
  },

  /* ───────────────────────────── Mélange air/carburant ──────────────────── */
  {
    id: 'rule_fuel_trim_lean',
    domain: 'mesure',
    titleFr: 'Correction carburant indiquant un mélange pauvre',
    titleEn: 'Fuel trim indicating a lean mixture',
    sourceId: SOURCE_SAE,
    applies: (ctx) => {
      const lt = get(ctx, 'long_fuel_trim_b1');
      const st = get(ctx, 'short_fuel_trim_b1');
      const value = lt?.value ?? st?.value ?? null;
      return value !== null && (value as number) > 14;
    },
    apply: (ctx) => {
      const lt = get(ctx, 'long_fuel_trim_b1') ?? (get(ctx, 'short_fuel_trim_b1') as ReadingInput);
      const value = lt.value as number;
      const strong = value > 24;
      const certainty: CertaintyLevel = strong ? 'strongly_compatible' : 'possible';
      return [
        {
          kind: 'finding',
          finding: {
            kind: 'pid_anomaly',
            titleFr: `Correction carburant en butée positive : ${value} %`,
            titleEn: `Fuel trim at positive limit: ${value} %`,
            detailFr:
              'Le calculateur ajoute du carburant au maximum pour compenser trop d’air : un mélange pauvre est très probable. La CAUSE de cette entrée d’air ou de ce manque de carburant reste à déterminer.',
            detailEn:
              'The ECU adds fuel at its limit to compensate for excess air: a lean mixture is very likely. The CAUSE of this air entry or fuel shortage remains to be determined.',
            certainty,
            safety: 'attention',
            evidence: [pidEvidence(lt)],
            origin: lt.origin,
          },
        },
        { kind: 'cause', cause: { causeKey: 'vacuum_leak', labelFr: 'Prise d’air à l’admission', labelEn: 'Intake air leak', delta: strong ? 0.34 : 0.24, weight: 'measured', reasonFr: `Correction positive de ${value} % : la prise d’air est la cause la plus fréquente de ce profil.`, reasonEn: `Positive trim of ${value} %: an air leak is the most frequent cause of this profile.`, evidence: [pidEvidence(lt)], confirmedByTest: 'test_vacuum_leak', parts: ['joint_admission', 'durite_admission'] } },
        { kind: 'cause', cause: { causeKey: 'fuel_pressure_low', labelFr: 'Pression de carburant insuffisante', labelEn: 'Insufficient fuel pressure', delta: 0.2, weight: 'measured', reasonFr: 'Un manque de carburant produit le même profil qu’une prise d’air.', reasonEn: 'A fuel shortage produces the same profile as an air leak.', confirmedByTest: 'test_fuel_pressure', parts: ['filtre_carburant', 'pompe_carburant'] } },
        { kind: 'cause', cause: { causeKey: 'maf_dirty', labelFr: 'Capteur de débit d’air sous-estimant le débit', labelEn: 'MAF sensor under-reporting flow', delta: 0.14, weight: 'measured', reasonFr: 'Un capteur encrassé peut également produire une correction positive.', reasonEn: 'A dirty sensor can also produce a positive trim.', confirmedByTest: 'test_maf_reading', parts: ['capteur_debit_air'] } },
        { kind: 'test', testKey: 'test_vacuum_leak', priority: 1, reasonFr: 'La prise d’air se teste facilement et sa réparation est peu coûteuse.', reasonEn: 'An air leak is easy to test and cheap to repair.', forCause: 'vacuum_leak' },
        { kind: 'test', testKey: 'test_fuel_pressure', priority: 2, reasonFr: 'Vérifier l’alimentation en carburant (filtre, pompe).', reasonEn: 'Verify fuel supply (filter, pump).', forCause: 'fuel_pressure_low' },
      ];
    },
  },
  {
    id: 'rule_fuel_trim_rich',
    domain: 'mesure',
    titleFr: 'Correction carburant indiquant un mélange riche',
    titleEn: 'Fuel trim indicating a rich mixture',
    sourceId: SOURCE_SAE,
    applies: (ctx) => {
      const lt = get(ctx, 'long_fuel_trim_b1');
      const st = get(ctx, 'short_fuel_trim_b1');
      const value = lt?.value ?? st?.value ?? null;
      return value !== null && (value as number) < -14;
    },
    apply: (ctx) => {
      const lt = get(ctx, 'long_fuel_trim_b1') ?? (get(ctx, 'short_fuel_trim_b1') as ReadingInput);
      const value = lt.value as number;
      return [
        { kind: 'finding', finding: { kind: 'pid_anomaly', titleFr: `Correction carburant fortement négative : ${value} %`, titleEn: `Strongly negative fuel trim: ${value} %`, detailFr: 'Le calculateur retire du carburant au maximum : un mélange trop riche est probable.', detailEn: 'The ECU removes fuel at its limit: an overly rich mixture is likely.', certainty: 'strongly_compatible', safety: 'attention', evidence: [pidEvidence(lt)], origin: lt.origin } },
        { kind: 'cause', cause: { causeKey: 'injector_leaking', labelFr: 'Injecteur qui fuit', labelEn: 'Leaking injector', delta: 0.26, weight: 'measured', reasonFr: `Correction négative de ${value} %.`, reasonEn: `Negative trim of ${value} %.`, confirmedByTest: 'test_injector_balance', parts: ['injecteur'] } },
        { kind: 'cause', cause: { causeKey: 'fuel_pressure_high', labelFr: 'Pression de carburant trop élevée', labelEn: 'Fuel pressure too high', delta: 0.2, weight: 'measured', reasonFr: 'Une pression excessive enrichit le mélange.', reasonEn: 'Excessive pressure enriches the mixture.', confirmedByTest: 'test_fuel_pressure' } },
        { kind: 'cause', cause: { causeKey: 'o2_sensor_biased', labelFr: 'Sonde O2 amont faussée', labelEn: 'Biased upstream O2 sensor', delta: 0.16, weight: 'measured', reasonFr: 'Une sonde bloquée haute fait croire au calculateur que le mélange est pauvre.', reasonEn: 'A sensor stuck high makes the ECU believe the mixture is lean.', confirmedByTest: 'test_o2_sensor_activity', parts: ['sonde_o2_amont'] } },
        { kind: 'test', testKey: 'test_injector_balance', priority: 2, reasonFr: 'Comparer les injecteurs.', reasonEn: 'Compare injectors.', forCause: 'injector_leaking' },
        { kind: 'test', testKey: 'test_fuel_pressure', priority: 1, reasonFr: 'Contrôler la pression de carburant.', reasonEn: 'Check fuel pressure.', forCause: 'fuel_pressure_high' },
      ];
    },
  },

  /* ───────────────────────────── Sonde O2 / activité ────────────────────── */
  {
    id: 'rule_o2_no_activity',
    domain: 'mesure',
    titleFr: 'Sonde O2 amont sans variation mesurable',
    titleEn: 'Upstream O2 sensor with no measurable variation',
    sourceId: SOURCE_SAE,
    applies: (ctx) => {
      const o2 = get(ctx, 'o2_b1s1_voltage');
      if (!o2) return false;
      const s = stats(o2.series);
      return s !== null && s.std < 0.015 && engineRunning(ctx);
    },
    apply: (ctx) => {
      const o2 = get(ctx, 'o2_b1s1_voltage') as ReadingInput;
      const s = stats(o2.series) as NonNullable<ReturnType<typeof stats>>;
      return [
        {
          kind: 'finding',
          finding: {
            kind: 'pid_anomaly',
            titleFr: `Sonde O2 amont figée à ${s.mean.toFixed(2)} V sur ${o2.series?.length} relevés`,
            titleEn: `Upstream O2 sensor fixed at ${s.mean.toFixed(2)} V over ${o2.series?.length} samples`,
            detailFr:
              'Une sonde amont saine oscille. Une tension quasi constante sur plusieurs relevés successifs rend la sonde suspecte, mais d’autres causes (mélange, échappement, câblage) doivent être vérifiées.',
            detailEn:
              'A healthy upstream sensor oscillates. A nearly constant voltage over several samples makes the sensor suspect, but other causes (mixture, exhaust, wiring) must be checked.',
            certainty: 'strongly_compatible',
            safety: 'attention',
            evidence: [pidEvidence(o2)],
            origin: o2.origin,
          },
        },
        { kind: 'cause', cause: { causeKey: 'o2_upstream_faulty', labelFr: 'Sonde O2 amont en fin de vie', labelEn: 'Upstream O2 sensor at end of life', delta: 0.34, weight: 'measured', reasonFr: `Variation quasi nulle (écart-type ${s.std.toFixed(3)} V) sur ${o2.series?.length} relevés.`, reasonEn: `Near-zero variation (standard deviation ${s.std.toFixed(3)} V) over ${o2.series?.length} samples.`, evidence: [pidEvidence(o2)], confirmedByTest: 'test_o2_sensor_activity', parts: ['sonde_o2_amont'] } },
        { kind: 'cause', cause: { causeKey: 'exhaust_leak_before_o2', labelFr: 'Fuite d’échappement avant la sonde', labelEn: 'Exhaust leak before the sensor', delta: 0.14, weight: 'documented', reasonFr: 'Une fuite en amont fausse aussi la mesure de la sonde.', reasonEn: 'An upstream leak also corrupts sensor measurement.', confirmedByTest: 'test_exhaust_leak' } },
        { kind: 'test', testKey: 'test_o2_sensor_activity', priority: 1, reasonFr: 'Confirmer l’absence d’activité par un relevé en temps réel moteur chaud.', reasonEn: 'Confirm the lack of activity with a live reading on a warm engine.', forCause: 'o2_upstream_faulty' },
        { kind: 'test', testKey: 'test_exhaust_leak', priority: 3, reasonFr: 'Vérifier l’étanchéité avant la sonde.', reasonEn: 'Check sealing upstream of the sensor.', forCause: 'exhaust_leak_before_o2' },
      ];
    },
  },

  /* ───────────────────────────── Stabilité du ralenti ───────────────────── */
  {
    id: 'rule_rpm_unstable',
    domain: 'mesure',
    titleFr: 'Régime moteur instable au ralenti',
    titleEn: 'Unstable idle speed',
    sourceId: SOURCE_SAE,
    applies: (ctx) => {
      const rpm = get(ctx, 'engine_rpm');
      if (!rpm) return false;
      const s = stats(rpm.series);
      const speed = get(ctx, 'vehicle_speed');
      const stopped = speed === null || (speed.value as number) < 3;
      return s !== null && stopped && (rpm.value as number) < 1200 && s.std > 35;
    },
    apply: (ctx) => {
      const rpm = get(ctx, 'engine_rpm') as ReadingInput;
      const s = stats(rpm.series) as NonNullable<ReturnType<typeof stats>>;
      const misfireCodes = ctx.dtcs.filter((d) => /^P030[0-9]$/.test(d.code)).map((d) => d.code);
      const effects: RuleEffect[] = [
        {
          kind: 'finding',
          finding: {
            kind: 'pid_anomaly',
            titleFr: `Régime instable au ralenti (variation de ${Math.round(s.amplitude)} tr/min)`,
            titleEn: `Unstable idle (variation of ${Math.round(s.amplitude)} rpm)`,
            detailFr:
              'La mesure montre une instabilité réelle du ralenti. Elle est compatible avec des ratés d’allumage, une prise d’air ou un problème d’injection, mais ne permet pas de choisir entre ces causes.',
            detailEn:
              'The measurement shows real idle instability. It is compatible with misfires, an air leak or an injection problem, but does not allow choosing between these causes.',
            certainty: 'confirmed',
            safety: 'attention',
            evidence: [pidEvidence(rpm), ...(misfireCodes.length ? [{ kind: 'dtc' as const, ref: misfireCodes[0] as string, label: 'Codes de ratés présents' }] : [])],
            origin: rpm.origin,
          },
        },
        { kind: 'cause', cause: { causeKey: 'vacuum_leak', labelFr: 'Prise d’air à l’admission', labelEn: 'Intake air leak', delta: 0.16, weight: 'measured', reasonFr: 'Une prise d’air déstabilise le ralenti.', reasonEn: 'An air leak destabilises idle.', confirmedByTest: 'test_vacuum_leak' } },
        { kind: 'cause', cause: { causeKey: 'injectors_clogged', labelFr: 'Injecteurs encrassés', labelEn: 'Clogged injectors', delta: 0.14, weight: 'measured', reasonFr: 'Un débit d’injecteur irrégulier déstabilise le ralenti.', reasonEn: 'Irregular injector flow destabilises idle.', confirmedByTest: 'test_injector_balance', parts: ['injecteur'] } },
        { kind: 'cause', cause: { causeKey: 'throttle_dirty', labelFr: 'Boîtier papillon encrassé', labelEn: 'Dirty throttle body', delta: 0.12, weight: 'documented', reasonFr: 'Un papillon encrassé provoque un ralenti instable, très fréquent en usage urbain poussiéreux.', reasonEn: 'A dirty throttle body causes unstable idle, very frequent in dusty urban use.', parts: ['boitier_papillon'] } },
        { kind: 'test', testKey: 'test_vacuum_leak', priority: 1, reasonFr: 'Rechercher une prise d’air.', reasonEn: 'Look for an air leak.', forCause: 'vacuum_leak' },
        { kind: 'test', testKey: 'test_ignition_spark_check', priority: 2, reasonFr: 'Contrôler l’allumage, cause fréquente d’instabilité.', reasonEn: 'Check ignition, a frequent cause of instability.' },
      ];
      if (misfireCodes.length > 0) {
        effects.push({ kind: 'certaintyCap', level: 'strongly_compatible', reasonFr: `Des codes de ratés d’allumage (${misfireCodes.join(', ')}) accompagnent cette instabilité : les deux informations se renforcent sans prouver la cause.`, reasonEn: `Misfire codes (${misfireCodes.join(', ')}) accompany this instability: both pieces of information reinforce each other without proving the cause.` });
      }
      return effects;
    },
  },
  {
    id: 'rule_engine_load_idle_high',
    domain: 'mesure',
    titleFr: 'Charge moteur élevée au ralenti',
    titleEn: 'High engine load at idle',
    sourceId: SOURCE_SAE,
    applies: (ctx) => {
      const load = get(ctx, 'engine_load');
      const speed = get(ctx, 'vehicle_speed');
      const stopped = speed === null || (speed.value as number) < 3;
      return load !== null && stopped && (load.value as number) > 55;
    },
    apply: (ctx) => {
      const load = get(ctx, 'engine_load') as ReadingInput;
      return [
        { kind: 'finding', finding: { kind: 'pid_anomaly', titleFr: `Charge moteur élevée au ralenti : ${load.value} %`, titleEn: `High engine load at idle: ${load.value} %`, detailFr: 'La charge mesurée au ralenti est élevée. Cela peut correspondre à un consommateur important (climatisation), à une charge mécanique ou à un calcul basé sur des capteurs incohérents.', detailEn: 'Measured load at idle is high. This may correspond to a heavy consumer (air conditioning), a mechanical load or a calculation based on inconsistent sensors.', certainty: 'possible', safety: 'normal', evidence: [pidEvidence(load)], origin: load.origin } },
        { kind: 'note', textFr: 'Un usage de climatisation par forte chaleur augmente sensiblement la charge au ralenti : ce point doit être pris en compte avant toute conclusion.', textEn: 'Air conditioning use in high heat significantly increases idle load: this must be considered before any conclusion.' },
      ];
    },
  },
  {
    id: 'rule_fuel_level_low',
    domain: 'mesure',
    titleFr: 'Niveau de carburant très bas',
    titleEn: 'Very low fuel level',
    sourceId: SOURCE_PRACTICE,
    applies: (ctx) => {
      const level = get(ctx, 'fuel_level');
      return level !== null && (level.value as number) < 10;
    },
    apply: (ctx) => {
      const level = get(ctx, 'fuel_level') as ReadingInput;
      return [
        { kind: 'note', textFr: `Niveau de carburant très bas (${level.value} %). Un niveau bas peut provoquer des ratés d’allumage et des à-coups par désamorçage : faites le plein avant d’interpréter ces symptômes.`, textEn: `Very low fuel level (${level.value} %). A low level can cause misfires and jerking through fuel starvation: refuel before interpreting these symptoms.`, level: 'attention' },
        { kind: 'certaintyCap', level: 'possible', reasonFr: 'Un niveau de carburant très bas peut produire à lui seul des symptômes de ratés : la certitude de toute conclusion sur l’allumage est plafonnée.', reasonEn: 'A very low fuel level can by itself produce misfire symptoms: the certainty of any ignition conclusion is capped.' },
      ];
    },
  },
  {
    id: 'rule_misfire_counter_active',
    domain: 'mesure',
    titleFr: 'Compteur de ratés non nul',
    titleEn: 'Non-zero misfire counter',
    sourceId: SOURCE_SAE,
    applies: (ctx) => {
      const m = get(ctx, 'misfire_count');
      return m !== null && (m.value as number) > 0;
    },
    apply: (ctx) => {
      const m = get(ctx, 'misfire_count') as ReadingInput;
      const flashing = ctx.symptoms.some((s) => s.present && s.key === 'warning_light_flashing');
      return [
        { kind: 'finding', finding: { kind: 'pid_anomaly', titleFr: `Ratés d’allumage mesurés : ${m.value} comptage(s)`, titleEn: `Measured misfires: ${m.value} count(s)`, detailFr: 'Le calculateur comptabilise réellement des ratés : l’observation est mesurée, la cause reste à déterminer.', detailEn: 'The ECU actually counts misfires: the observation is measured, the cause remains to be determined.', certainty: 'confirmed', safety: flashing ? 'critical' : 'important', evidence: [pidEvidence(m)], origin: m.origin } },
        ...(flashing
          ? [{ kind: 'safety' as const, level: 'critical' as const, reasonFr: 'Voyant moteur clignotant associé à des ratés mesurés : le carburant non brûlé peut détruire le catalyseur. Il est déconseillé de continuer à rouler.', reasonEn: 'Flashing check-engine light with measured misfires: unburnt fuel can destroy the catalyst. Continuing to drive is not advised.' }]
          : []),
      ];
    },
  },

  /* ───────────────────────────── Contexte africain (§39) ────────────────── */
  {
    id: 'rule_hot_ambient_context',
    domain: 'contexte',
    titleFr: 'Contexte climatique chaud',
    titleEn: 'Hot climate context',
    sourceId: 'src_african_context',
    applies: (ctx) => {
      const ambient = get(ctx, 'ambient_temp');
      const iat = get(ctx, 'intake_air_temp');
      const value = ambient?.value ?? iat?.value ?? null;
      return value !== null && (value as number) >= 38;
    },
    apply: (ctx) => {
      const ambient = get(ctx, 'ambient_temp') ?? (get(ctx, 'intake_air_temp') as ReadingInput);
      return [
        {
          kind: 'note',
          textFr: `Température extérieure élevée (${ambient.value} °C). Ce contexte augmente la sollicitation du refroidissement, de la batterie et de la climatisation. Il s’agit d’un CONTEXTE, jamais d’une cause : XAMOTO ne conclura pas une panne à partir du climat.`,
          textEn: `High outside temperature (${ambient.value} °C). This context increases the load on cooling, battery and air conditioning. It is CONTEXT, never a cause: XAMOTO will not conclude a fault from climate.`,
        },
      ];
    },
  },
  {
    id: 'rule_dust_context',
    domain: 'contexte',
    titleFr: 'Contexte poussiéreux (filtre à air)',
    titleEn: 'Dusty context (air filter)',
    sourceId: 'src_african_context',
    applies: (ctx) => {
      const maf = get(ctx, 'maf_air_flow');
      const load = get(ctx, 'engine_load');
      const rpm = get(ctx, 'engine_rpm');
      if (!maf || !rpm || !load) return false;
      // Débit d'air faible pour le régime et la charge : indice possible de filtre colmaté.
      const speed = rpm.value as number;
      const flow = maf.value as number;
      const expectedLow = (speed / 1000) * 1.6;
      return speed > 600 && flow < expectedLow * 0.75;
    },
    apply: (ctx) => {
      const maf = get(ctx, 'maf_air_flow') as ReadingInput;
      const rpm = get(ctx, 'engine_rpm') as ReadingInput;
      return [
        {
          kind: 'cause',
          cause: {
            causeKey: 'air_filter_clogged',
            labelFr: 'Filtre à air colmaté (usage poussiéreux)',
            labelEn: 'Clogged air filter (dusty use)',
            delta: 0.18,
            weight: 'measured',
            reasonFr: `Débit d’air mesuré (${maf.value} g/s) faible pour ${rpm.value} tr/min. Un filtre très colmaté est fréquent en environnement poussiéreux, mais cette seule mesure ne le prouve pas.`,
            reasonEn: `Measured air flow (${maf.value} g/s) low for ${rpm.value} rpm. A heavily clogged filter is frequent in dusty environments, but this single measurement does not prove it.`,
            evidence: [pidEvidence(maf)],
            parts: ['filtre_air'],
          },
        },
        { kind: 'test', testKey: 'test_maf_reading', priority: 3, reasonFr: 'Comparer le débit d’air mesuré au ralenti et en accélération avant de conclure.', reasonEn: 'Compare air flow at idle and during acceleration before concluding.', forCause: 'maf_dirty' },
      ];
    },
  },
];

export { repairedSuccessfully };
