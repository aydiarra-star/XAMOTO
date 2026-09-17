/**
 * XAMOTO — Après réparation (§19).
 *
 * Fonction essentielle : l'utilisateur indique « J'ai effectué la réparation »,
 * XAMOTO relance un scan et COMPARE avant / après.
 *
 * Trois résultats possibles, et rien d'autre :
 *   – Problème probablement résolu
 *   – Problème toujours présent
 *   – Données insuffisantes pour confirmer
 *
 * XAMOTO ne dira jamais « c'est réparé » de façon définitive : un défaut peut
 * revenir après plusieurs cycles de conduite. C'est pourquoi la certitude
 * dépend du roulage effectué depuis la réparation.
 */
import type { DataOrigin, RepairVerification, SymptomInput } from '@xamoto/shared';
import type { DtcInput, ReadingInput } from '../rules/types.js';

export interface ScanSummary {
  sessionId: string;
  finishedAt: string;
  dtcCodes: string[];
  dtcs?: DtcInput[];
  readings: ReadingInput[];
  symptoms?: SymptomInput[];
  /** Kilométrage parcouru depuis la réparation (si connu). */
  kmSinceRepair?: number | null;
  /** Cycles de conduite complets effectués depuis la réparation. */
  driveCycles?: number | null;
}

export interface RepairComparisonInput {
  before: ScanSummary;
  after: ScanSummary;
  repairDescription: string;
  repairDate: string;
}

const valueOf = (readings: ReadingInput[], key: string): number | null => {
  const reading = readings.find((r) => r.key === key && r.supported);
  return reading?.value ?? null;
};

/** Une valeur s'est-elle rapprochée de la plage normale documentée ? */
function improved(key: string, before: ReadingInput[], after: ReadingInput[]): boolean {
  const b = before.find((r) => r.key === key);
  const a = after.find((r) => r.key === key);
  if (!b || !a || b.value === null || a.value === null) return false;
  const ref = a.ref ?? b.ref;
  if (!ref || (ref.normalMin === undefined && ref.normalMax === undefined)) return false;
  const distance = (value: number): number => {
    if (ref.normalMin !== undefined && value < ref.normalMin) return ref.normalMin - value;
    if (ref.normalMax !== undefined && value > ref.normalMax) return value - ref.normalMax;
    return 0;
  };
  return distance(a.value) < distance(b.value);
}

export function compareAfterRepair(input: RepairComparisonInput): RepairVerification {
  const { before, after, repairDescription, repairDate } = input;
  const dtcBefore = [...new Set(before.dtcCodes)];
  const dtcAfter = [...new Set(after.dtcCodes)];
  const dtcResolved = dtcBefore.filter((c) => !dtcAfter.includes(c));
  const dtcRemaining = dtcAfter.filter((c) => dtcBefore.includes(c));
  const dtcNew = dtcAfter.filter((c) => !dtcBefore.includes(c));

  const keys = ['coolant_temp', 'battery_voltage', 'long_fuel_trim_b1', 'short_fuel_trim_b1', 'o2_b1s1_voltage', 'o2_b1s2_voltage', 'engine_rpm', 'misfire_count', 'map_pressure', 'maf_air_flow'];
  const valuesChanged: RepairVerification['valuesChanged'] = [];
  for (const key of keys) {
    const b = valueOf(before.readings, key);
    const a = valueOf(after.readings, key);
    if (b === null || a === null) continue;
    const reading = after.readings.find((r) => r.key === key) ?? before.readings.find((r) => r.key === key);
    valuesChanged.push({
      key,
      label: reading?.label ?? key,
      before: b,
      after: a,
      unit: reading?.unit ?? '',
      improved: improved(key, before.readings, after.readings),
    });
  }

  const symptomsBefore = before.symptoms ?? [];
  const symptomsAfter = after.symptoms ?? [];

  /* ── Verdict ──────────────────────────────────────────────────────────── */
  const enoughDataAfter = after.readings.filter((r) => r.supported && r.value !== null).length >= 3 || after.dtcCodes.length > 0;
  const droveSince = (after.kmSinceRepair ?? 0) > 5 || (after.driveCycles ?? 0) >= 1;

  let verdict: RepairVerification['verdict'];
  if (!enoughDataAfter) {
    verdict = 'insufficient_data';
  } else if (dtcNew.length > 0) {
    verdict = 'new_issue';
  } else if (dtcRemaining.length > 0) {
    verdict = 'still_present';
  } else {
    verdict = 'resolved';
  }

  /* ── Certitude ────────────────────────────────────────────────────────── */
  let certainty: RepairVerification['certainty'];
  switch (verdict) {
    case 'insufficient_data':
      certainty = 'unavailable';
      break;
    case 'still_present':
    case 'new_issue':
      // Le défaut est là : l'information est mesurée, donc fiable.
      certainty = 'strongly_compatible';
      break;
    case 'resolved':
      // Un défaut effacé ne prouve rien tant que le véhicule n'a pas roulé :
      // certains défauts (catalyseur, EVAP, EGR) demandent plusieurs cycles.
      certainty = droveSince ? 'strongly_compatible' : 'possible';
      break;
    default:
      certainty = 'possible';
  }

  const improvementCount = valuesChanged.filter((v) => v.improved).length;
  const summaryFr = buildSummary('fr', verdict, certainty, {
    dtcResolved,
    dtcRemaining,
    dtcNew,
    improvementCount,
    droveSince,
    kmSince: after.kmSinceRepair ?? null,
    repairDescription,
  });
  const summaryEn = buildSummary('en', verdict, certainty, {
    dtcResolved,
    dtcRemaining,
    dtcNew,
    improvementCount,
    droveSince,
    kmSince: after.kmSinceRepair ?? null,
    repairDescription,
  });

  /*
   * §33 : l'origine de la comparaison est celle des mesures comparées. Toute la
   * comparaison hérite du niveau le plus faible : une seule mesure simulée suffit
   * à ce que le verdict ne soit pas présenté comme fondé sur le réel.
   */
  const origin: DataOrigin = [...before.readings, ...after.readings].some((reading) => reading.origin === 'simulated')
    ? 'simulated'
    : 'measured';

  return {
    id: `verif_${Date.now().toString(36)}`,
    repairId: '',
    vehicleId: '',
    beforeSessionId: before.sessionId,
    afterSessionId: after.sessionId,
    verdict,
    certainty,
    summaryFr,
    summaryEn,
    dtcBefore,
    dtcAfter,
    dtcResolved,
    dtcRemaining,
    dtcNew,
    valuesChanged,
    symptomsBefore,
    symptomsAfter,
    dataOrigin: origin,
    createdAt: new Date().toISOString(),
  };
}

