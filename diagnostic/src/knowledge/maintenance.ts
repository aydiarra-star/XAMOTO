/**
 * XAMOTO — Entretien (§22).
 *
 * ⚠️ Règle absolue du cahier des charges :
 * « Les intervalles doivent provenir de données identifiées et non d’une invention. »
 *
 * Conséquence : XAMOTO ne prétend PAS connaître l'intervalle constructeur exact
 * d'un véhicule donné. Il publie des PLAGES usuelles, attribuées à une source,
 * et indique explicitement de vérifier le carnet d'entretien du véhicule.
 *
 * Les facteurs d'usage (poussière, chaleur, embouteillages, carburant de qualité
 * variable) réduisent la plage — ils sont affichés comme contexte (§39), jamais
 * comme diagnostic.
 */
import type { FuelType } from '@xamoto/shared';

export interface MaintenanceDefinition {
  kind: string;
  labelFr: string;
  labelEn: string;
  /** Plage d'intervalles usuels — jamais une valeur unique « officielle ». */
  intervalKmRange: [number, number] | null;
  intervalMonthsRange: [number, number] | null;
  sourceId: string;
  notesFr: string;
  notesEn: string;
  requiresSpec?: boolean;
  appliesFuel?: FuelType[];
}

export const MAINTENANCE_DEFINITIONS: MaintenanceDefinition[] = [
  {
    kind: 'oil_change',
    labelFr: 'Vidange moteur et filtre à huile',
    labelEn: 'Engine oil and oil filter change',
    intervalKmRange: [5000, 15000],
    intervalMonthsRange: [6, 12],
    sourceId: 'src_maintenance_ranges',
    notesFr:
      'La plage varie fortement selon le moteur, le type d’huile et l’usage : de 15 000 km pour un moteur récent sur route à 5 000–7 500 km en usage urbain, trajets courts, chaleur et poussière. Vérifiez le carnet d’entretien de votre véhicule.',
    notesEn:
      'The range varies widely with engine, oil type and use: from 15 000 km for a recent engine on the open road to 5 000–7 500 km in city use, short trips, heat and dust. Check your vehicle service book.',
    requiresSpec: true,
  },
  {
    kind: 'air_filter',
    labelFr: 'Filtre à air moteur',
    labelEn: 'Engine air filter',
    intervalKmRange: [10000, 30000],
    intervalMonthsRange: [12, 24],
    sourceId: 'src_maintenance_ranges',
    notesFr:
      'En environnement poussiéreux (saison sèche, pistes, zones sablonneuses), l’inspection doit être plus fréquente que la plage standard : le filtre peut être soufflé (air comprimé à faible pression, de l’intérieur vers l’extérieur) et remplacé plus tôt.',
    notesEn:
      'In dusty environments (dry season, dirt roads, sandy areas), inspection should be more frequent than the standard range: the filter can be blown out (low-pressure compressed air, from inside out) and replaced earlier.',
    requiresSpec: true,
  },
  {
    kind: 'cabin_filter',
    labelFr: 'Filtre d’habitacle',
    labelEn: 'Cabin filter',
    intervalKmRange: [15000, 30000],
    intervalMonthsRange: [12, 24],
    sourceId: 'src_maintenance_ranges',
    notesFr: 'Impact direct sur le confort et la climatisation. Très sollicité en environnement poussiéreux.',
    notesEn: 'Direct impact on comfort and air conditioning. Heavily loaded in dusty environments.',
  },
  {
    kind: 'fuel_filter',
    labelFr: 'Filtre à carburant',
    labelEn: 'Fuel filter',
    intervalKmRange: [15000, 40000],
    intervalMonthsRange: [12, 24],
    sourceId: 'src_maintenance_ranges',
    notesFr:
      'Sur moteur diesel surtout, un filtre à carburant colmaté provoque pertes de puissance et coupures. Avec un carburant de qualité variable, un intervalle court et une purge d’eau régulière sont recommandés.',
    notesEn:
      'Especially on diesel, a clogged fuel filter causes power loss and cuts. With variable fuel quality, a short interval and regular water draining are recommended.',
    appliesFuel: ['diesel'],
  },
  {
    kind: 'spark_plugs',
    labelFr: 'Bougies d’allumage',
    labelEn: 'Spark plugs',
    intervalKmRange: [20000, 60000],
    intervalMonthsRange: null,
    sourceId: 'src_maintenance_ranges',
    notesFr:
      'La durée dépend du type de bougie (cuivre, platine, iridium) : la bougie standard se remplace plus souvent que l’iridium. Vérifiez la spécification du moteur lorsqu’elle est disponible.',
    notesEn:
      'Service life depends on plug type (copper, platinum, iridium): standard plugs are replaced more often than iridium. Check the engine specification when available.',
    appliesFuel: ['essence', 'gpl', 'flex', 'hybride'],
  },
  {
    kind: 'brake_fluid',
    labelFr: 'Liquide de frein',
    labelEn: 'Brake fluid',
    intervalKmRange: null,
    intervalMonthsRange: [24, 24],
    sourceId: 'src_maintenance_ranges',
    notesFr:
      'Le liquide de frein absorbe l’humidité : le remplacement est généralement daté (souvent 2 ans) plutôt que kilométré. En climat humide, respecter scrupuleusement l’échéance.',
    notesEn:
      'Brake fluid absorbs moisture: replacement is generally time-based (often 2 years) rather than mileage-based. In humid climates, strictly respect the deadline.',
  },
  {
    kind: 'coolant',
    labelFr: 'Liquide de refroidissement',
    labelEn: 'Coolant',
    intervalKmRange: [40000, 120000],
    intervalMonthsRange: [24, 60],
    sourceId: 'src_maintenance_ranges',
    notesFr:
      'Selon la technologie (type G11, G12, longue durée), l’intervalle varie beaucoup. La chaleur accentue la dégradation : contrôler régulièrement le niveau, la couleur et l’absence de dépôts.',
    notesEn:
      'Depending on technology (G11, G12, long life), the interval varies widely. Heat accelerates degradation: regularly check level, colour and absence of deposits.',
  },
  {
    kind: 'brake_pads',
    labelFr: 'Plaquettes et disques de frein',
    labelEn: 'Brake pads and discs',
    intervalKmRange: [20000, 60000],
    intervalMonthsRange: null,
    sourceId: 'src_maintenance_ranges',
    notesFr:
      'En circulation urbaine dense (freinages répétés), les plaquettes s’usent beaucoup plus vite que la plage standard. Un contrôle visuel régulier est plus fiable qu’un kilométrage théorique.',
    notesEn:
      'In dense city traffic (repeated braking), pads wear much faster than the standard range. Regular visual inspection is more reliable than a theoretical mileage.',
  },
  {
    kind: 'tyres',
    labelFr: 'Pneumatiques et pression',
    labelEn: 'Tyres and pressure',
    intervalKmRange: null,
    intervalMonthsRange: [1, 1],
    sourceId: 'src_maintenance_ranges',
    notesFr:
      'Contrôle mensuel de la pression (à froid) et de l’état. La chaleur et les routes dégradées augmentent l’usure irrégulière. Le témoin d’usure et l’âge du pneu (plus de 5–6 ans même peu usé) sont déterminants.',
    notesEn:
      'Monthly check of pressure (cold) and condition. Heat and degraded roads increase irregular wear. Wear indicators and tyre age (over 5–6 years even if little used) matter.',
  },
  {
    kind: 'battery',
    labelFr: 'Batterie',
    labelEn: 'Battery',
    intervalKmRange: null,
    intervalMonthsRange: [24, 60],
    sourceId: 'src_maintenance_ranges',
    notesFr:
      'La durée de vie est très variable (souvent 3 à 5 ans). La chaleur, les trajets courts répétés et les décharges complètes la raccourcissent nettement : la tension peut être suivie par OBD à chaque scan.',
    notesEn:
      'Service life varies widely (often 3 to 5 years). Heat, repeated short trips and deep discharges shorten it significantly: voltage can be tracked by OBD at each scan.',
  },
  {
    kind: 'timing_belt',
    labelFr: 'Courroie de distribution',
    labelEn: 'Timing belt',
    intervalKmRange: [60000, 180000],
    intervalMonthsRange: [48, 120],
    sourceId: 'src_maintenance_ranges',
    notesFr:
      '⚠️ Intervalle très dépendant du moteur. Une courroie rompue peut détruire le moteur. XAMOTO affichera la spécification du moteur si elle est disponible ; sinon, la valeur constructeur doit être vérifiée dans le carnet d’entretien AVANT de se fier à cette plage.',
    notesEn:
      '⚠️ Interval highly engine-dependent. A snapped belt can destroy the engine. XAMOTO will show the engine specification if available; otherwise the manufacturer value must be checked in the service book BEFORE relying on this range.',
    requiresSpec: true,
  },
  {
    kind: 'gearbox_oil',
    labelFr: 'Huile de boîte de vitesses',
    labelEn: 'Transmission oil',
    intervalKmRange: [60000, 120000],
    intervalMonthsRange: [48, 96],
    sourceId: 'src_maintenance_ranges',
    notesFr:
      'Certaines boîtes automatiques sont annoncées « à vie » : en usage urbain et climat chaud, une vidange préventive reste discutée. La procédure de niveau et de remplissage dépend du constructeur.',
    notesEn:
      'Some automatic transmissions are marketed as "sealed for life": in city use and hot climates, preventive fluid change is debated. Level and fill procedure is manufacturer-specific.',
    requiresSpec: true,
  },
  {
    kind: 'dpf_inspection',
    labelFr: 'Contrôle filtre à particules (FAP)',
    labelEn: 'Particulate filter inspection',
    intervalKmRange: [20000, 40000],
    intervalMonthsRange: null,
    sourceId: 'src_african_context',
    notesFr:
      'Contexte d’usage urbain et embouteillages : les cycles de régénération sont rarement complets. Un contrôle du chargement en suie lors des entretiens évite un colmatage coûteux.',
    notesEn:
      'Urban use and traffic context: regeneration cycles are rarely completed. Checking soot load during services avoids costly clogging.',
    appliesFuel: ['diesel'],
  },
  {
    kind: 'ac_check',
    labelFr: 'Climatisation (charge, propreté des échangeurs)',
    labelEn: 'Air conditioning (charge, heat exchanger cleanliness)',
    intervalKmRange: null,
    intervalMonthsRange: [6, 12],
    sourceId: 'src_african_context',
    notesFr:
      'Système très sollicité en climat chaud. Nettoyage du condenseur (poussière) et contrôle de charge avant la saison chaude.',
    notesEn:
      'Heavily used in hot climates. Condenser cleaning (dust) and charge check before the hot season.',
  },
];

export const MAINTENANCE_BY_KIND = new Map(MAINTENANCE_DEFINITIONS.map((m) => [m.kind, m]));
