/**
 * XAMOTO — Planificateur d'entretien (§22).
 *
 * Les intervalles proviennent de `MAINTENANCE_DEFINITIONS`, toujours attribués
 * à une source, et toujours affichés comme des PLAGES. XAMOTO n'invente jamais
 * un intervalle constructeur (§16) : lorsqu'une spécification moteur n'est pas
 * disponible, il le signale au lieu de trancher.
 */
import type { DataOrigin, FuelType, MaintenancePlanItem, VehicleSpec } from '@xamoto/shared';
import { MAINTENANCE_DEFINITIONS, type MaintenanceDefinition } from '../knowledge/maintenance.js';

export interface MaintenancePlanInput {
  vehicle: {
    fuelType: FuelType;
    odometerKm: number;
    year?: number;
    engine?: string;
    purchaseDate?: string | null;
  };
  spec?: Partial<VehicleSpec> | null;
  /** Interventions déclarées : la dernière fois que chaque type a été réalisé. */
  history?: Array<{ kind: string; performedAt: string; odometerKm?: number | null }>;
  /** Facteurs d'usage déclarés (§39) — contexte, jamais cause. */
  usage?: {
    dusty?: boolean;
    mostlyCity?: boolean;
    heavyHeat?: boolean;
    shortTrips?: boolean;
  };
  now?: Date;
}

export interface PlannedItem extends MaintenancePlanItem {
  /** Plage affichée, en clair. */
  rangeFr: string;
  rangeEn: string;
  sourceId: string;
  notesFr: string;
  notesEn: string;
  /** Pourquoi cette échéance a été calculée ainsi. */
  explanationFr: string;
  explanationEn: string;
  origin: DataOrigin;
}

const monthsBetween = (a: Date, b: Date): number => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

/**
 * Applique les facteurs d'usage en réduisant l'intervalle, sans jamais
 * inventer : la réduction est plafonnée (jamais en dessous de 60 % de la borne
 * basse) et toujours expliquée à l'utilisateur.
 */
function applyUsageFactor(def: MaintenanceDefinition, usage: MaintenancePlanInput['usage']): { factor: number; reasonsFr: string[]; reasonsEn: string[] } {
  const reasonsFr: string[] = [];
  const reasonsEn: string[] = [];
  let factor = 1;

  if (usage?.dusty && ['air_filter', 'cabin_filter', 'oil_change'].includes(def.kind)) {
    factor = Math.min(factor, 0.7);
    reasonsFr.push('environnement poussiéreux déclaré : contrôle et remplacement plus fréquents');
    reasonsEn.push('declared dusty environment: more frequent inspection and replacement');
  }
  if (usage?.mostlyCity && ['oil_change', 'brake_pads', 'dpf_inspection', 'gearbox_oil'].includes(def.kind)) {
    factor = Math.min(factor, 0.8);
    reasonsFr.push('usage urbain majoritaire : usure et encrassement plus rapides');
    reasonsEn.push('mostly city use: faster wear and fouling');
  }
  if (usage?.heavyHeat && ['battery', 'coolant', 'ac_check'].includes(def.kind)) {
    factor = Math.min(factor, 0.8);
    reasonsFr.push('climat chaud déclaré : vieillissement accéléré de la batterie et des liquides');
    reasonsEn.push('declared hot climate: faster ageing of battery and fluids');
  }
  if (usage?.shortTrips && ['oil_change', 'battery', 'dpf_inspection'].includes(def.kind)) {
    factor = Math.min(factor, 0.8);
    reasonsFr.push('trajets courts répétés : moteur rarement à température, régénérations incomplètes');
    reasonsEn.push('repeated short trips: engine rarely warm, incomplete regenerations');
  }

  return { factor: Math.max(factor, 0.6), reasonsFr, reasonsEn };
}

