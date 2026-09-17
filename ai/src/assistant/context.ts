/**
 * XAMOTO — Contexte véhicule transmis à l'IA (§14).
 *
 * L'IA ne répond JAMAIS à partir de la seule question : elle reçoit le
 * véhicule, le moteur, l'année, le kilométrage, les DTC, les PID, les
 * symptômes, l'historique, les réparations, les tests et leurs résultats,
 * ainsi que les informations issues de la base XAMOTO.
 *
 * Ce contexte est construit par le serveur, à partir de données réelles, et
 * transmis tel quel. L'IA n'a pas le droit d'ajouter une donnée absente.
 */
import type { AiContextPack, AiMessage, CanIDriveAnswer, DataOrigin, SymptomInput } from '@xamoto/shared';
import type { DiagnosticResult } from '@xamoto/diagnostic';
import type { DiagnosticContext } from '@xamoto/diagnostic';

export interface BuildContextInput {
  vehicle?: AiContextPack['vehicle'];
  spec?: AiContextPack['spec'];
  diagnostic?: DiagnosticResult | null;
  /**
   * Réponse « Puis-je rouler ? » calculée par le moteur de sécurité.
   * Sans elle, l'assistant refuse de répondre « oui » ou « non » (§12, §16).
   */
  canIDrive?: CanIDriveAnswer | null;
  context?: DiagnosticContext | null;
  repairs?: AiContextPack['repairs'];
  maintenance?: AiContextPack['maintenance'];
  history?: AiContextPack['history'];
  mode: 'obd' | 'simulator' | 'none';
}

export interface ContextBuildResult {
  pack: AiContextPack;
  /** Ce que l'IA peut légitimement affirmer, listé explicitement. */
  availableFacts: string[];
  /** Ce que XAMOTO ne possède pas pour ce véhicule. */
  missingFacts: string[];
}

export function buildAiContext(input: BuildContextInput): ContextBuildResult {
  const { diagnostic, context } = input;
  const availableFacts: string[] = [];
  const missingFacts: string[] = [];

  const pack: AiContextPack = {
    vehicle: input.vehicle ?? null,
    spec: input.spec ?? null,
    session: diagnostic
      ? {
          certainty: diagnostic.certainty,
          safety: diagnostic.safety,
          conclusionFr: diagnostic.conclusionFr,
          conclusionEn: diagnostic.conclusionEn,
          missingData: diagnostic.missingData.map((m) => m.fr),
        }
      : null,
    canIDrive: input.canIDrive ?? diagnostic?.canIDrive ?? null,
    dtcs: (context?.dtcs ?? []).map((d) => ({
      code: d.code,
      status: d.status,
      occurrences: d.occurrences,
      lastSeenAt: d.lastSeenAt ?? null,
    })),
    readings: (context?.readings ?? []).map((r) => ({
      key: r.key,
      label: r.label,
      value: r.value,
      unit: r.unit,
      supported: r.supported,
      capturedAt: r.capturedAt ?? new Date().toISOString(),
    })),
    symptoms: (context?.symptoms ?? []) as SymptomInput[],
    hypotheses: diagnostic?.hypotheses ?? [],
    findings: diagnostic?.findings ?? [],
    repairs: input.repairs ?? [],
    tests: (diagnostic?.tests ?? []).map((t) => ({ testKey: t.testKey, status: t.status, outcome: t.result?.outcome ?? null })),
    maintenance: input.maintenance ?? [],
    history: input.history ?? [],
    mode: input.mode,
  };

  if (pack.vehicle?.brand) availableFacts.push(`Véhicule : ${pack.vehicle.brand} ${pack.vehicle.model ?? ''} ${pack.vehicle.year ?? ''}`.trim());
  if (pack.vehicle?.engine) availableFacts.push(`Motorisation : ${pack.vehicle.engine}`);
  if (pack.vehicle?.odometerKm != null) availableFacts.push(`Kilométrage connu : ${pack.vehicle.odometerKm} km`);
  if (pack.dtcs.length > 0) availableFacts.push(`Codes défaut lus : ${pack.dtcs.map((d) => d.code).join(', ')}`);
  else if (context) availableFacts.push('Aucun code défaut mémorisé lors du dernier scan');
  const supportedReadings = pack.readings.filter((r) => r.supported && r.value !== null);
  if (supportedReadings.length > 0) {
    availableFacts.push(`Mesures disponibles : ${supportedReadings.map((r) => `${r.label} = ${r.value} ${r.unit}`).slice(0, 12).join(' ; ')}`);
  }
  const presentSymptoms = pack.symptoms.filter((s) => s.present);
  if (presentSymptoms.length > 0) availableFacts.push(`Symptômes déclarés : ${presentSymptoms.map((s) => s.key).join(', ')}`);

  if (!pack.vehicle) missingFacts.push('Aucun véhicule sélectionné');
  if (!pack.vehicle?.vin) missingFacts.push('VIN non renseigné');
  if (!context) missingFacts.push('Aucun scan réalisé pour ce véhicule');
  if (pack.readings.length === 0) missingFacts.push('Aucune mesure OBD disponible');
  if (pack.readings.length > 0 && pack.readings.filter((r) => r.supported).length < pack.readings.length) {
    missingFacts.push(`${pack.readings.filter((r) => !r.supported).length} mesure(s) non supportée(s) par ce véhicule`);
  }
  if (!pack.spec) missingFacts.push('Fiche technique (spécifications moteur) non disponible dans la base XAMOTO');
  if (presentSymptoms.length === 0) missingFacts.push('Aucun symptôme déclaré : les symptômes aident à séparer les causes');

  if (diagnostic) {
    for (const item of diagnostic.missingData) missingFacts.push(item.fr);
  }

  return { pack, availableFacts, missingFacts };
}

/** Résumé textuel du contexte, utilisé pour le prompt LLM et l'audit. */
export function serializeContext(result: ContextBuildResult, locale: 'fr' | 'en' = 'fr'): string {
  const { pack } = result;
  const lines: string[] = [];
  const fr = locale === 'fr';
  lines.push(fr ? '— CONTEXTE VÉHICULE (données XAMOTO) —' : '— VEHICLE CONTEXT (XAMOTO data) —');
  lines.push(...result.availableFacts.map((f) => `• ${f}`));
  if (pack.hypotheses.length > 0) {
    lines.push(fr ? 'Hypothèses du moteur de diagnostic (avec niveau de certitude) :' : 'Diagnostic engine hypotheses (with certainty level):');
    for (const hypothesis of pack.hypotheses.slice(0, 5)) {
      lines.push(`• ${hypothesis.labelFr} — certitude: ${hypothesis.certainty} — score interne: ${hypothesis.score}`);
    }
  }
  if (pack.session?.certainty) {
    lines.push(fr ? `Certitude globale du diagnostic : ${pack.session.certainty}` : `Overall diagnosis certainty: ${pack.session.certainty}`);
  }
  if (result.missingFacts.length > 0) {
    lines.push(fr ? '— DONNÉES ABSENTES (à annoncer, jamais à inventer) —' : '— MISSING DATA (must be stated, never invented) —');
    lines.push(...[...new Set(result.missingFacts)].map((f) => `• ${f}`));
  }
  if (pack.mode === 'simulator') {
    lines.push(fr ? '⚠ MODE SIMULATION : ces données ne proviennent pas d’un véhicule réel.' : '⚠ SIMULATION MODE: this data does not come from a real vehicle.');
  }
  return lines.join('\n');
}

export type { AiMessage, DataOrigin };
