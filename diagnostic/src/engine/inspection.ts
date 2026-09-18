/**
 * XAMOTO — Inspection avant achat (§24).
 *
 * Objectif : donner à un acheteur des ÉLÉMENTS FACTUELS sur un véhicule
 * d'occasion, jamais un « feu vert » ou un « feu rouge » commercial.
 *
 * XAMOTO ne peut pas voir ce qu'il ne mesure pas : chaque point de contrôle
 * non réalisé est affiché comme « non contrôlé », ce qui est une information
 * en soi lors d'un achat.
 */
import type { CertaintyLevel, DataOrigin, InspectionReport, SafetyLevel } from '@xamoto/shared';
import { findDtcKnowledge, describeUnknownDtc } from '../knowledge/dtc.js';
import { SYMPTOM_BY_KEY } from '../knowledge/symptoms.js';
import type { DiagnosticContext } from '../rules/types.js';
import type { DiagnosticResult } from './index.js';

export interface InspectionOptions {
  /** Kilométrage affiché au compteur. */
  displayedOdometerKm?: number | null;
  /** Année du véhicule, pour la cohérence d'usure. */
  vehicleYear?: number | null;
  /** Éléments déclarés par le vendeur (« véhicule sans défaut », « révisé »…). */
  sellerClaims?: string[];
  /** Points non contrôlables (véhicule non essayé, moteur froid…). */
  notTestable?: string[];
}

function scoreFromSafety(level: SafetyLevel): number {
  return level === 'critical' ? 25 : level === 'important' ? 55 : level === 'attention' ? 75 : 100;
}