export function buildMaintenancePlan(input: MaintenancePlanInput): PlannedItem[] {
  const now = input.now ?? new Date();
  const fuelType = input.vehicle.fuelType;
  const items: PlannedItem[] = [];

  for (const def of MAINTENANCE_DEFINITIONS) {
    if (def.appliesFuel && !def.appliesFuel.includes(fuelType)) continue;

    const usage = applyUsageFactor(def, input.usage);

    const intervalKmLow = def.intervalKmRange ? def.intervalKmRange[0] : null;
    const intervalKmHigh = def.intervalKmRange ? def.intervalKmRange[1] : null;
    const intervalMonthsLow = def.intervalMonthsRange ? def.intervalMonthsRange[0] : null;
    const intervalMonthsHigh = def.intervalMonthsRange ? def.intervalMonthsRange[1] : null;

    const last = input.history?.find((h) => h.kind === def.kind);
    const lastDoneKm = last?.odometerKm ?? null;
    const lastDoneAt = last?.performedAt ?? null;

    // Échéance : borne basse de la plage (prudence), ajustée par le contexte.
    const adjustedIntervalKm = intervalKmLow !== null ? Math.round(intervalKmLow * usage.factor) : null;
    const adjustedIntervalMonths = intervalMonthsLow !== null ? Math.round(intervalMonthsLow * usage.factor) : null;

    const nextDueKm = adjustedIntervalKm !== null && lastDoneKm !== null ? lastDoneKm + adjustedIntervalKm : adjustedIntervalKm !== null && lastDoneKm === null ? null : null;
    const nextDueAt =
      adjustedIntervalMonths !== null && lastDoneAt
        ? (() => {
            const d = new Date(lastDoneAt);
            d.setMonth(d.getMonth() + adjustedIntervalMonths);
            return d.toISOString();
          })()
        : null;

    let status: MaintenancePlanItem['status'] = 'unknown';
    let explanationFr: string;
    let explanationEn: string;

    if (!last) {
      status = 'unknown';
      explanationFr =
        'XAMOTO ne connaît pas la date ou le kilométrage de la dernière intervention pour ce poste. Il ne peut donc pas calculer d’échéance : renseignez l’historique ou vérifiez le carnet d’entretien.';
      explanationEn =
        'XAMOTO does not know the date or mileage of the last service for this item. It cannot calculate a due date: fill in the history or check the service book.';
    } else {
      const kmRemaining = nextDueKm !== null ? nextDueKm - input.vehicle.odometerKm : null;
      const daysRemaining = nextDueAt ? Math.round((new Date(nextDueAt).getTime() - now.getTime()) / 86_400_000) : null;

      if ((kmRemaining !== null && kmRemaining <= 0) || (daysRemaining !== null && daysRemaining <= 0)) {
        status = 'overdue';
      } else if ((kmRemaining !== null && kmRemaining <= 1500) || (daysRemaining !== null && daysRemaining <= 45)) {
        status = 'due_soon';
      } else {
        status = 'ok';
      }

      const parts: string[] = [];
      if (adjustedIntervalKm !== null) {
        parts.push(
          `intervalle retenu ${adjustedIntervalKm} km${usage.factor < 1 ? ` (plage usuelle ${intervalKmLow}–${intervalKmHigh} km, réduite pour tenir compte du contexte)` : ` (borne basse de la plage usuelle ${intervalKmLow}–${intervalKmHigh} km)`}`,
        );
      }
      if (kmRemaining !== null) parts.push(kmRemaining <= 0 ? `échéance dépassée de ${Math.abs(kmRemaining)} km` : `${kmRemaining} km restants`);
      if (daysRemaining !== null) parts.push(daysRemaining <= 0 ? `échéance datée dépassée` : `${daysRemaining} jours restants`);
      explanationFr = parts.join(' ; ') || 'Données insuffisantes pour calculer une échéance.';
      explanationEn = explanationFr;
    }

    items.push({
      id: `maint_${def.kind}`,
      vehicleId: (input.vehicle as { id?: string }).id ?? 'unknown',
      kind: def.kind,
      labelFr: def.labelFr,
      labelEn: def.labelEn,
      intervalKm: adjustedIntervalKm,
      intervalMonths: adjustedIntervalMonths,
      lastDoneKm,
      lastDoneAt,
      nextDueKm,
      nextDueAt,
      status,
      sourceId: def.sourceId,
      notes: def.notesFr,
      rangeFr: def.intervalKmRange ? `${def.intervalKmRange[0]} – ${def.intervalKmRange[1]} km` : def.intervalMonthsRange ? `${def.intervalMonthsRange[0]} – ${def.intervalMonthsRange[1]} mois` : 'non documenté',
      rangeEn: def.intervalKmRange ? `${def.intervalKmRange[0]} – ${def.intervalKmRange[1]} km` : def.intervalMonthsRange ? `${def.intervalMonthsRange[0]} – ${def.intervalMonthsRange[1]} months` : 'not documented',
      notesFr: def.notesFr,
      notesEn: def.notesEn,
      explanationFr,
      explanationEn,
      origin: 'documented',
    });
  }

  // Postes prioritaires en tête de liste.
  const order: Record<MaintenancePlanItem['status'], number> = { overdue: 0, due_soon: 1, unknown: 2, ok: 3 };
  items.sort((a, b) => order[a.status] - order[b.status] || a.labelFr.localeCompare(b.labelFr));
  return items;
}