function buildSummary(
  locale: 'fr' | 'en',
  verdict: RepairVerification['verdict'],
  certainty: RepairVerification['certainty'],
  data: {
    dtcResolved: string[];
    dtcRemaining: string[];
    dtcNew: string[];
    improvementCount: number;
    droveSince: boolean;
    kmSince: number | null;
    repairDescription: string;
  },
): string {
  const fr = locale === 'fr';
  const parts: string[] = [];

  if (verdict === 'insufficient_data') {
    parts.push(
      fr
        ? 'Données insuffisantes pour confirmer le résultat de la réparation : le scan après réparation ne contient pas assez de mesures exploitables. Refaites un scan moteur chaud après avoir roulé.'
        : 'Insufficient data to confirm the repair outcome: the post-repair scan does not contain enough usable measurements. Perform another warm-engine scan after driving.',
    );
    return parts.join(' ');
  }

  if (verdict === 'new_issue') {
    parts.push(
      fr
        ? `De nouveau(x) code(s) apparaissent après la réparation : ${data.dtcNew.join(', ')}. Il peut s’agir d’un défaut distinct, d’un défaut apparu pendant l’intervention (connecteur, durite, montage), ou d’un défaut non effacé.`
        : `New code(s) appeared after the repair: ${data.dtcNew.join(', ')}. This may be a separate fault, a fault introduced during the work (connector, hose, fitting), or a fault that was not cleared.`,
    );
    parts.push(
      fr
        ? 'XAMOTO recommande de traiter ce nouveau code comme un diagnostic à part entière, sans repartir du diagnostic précédent.'
        : 'XAMOTO recommends treating this new code as a diagnosis in its own right, without starting from the previous diagnosis.',
    );
    return parts.join(' ');
  }

  if (verdict === 'still_present') {
    parts.push(
      fr
        ? `Le(s) défaut(s) ${data.dtcRemaining.join(', ')} est/sont toujours présent(s) après « ${data.repairDescription} ».`
        : `Fault(s) ${data.dtcRemaining.join(', ')} are still present after "${data.repairDescription}".`,
    );
    parts.push(
      fr
        ? 'La réparation n’a pas traité la cause réelle du défaut, ou une autre cause produit le même code. Il ne faut pas remplacer à nouveau la même pièce sans effectuer le test qui permet de trancher entre les causes possibles.'
        : 'The repair did not address the actual cause of the fault, or another cause produces the same code. The same part must not be replaced again without performing the test that discriminates between possible causes.',
    );
    return parts.join(' ');
  }

  // verdict === 'resolved'
  parts.push(
    fr
      ? `Les défauts précédents (${data.dtcResolved.join(', ') || 'aucun'}) ne sont plus présents après « ${data.repairDescription} ».`
      : `Previous faults (${data.dtcResolved.join(', ') || 'none'}) are no longer present after "${data.repairDescription}".`,
  );
  if (data.improvementCount > 0) {
    parts.push(
      fr
        ? `${data.improvementCount} valeur(s) mesurée(s) se sont rapprochées de leur plage normale.`
        : `${data.improvementCount} measured value(s) moved closer to their normal range.`,
    );
  }
  if (!data.droveSince) {
    parts.push(
      fr
        ? 'ATTENTION : le véhicule n’a pas encore assez roulé depuis la réparation pour confirmer la résolution. Certains défauts (catalyseur, circuit EVAP, EGR, FAP) demandent plusieurs cycles de conduite complets avant de réapparaître ou de se confirmer. Le résultat affiché est donc « probablement résolu », pas « réparé ».'
        : 'WARNING: the vehicle has not yet driven enough since the repair to confirm resolution. Some faults (catalyst, EVAP, EGR, DPF) require several complete drive cycles before reappearing or being confirmed. The displayed result is therefore "probably resolved", not "repaired".',
    );
  } else {
    parts.push(
      fr
        ? `Le véhicule a roulé${data.kmSince ? ` environ ${data.kmSince} km` : ''} depuis la réparation : la résolution est plausible, sans garantie définitive.`
        : `The vehicle has driven${data.kmSince ? ` about ${data.kmSince} km` : ''} since the repair: resolution is plausible, without a definitive guarantee.`,
    );
  }
  parts.push(
    certainty === 'strongly_compatible'
      ? fr
        ? 'Recommandation : refaire un scan lors du prochain plein ou dans un mois pour vérifier l’absence de retour du défaut.'
        : 'Recommendation: rescan at the next refuelling or within a month to verify the fault has not returned.'
      : fr
        ? 'Recommandation : rouler normalement quelques jours, puis refaire un scan pour confirmer.'
        : 'Recommendation: drive normally for a few days, then rescan to confirm.',
  );
  return parts.join(' ');
}