export function buildInspectionReport(
  ctx: DiagnosticContext,
  result: DiagnosticResult,
  options: InspectionOptions = {},
): InspectionReport {
  const checklist: InspectionReport['checklist'] = [];
  const redFlags: string[] = [];
  const notes: string[] = [];

  const supported = ctx.readings.filter((r) => r.supported && r.value !== null);
  const origin: DataOrigin = ctx.source === 'simulator' ? 'simulated' : 'measured';

  /* ── Contrôles moteur / défauts ────────────────────────────────────────── */
  const dtcCount = ctx.dtcs.length;
  const criticalCodes = ctx.dtcs.filter((d) => findDtcKnowledge(d.code)?.severity === 'critical');
  const importantCodes = ctx.dtcs.filter((d) => findDtcKnowledge(d.code)?.severity === 'important');

  checklist.push({
    key: 'dtc_read',
    labelFr: 'Lecture des codes défaut',
    labelEn: 'Fault code reading',
    verdict: dtcCount === 0 ? 'ok' : criticalCodes.length > 0 ? 'problem' : 'watch',
    detail:
      dtcCount === 0
        ? 'Aucun code défaut mémorisé au moment de l’inspection.'
        : `${dtcCount} code(s) mémorisé(s) : ${ctx.dtcs.map((d) => d.code).join(', ')}.`,
  });

  if (criticalCodes.length > 0) {
    redFlags.push(
      `Code(s) ${criticalCodes.map((d) => d.code).join(', ')} : défaut(s) grave(s) présent(s) sur le véhicule lors de l’inspection.`,
    );
  }

  /* ── Effacement récent : information capitale à l'achat ────────────────── */
  const recentlyCleared = ctx.history?.returnedCodes?.length ? true : false;
  checklist.push({
    key: 'dtc_cleared_recently',
    labelFr: 'Défauts récemment effacés',
    labelEn: 'Recently cleared faults',
    verdict: recentlyCleared ? 'problem' : ctx.dtcs.length === 0 ? 'ok' : 'not_checked',
    detail: recentlyCleared
      ? 'Il existe des traces d’effacement récent de défauts sur ce véhicule : l’absence de code défaut ne peut pas être interprétée comme une absence de problème.'
      : ctx.dtcs.length === 0
        ? 'Aucune trace d’effacement récent fournie à XAMOTO.'
        : 'Des défauts sont présents : la question de l’effacement récent ne se pose pas.',
  });
  if (recentlyCleared) {
    redFlags.push('Des défauts ont été effacés récemment : un délai de roulage est nécessaire avant de savoir si le véhicule est réellement sain.');
  }

  /* ── Données moteur disponibles ───────────────────────────────────────── */
  checklist.push({
    key: 'engine_data',
    labelFr: 'Données moteur disponibles',
    labelEn: 'Engine data availability',
    verdict: supported.length >= 8 ? 'ok' : supported.length >= 4 ? 'watch' : 'not_checked',
    detail: `${supported.length} mesure(s) exploitable(s) lue(s) sur le véhicule. ${ctx.readings.length - supported.length} mesure(s) non supportée(s) par ce véhicule.`,
  });

  /* ── Température, charge batterie : points concrets d'achat ───────────── */
  const coolant = supported.find((r) => r.key === 'coolant_temp');
  if (coolant) {
    checklist.push({
      key: 'coolant_temp',
      labelFr: 'Température moteur mesurée',
      labelEn: 'Measured engine temperature',
      verdict: (coolant.value as number) > 105 ? 'problem' : (coolant.value as number) < 60 ? 'watch' : 'ok',
      detail: `${coolant.value} °C mesuré au moment de l’inspection.`,
    });
  } else {
    checklist.push({ key: 'coolant_temp', labelFr: 'Température moteur mesurée', labelEn: 'Measured engine temperature', verdict: 'not_checked', detail: 'Mesure non disponible sur ce véhicule.' });
  }

  const voltage = supported.find((r) => r.key === 'battery_voltage');
  if (voltage) {
    checklist.push({
      key: 'battery_voltage',
      labelFr: 'Tension électrique mesurée',
      labelEn: 'Measured electrical voltage',
      verdict: (voltage.value as number) < 12.0 ? 'problem' : (voltage.value as number) < 12.4 ? 'watch' : 'ok',
      detail: `${voltage.value} V mesuré au moment de l’inspection.`,
    });
  } else {
    checklist.push({ key: 'battery_voltage', labelFr: 'Tension électrique mesurée', labelEn: 'Measured electrical voltage', verdict: 'not_checked', detail: 'Mesure non disponible sur ce véhicule.' });
  }

  /* ── Cohérence des informations ───────────────────────────────────────── */
  const incoherences: string[] = [];
  if (options.displayedOdometerKm != null && options.vehicleYear != null) {
    const age = new Date().getFullYear() - options.vehicleYear;
    const averageKm = age > 0 ? options.displayedOdometerKm / age : options.displayedOdometerKm;
    if (averageKm < 3000 && age > 5) {
      incoherences.push(
        `Kilométrage annoncé très bas pour l’âge du véhicule (${Math.round(averageKm)} km/an en moyenne). Cela n’est pas une preuve de fraude : il faut vérifier les documents d’entretien et l’usure générale (pédales, volant, siège conducteur).`,
      );
    }
    if (averageKm > 40000) {
      incoherences.push(
        `Kilométrage annoncé élevé (${Math.round(averageKm)} km/an en moyenne) : l’usure de l’ensemble des organes (suspension, embrayage, boîte) doit être vérifiée.`,
      );
    }
  } else {
    notes.push('Kilométrage ou année non fournis : la cohérence d’usure n’a pas pu être vérifiée.');
  }

  const humidityCodes = ctx.dtcs.filter((d) => /^(U0|C0)/.test(d.code));
  if (humidityCodes.length > 0) {
    notes.push(
      `Présence de code(s) ${humidityCodes.map((d) => d.code).join(', ')} (réseau ou châssis) : dans un contexte de chaleur et de poussière, ces codes viennent souvent de connecteurs oxydés ou de masses défectueuses. Une vérification du faisceau est recommandée.`,
    );
  }

  for (const claim of options.sellerClaims ?? []) {
    const lower = claim.toLowerCase();
    if (/(sans défaut|aucun défaut|nikel|parfait|comme neuf)/.test(lower) && dtcCount > 0) {
      redFlags.push(
        `Le vendeur indique « ${claim} » alors que ${dtcCount} code(s) défaut sont mémorisés dans le calculateur au moment de l’inspection.`,
      );
    }
    if (/(révisé|entretien à jour|vidange faite)/.test(lower)) {
      notes.push(
        `Le vendeur déclare « ${claim} ». Demandez les factures : XAMOTO ne peut pas vérifier l’entretien à partir des données OBD.`,
      );
    }
  }

  /* ── Symptômes déclarés ───────────────────────────────────────────────── */
  const declaredSymptoms = ctx.symptoms.filter((s) => s.present);
  if (declaredSymptoms.length > 0) {
    checklist.push({
      key: 'symptoms',
      labelFr: 'Symptômes observés lors de l’inspection',
      labelEn: 'Symptoms observed during inspection',
      verdict: declaredSymptoms.some((s) => SYMPTOM_BY_KEY.get(s.key)?.safety === 'critical') ? 'problem' : 'watch',
      detail: declaredSymptoms.map((s) => SYMPTOM_BY_KEY.get(s.key)?.labelFr ?? s.key).join(', '),
    });
  }

  /* ── Points non contrôlés ─────────────────────────────────────────────── */
  const notTestable = options.notTestable ?? [];
  const defaultNotChecked = ['Freinage (contrôle visuel non réalisé via OBD)', 'Suspension et direction', 'Embrayage', 'Carrosserie et structure', 'Historique d’entretien papier'];
  for (const item of [...defaultNotChecked, ...notTestable]) {
    checklist.push({
      key: `not_checked_${item.slice(0, 20)}`,
      labelFr: item,
      labelEn: item,
      verdict: 'not_checked',
      detail: 'XAMOTO ne peut pas contrôler ce point à partir des données OBD. Un contrôle visuel par un professionnel reste nécessaire.',
    });
  }

  /* ── Scores ───────────────────────────────────────────────────────────── */
  const safetyScore = scoreFromSafety(result.safety);
  const engine = Math.min(100, safetyScore);
  const emissions = ctx.dtcs.some((d) => /^P04/.test(d.code)) ? 60 : dtcCount > 0 ? 75 : 100;
  const electrical = voltage && (voltage.value as number) < 12.2 ? 60 : 95;
  const dataCoherence = incoherences.length > 0 ? 70 : options.displayedOdometerKm ? 95 : 60;
  const overall = Math.round((engine * 0.45 + emissions * 0.2 + electrical * 0.15 + dataCoherence * 0.2));

  /* ── Rapport ──────────────────────────────────────────────────────────── */
  const certainty: CertaintyLevel = supported.length >= 6 && dtcCount >= 0 ? 'strongly_compatible' : supported.length > 0 ? 'possible' : 'unavailable';
  void certainty;

  notes.push(
    'Une inspection XAMOTO porte uniquement sur ce que le véhicule a communiqué à l’outil au moment du contrôle. Un véhicule sans code défaut peut présenter des défauts mécaniques invisibles en OBD (freinage, suspension, embrayage, carrosserie).',
  );
  if (origin === 'simulated') {
    notes.push('MODE SIMULATION : cette inspection a été produite sur données simulées.');
  }

  return {
    id: `inspection_${Date.now().toString(36)}`,
    vehicleId: ctx.vehicle?.id ?? 'unknown',
    userId: '',
    sessionId: null,
    targetVehicle: {
      brand: ctx.vehicle?.brand ?? 'Inconnu',
      model: ctx.vehicle?.model ?? 'Inconnu',
      year: ctx.vehicle?.year ?? options.vehicleYear ?? 0,
      odometerKm: options.displayedOdometerKm ?? ctx.vehicle?.odometerKm ?? 0,
      vin: ctx.vehicle?.vin ?? null,
      plate: ctx.vehicle?.plate ?? null,
    },
    scores: { overall, engine, emissions, electrical, dataCoherence },
    checklist,
    redFlags,
    notes,
    createdAt: new Date().toISOString(),
  };
}
