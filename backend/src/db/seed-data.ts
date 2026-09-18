/**
 * XAMOTO — Données de référence (§28, §26, §39).
 *
 * Ces données servent de socle au marché de départ (Afrique de l'Ouest,
 * Sénégal). Elles respectent deux règles :
 *
 *  1. Toute valeur chiffrée est présentée comme une PLAGE documentée, jamais
 *     comme une valeur constructeur.
 *  2. Les fiches garages fournies ici sont des EXEMPLES de structure : elles
 *     doivent être remplacées par des partenaires réels avant mise en service.
 */
import type { FuelType } from '@xamoto/shared';

export const SEED_MARKET = {
  country: 'SN',
  labelFr: 'Sénégal (marché de départ)',
  labelEn: 'Senegal (initial market)',
} as const;

/* ───────────────────────── Véhicules courants (§6) ────────────────────────── */

export interface VehicleSpecSeed {
  brand: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  engine: string;
  fuelType: FuelType;
  oilSpec: string;
  oilCapacityL: number;
  coolantSpec: string;
  timingType: 'chaine' | 'courroie' | 'inconnu';
  timingIntervalKm: number | null;
  sparkPlugSpec: string | null;
  sparkPlugIntervalKm: number | null;
  commonIssues: string[];
}

/**
 * ⚠️ Les capacités et spécifications sont des ORDRES DE GRANDEUR documentés.
 * XAMOTO ne fournit pas de couple de serrage ni de référence constructeur :
 * ces données doivent être vérifiées dans le carnet du véhicule.
 */
export const VEHICLE_SPECS: VehicleSpecSeed[] = [
  {
    brand: 'Toyota',
    model: 'Corolla',
    yearFrom: 2014,
    yearTo: 2019,
    engine: '1.6 VVT-i',
    fuelType: 'essence',
    oilSpec: 'Selon carnet constructeur (vérifier la norme exacte du moteur)',
    oilCapacityL: 4.2,
    coolantSpec: 'Liquide longue durée préconisé par le constructeur',
    timingType: 'chaine',
    timingIntervalKm: null,
    sparkPlugSpec: 'Bougies iridium préconisées',
    sparkPlugIntervalKm: 90000,
    commonIssues: ['Bobines d’allumage', 'Capteur de vilebrequin', 'Encrassement du boîtier papillon en usage poussiéreux'],
  },
  {
    brand: 'Toyota',
    model: 'Hilux',
    yearFrom: 2010,
    yearTo: 2020,
    engine: '2.5 D-4D',
    fuelType: 'diesel',
    oilSpec: 'Huile diesel haut régime selon carnet constructeur',
    oilCapacityL: 6.9,
    coolantSpec: 'Liquide longue durée',
    timingType: 'courroie',
    timingIntervalKm: 150000,
    sparkPlugSpec: null,
    sparkPlugIntervalKm: null,
    commonIssues: ['Encrassement vanne EGR', 'Colmatage filtre à particules', 'Usure injecteurs avec carburant de qualité variable'],
  },
  {
    brand: 'Hyundai',
    model: 'Accent',
    yearFrom: 2010,
    yearTo: 2018,
    engine: '1.6',
    fuelType: 'essence',
    oilSpec: 'Selon carnet constructeur',
    oilCapacityL: 3.6,
    coolantSpec: 'Liquide type constructeur',
    timingType: 'courroie',
    timingIntervalKm: 90000,
    sparkPlugSpec: 'Bougies standard ou iridium selon version',
    sparkPlugIntervalKm: 40000,
    commonIssues: ['Bobines d’allumage', 'Capteur de position vilebrequin', 'Fuite de durite de refroidissement'],
  },
  {
    brand: 'Peugeot',
    model: '308',
    yearFrom: 2008,
    yearTo: 2016,
    engine: '1.6 VTi',
    fuelType: 'essence',
    oilSpec: 'Selon carnet constructeur',
    oilCapacityL: 4.3,
    coolantSpec: 'Liquide type constructeur',
    timingType: 'chaine',
    timingIntervalKm: 180000,
    sparkPlugSpec: 'Bougies iridium',
    sparkPlugIntervalKm: 60000,
    commonIssues: ['Distribution (chaîne)', 'Bobines d’allumage', 'Consommation d’huile'],
  },
  {
    brand: 'Peugeot',
    model: 'Partner',
    yearFrom: 2008,
    yearTo: 2018,
    engine: '1.6 HDi',
    fuelType: 'diesel',
    oilSpec: 'Huile diesel selon carnet constructeur',
    oilCapacityL: 4.5,
    coolantSpec: 'Liquide type constructeur',
    timingType: 'courroie',
    timingIntervalKm: 150000,
    sparkPlugSpec: null,
    sparkPlugIntervalKm: null,
    commonIssues: ['Vanne EGR encrassée', 'Filtre à particules colmaté en usage urbain', 'Injecteurs', 'Capteur de pression différentielle'],
  },
  {
    brand: 'Renault',
    model: 'Duster',
    yearFrom: 2010,
    yearTo: 2018,
    engine: '1.6 SCe',
    fuelType: 'essence',
    oilSpec: 'Selon carnet constructeur',
    oilCapacityL: 4.3,
    coolantSpec: 'Liquide type constructeur',
    timingType: 'chaine',
    timingIntervalKm: null,
    sparkPlugSpec: 'Bougies standard',
    sparkPlugIntervalKm: 40000,
    commonIssues: ['Capteur de position vilebrequin (calage à chaud)', 'Bobines d’allumage', 'Capteurs de roue'],
  },
  {
    brand: 'Renault',
    model: 'Logan',
    yearFrom: 2010,
    yearTo: 2020,
    engine: '1.5 dCi',
    fuelType: 'diesel',
    oilSpec: 'Huile diesel selon carnet constructeur',
    oilCapacityL: 4.5,
    coolantSpec: 'Liquide type constructeur',
    timingType: 'courroie',
    timingIntervalKm: 120000,
    sparkPlugSpec: null,
    sparkPlugIntervalKm: null,
    commonIssues: ['Injecteurs', 'Vanne EGR', 'Capteur de pression de suralimentation', 'Fuite de retour d’injecteur'],
  },
  {
    brand: 'Nissan',
    model: 'Sunny',
    yearFrom: 2011,
    yearTo: 2019,
    engine: '1.5',
    fuelType: 'essence',
    oilSpec: 'Selon carnet constructeur',
    oilCapacityL: 3.9,
    coolantSpec: 'Liquide type constructeur',
    timingType: 'chaine',
    timingIntervalKm: null,
    sparkPlugSpec: 'Bougies iridium',
    sparkPlugIntervalKm: 60000,
    commonIssues: ['Sonde O2 amont', 'Catalyseur en usage urbain', 'Boîtier papillon encrassé'],
  },
  {
    brand: 'Ford',
    model: 'Focus',
    yearFrom: 2011,
    yearTo: 2018,
    engine: '1.6 Ti-VCT',
    fuelType: 'essence',
    oilSpec: 'Selon carnet constructeur',
    oilCapacityL: 4.3,
    coolantSpec: 'Liquide type constructeur',
    timingType: 'courroie',
    timingIntervalKm: 120000,
    sparkPlugSpec: 'Bougies iridium',
    sparkPlugIntervalKm: 60000,
    commonIssues: ['Bobines d’allumage', 'Capteur de vilebrequin', 'Batterie (trajets courts)'],
  },
  {
    brand: 'Kia',
    model: 'Rio',
    yearFrom: 2012,
    yearTo: 2020,
    engine: '1.4',
    fuelType: 'essence',
    oilSpec: 'Selon carnet constructeur',
    oilCapacityL: 3.6,
    coolantSpec: 'Liquide type constructeur',
    timingType: 'chaine',
    timingIntervalKm: null,
    sparkPlugSpec: 'Bougies standard',
    sparkPlugIntervalKm: 40000,
    commonIssues: ['Capteurs de roue', 'Bobines d’allumage', 'Débitmètre encrassé'],
  },
  {
    brand: 'Mercedes-Benz',
    model: 'C-Class',
    yearFrom: 2008,
    yearTo: 2016,
    engine: 'C200 CDI',
    fuelType: 'diesel',
    oilSpec: 'Huile selon spécification constructeur',
    oilCapacityL: 6.5,
    coolantSpec: 'Liquide type constructeur',
    timingType: 'chaine',
    timingIntervalKm: null,
    sparkPlugSpec: null,
    sparkPlugIntervalKm: null,
    commonIssues: ['Injecteurs', 'Filtre à particules', 'Capteur de pression de suralimentation', 'Débitmètre'],
  },
  {
    brand: 'Toyota',
    model: 'Yaris',
    yearFrom: 2011,
    yearTo: 2020,
    engine: '1.3 VVT-i',
    fuelType: 'essence',
    oilSpec: 'Selon carnet constructeur',
    oilCapacityL: 3.6,
    coolantSpec: 'Liquide longue durée',
    timingType: 'chaine',
    timingIntervalKm: null,
    sparkPlugSpec: 'Bougies iridium',
    sparkPlugIntervalKm: 90000,
    commonIssues: ['Bobines d’allumage', 'Sonde O2', 'Batterie'],
  },
];

/* ───────────────────────────── Garages (§26) ──────────────────────────────── */

export interface GarageSeed {
  /** Identifiant stable (permet de rejouer l'amorçage sans doublon). */
  slug: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  brands: string[];
  specialties: string[];
  equipment: string[];
  services: string[];
  openingHours: string;
  verified: boolean;
  rating: number;
  acceptsXamoto: boolean;
  /** Exemple de prestation avec prix « à partir de » — jamais un devis. */
  sampleService?: { service: string; priceFrom: number };
}

export const GARAGES: GarageSeed[] = [
  {
    slug: 'exemple-dakar-mecanique',
    name: 'Garage partenaire — Mécanique générale (exemple)',
    city: 'Dakar',
    country: 'SN',
    lat: 14.7167,
    lon: -17.4677,
    phone: '+221 00 000 00 00',
    whatsapp: '+221 00 000 00 00',
    email: null,
    brands: ['Toyota', 'Nissan', 'Hyundai'],
    specialties: ['Mécanique moteur', 'Allumage', 'Distribution'],
    equipment: ['Valise multimarque', 'Lecteur OBD-II', 'Multimètre', 'Compressiomètre'],
    services: ['Diagnostic OBD', 'Remplacement bougies', 'Distribution'],
    openingHours: 'Lun–Sam 08:00–19:00',
    verified: true,
    rating: 4.5,
    acceptsXamoto: true,
    sampleService: { service: 'Diagnostic XAMOTO commenté', priceFrom: 5000 },
  },
  {
    slug: 'exemple-dakar-diesel',
    name: 'Garage partenaire — Diesel & injection (exemple)',
    city: 'Dakar',
    country: 'SN',
    lat: 14.7501,
    lon: -17.4489,
    phone: '+221 00 000 00 01',
    whatsapp: null,
    email: null,
    brands: ['Peugeot', 'Renault', 'Mercedes-Benz', 'Ford'],
    specialties: ['Diesel', 'Injecteurs', 'Filtre à particules', 'Turbo'],
    equipment: ['Valise poids lourds/VP', 'Banc de test injecteurs', 'Endoscope'],
    services: ['Diagnostic diesel', 'Nettoyage EGR', 'Réfection injecteurs'],
    openingHours: 'Lun–Ven 08:00–18:00',
    verified: true,
    rating: 4.2,
    acceptsXamoto: true,
  },
  {
    slug: 'exemple-thies-electricite',
    name: 'Garage partenaire — Électricité & climatisation (exemple)',
    city: 'Thiès',
    country: 'SN',
    lat: 14.7886,
    lon: -16.9246,
    phone: '+221 00 000 00 02',
    whatsapp: '+221 00 000 00 02',
    email: null,
    brands: [],
    specialties: ['Électricité automobile', 'Climatisation', 'Batterie', 'Démarreur'],
    equipment: ['Testeur de batterie', 'Station de climatisation', 'Multimètre'],
    services: ['Diagnostic électrique', 'Recharge climatisation', 'Alternateur'],
    openingHours: 'Lun–Sam 08:00–18:30',
    verified: false,
    rating: 4.0,
    acceptsXamoto: true,
  },
  {
    slug: 'exemple-saint-louis-freinage',
    name: 'Garage partenaire — Freinage & train roulant (exemple)',
    city: 'Saint-Louis',
    country: 'SN',
    lat: 16.0326,
    lon: -16.4818,
    phone: '+221 00 000 00 03',
    whatsapp: null,
    email: null,
    brands: [],
    specialties: ['Freinage', 'ABS', 'Suspension', 'Direction'],
    equipment: ['Banc de freinage', 'Valise ABS', 'Presse hydraulique'],
    services: ['Plaquettes et disques', 'Diagnostic ABS', 'Amortisseurs'],
    openingHours: 'Lun–Sam 08:00–19:00',
    verified: true,
    rating: 4.6,
    acceptsXamoto: true,
  },
  {
    slug: 'exemple-mbour-moteur',
    name: 'Garage partenaire — Moteur & réfection (exemple)',
    city: 'Mbour',
    country: 'SN',
    lat: 14.4198,
    lon: -16.9646,
    phone: '+221 00 000 00 04',
    whatsapp: null,
    email: null,
    brands: [],
    specialties: ['Réfection moteur', 'Culasse', 'Joint de culasse', 'Distribution'],
    equipment: ['Rectifieuse', 'Épreuve d’étanchéité', 'Outillage distribution'],
    services: ['Réfection culasse', 'Joint de culasse', 'Moteur'],
    openingHours: 'Lun–Ven 08:00–18:00',
    verified: false,
    rating: null as unknown as number,
    acceptsXamoto: true,
  },
];

/* ─────────────────────────────── Pièces (§28) ─────────────────────────────── */

export interface PartSeed {
  partKey: string;
  nameFr: string;
  nameEn: string;
  category: string;
  oemReferences: string[];
  equivalents: string[];
  fitsBrands: string[];
  fitsEngines: string[];
  availabilitySn: 'high' | 'medium' | 'low' | 'unknown';
  typicalPriceXof: number | null;
}

/**
 * Les références constructeur sont volontairement VIDES dans l'exemple : XAMOTO
 * n'invente jamais une référence. Elles sont renseignées par les partenaires
 * avec leur source (§28, §47-1).
 */
export const PARTS: PartSeed[] = [
  {
    partKey: 'bougie_allumage',
    nameFr: 'Bougie d’allumage (iridium)',
    nameEn: 'Spark plug (iridium)',
    category: 'allumage',
    oemReferences: [],
    equivalents: [],
    fitsBrands: ['Toyota', 'Hyundai', 'Kia', 'Nissan'],
    fitsEngines: ['1.6 VVT-i', '1.6', '1.4', '1.5', '1.3 VVT-i'],
    availabilitySn: 'high',
    typicalPriceXof: 6000,
  },
  {
    partKey: 'bobine_allumage',
    nameFr: 'Bobine d’allumage',
    nameEn: 'Ignition coil',
    category: 'allumage',
    oemReferences: [],
    equivalents: [],
    fitsBrands: ['Toyota', 'Hyundai', 'Kia'],
    fitsEngines: ['1.6 VVT-i', '1.6', '1.4'],
    availabilitySn: 'medium',
    typicalPriceXof: 25000,
  },
  {
    partKey: 'filtre_air',
    nameFr: 'Filtre à air',
    nameEn: 'Air filter',
    category: 'filtration',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'high',
    typicalPriceXof: 7500,
  },
  {
    partKey: 'filtre_huile',
    nameFr: 'Filtre à huile',
    nameEn: 'Oil filter',
    category: 'filtration',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'high',
    typicalPriceXof: 5000,
  },
  {
    partKey: 'filtre_carburant',
    nameFr: 'Filtre à carburant (diesel)',
    nameEn: 'Fuel filter (diesel)',
    category: 'filtration',
    oemReferences: [],
    equivalents: [],
    fitsBrands: ['Peugeot', 'Renault', 'Toyota', 'Mercedes-Benz'],
    fitsEngines: ['1.6 HDi', '1.5 dCi', '2.5 D-4D', 'C200 CDI'],
    availabilitySn: 'high',
    typicalPriceXof: 12000,
  },
  {
    partKey: 'batterie_60ah',
    nameFr: 'Batterie 60 Ah',
    nameEn: 'Battery 60 Ah',
    category: 'electrique',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'high',
    typicalPriceXof: 55000,
  },
  {
    partKey: 'alternateur',
    nameFr: 'Alternateur',
    nameEn: 'Alternator',
    category: 'electrique',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'medium',
    typicalPriceXof: 120000,
  },
  {
    partKey: 'demarreur',
    nameFr: 'Démarreur',
    nameEn: 'Starter motor',
    category: 'electrique',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'medium',
    typicalPriceXof: 85000,
  },
  {
    partKey: 'sonde_o2_amont',
    nameFr: 'Sonde O2 amont',
    nameEn: 'Upstream O2 sensor',
    category: 'depollution',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'medium',
    typicalPriceXof: 45000,
  },
  {
    partKey: 'catalyseur',
    nameFr: 'Catalyseur',
    nameEn: 'Catalytic converter',
    category: 'depollution',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'low',
    typicalPriceXof: 260000,
  },
  {
    partKey: 'vanne_egr',
    nameFr: 'Vanne EGR',
    nameEn: 'EGR valve',
    category: 'depollution',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'medium',
    typicalPriceXof: 95000,
  },
  {
    partKey: 'filtre_particules',
    nameFr: 'Filtre à particules',
    nameEn: 'Diesel particulate filter',
    category: 'depollution',
    oemReferences: [],
    equivalents: [],
    fitsBrands: ['Peugeot', 'Renault'],
    fitsEngines: ['1.6 HDi', '1.5 dCi'],
    availabilitySn: 'low',
    typicalPriceXof: 300000,
  },
  {
    partKey: 'debitmetre',
    nameFr: 'Débitmètre d’air',
    nameEn: 'Mass air flow sensor',
    category: 'admission',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'medium',
    typicalPriceXof: 65000,
  },
  {
    partKey: 'capteur_vilebrequin',
    nameFr: 'Capteur de position vilebrequin',
    nameEn: 'Crankshaft position sensor',
    category: 'allumage',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'medium',
    typicalPriceXof: 35000,
  },
  {
    partKey: 'thermostat',
    nameFr: 'Thermostat',
    nameEn: 'Thermostat',
    category: 'refroidissement',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'high',
    typicalPriceXof: 18000,
  },
  {
    partKey: 'pompe_a_eau',
    nameFr: 'Pompe à eau',
    nameEn: 'Water pump',
    category: 'refroidissement',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'medium',
    typicalPriceXof: 55000,
  },
  {
    partKey: 'durite_radiateur',
    nameFr: 'Durite de radiateur',
    nameEn: 'Radiator hose',
    category: 'refroidissement',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'medium',
    typicalPriceXof: 20000,
  },
  {
    partKey: 'plaquettes_frein',
    nameFr: 'Jeu de plaquettes de frein avant',
    nameEn: 'Front brake pad set',
    category: 'freinage',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'high',
    typicalPriceXof: 25000,
  },
  {
    partKey: 'disque_frein',
    nameFr: 'Disque de frein avant',
    nameEn: 'Front brake disc',
    category: 'freinage',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'medium',
    typicalPriceXof: 35000,
  },
  {
    partKey: 'capteur_abs',
    nameFr: 'Capteur ABS de roue',
    nameEn: 'Wheel speed sensor',
    category: 'freinage',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'medium',
    typicalPriceXof: 30000,
  },
  {
    partKey: 'huile_moteur_5w40',
    nameFr: 'Huile moteur 5W-40 (5 L)',
    nameEn: 'Engine oil 5W-40 (5 L)',
    category: 'consommable',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'high',
    typicalPriceXof: 25000,
  },
  {
    partKey: 'liquide_refroidissement',
    nameFr: 'Liquide de refroidissement (5 L)',
    nameEn: 'Coolant (5 L)',
    category: 'consommable',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'high',
    typicalPriceXof: 12000,
  },
  {
    partKey: 'gaz_clim_r134a',
    nameFr: 'Recharge gaz de climatisation R134a',
    nameEn: 'A/C refrigerant charge R134a',
    category: 'climatisation',
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'medium',
    typicalPriceXof: 25000,
  },
  {
    partKey: 'batterie',
    nameFr: 'Batterie de démarrage',
    nameEn: 'Starter battery',
    category: 'electrique',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'boitier_papillon',
    nameFr: 'Boîtier papillon (corps de l’admission)',
    nameEn: 'Throttle body',
    category: 'admission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'bouchon_radiateur',
    nameFr: 'Bouchon de vase d’expansion',
    nameEn: 'Expansion tank cap',
    category: 'refroidissement',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'bouchon_reservoir',
    nameFr: 'Bouchon de réservoir de carburant',
    nameEn: 'Fuel filler cap',
    category: 'carburant',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'canister',
    nameFr: 'Canister à charbon actif (vapeurs de carburant)',
    nameEn: 'Activated carbon canister',
    category: 'depollution',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'capteur_arbre_a_cames',
    nameFr: 'Capteur d’arbre à cames',
    nameEn: 'Camshaft position sensor',
    category: 'allumage',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'capteur_boite',
    nameFr: 'Capteur de vitesse de boîte',
    nameEn: 'Transmission speed sensor',
    category: 'transmission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'capteur_debit_air',
    nameFr: 'Capteur de débit d’air (débitmètre)',
    nameEn: 'Mass air flow sensor',
    category: 'admission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'capteur_map',
    nameFr: 'Capteur de pression de collecteur (MAP)',
    nameEn: 'Manifold absolute pressure sensor',
    category: 'admission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'capteur_pression_carburant',
    nameFr: 'Capteur de pression de carburant',
    nameEn: 'Fuel pressure sensor',
    category: 'carburant',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'capteur_pression_differentielle',
    nameFr: 'Capteur de pression différentielle (FAP)',
    nameEn: 'Differential pressure sensor (DPF)',
    category: 'depollution',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'compresseur_climatisation',
    nameFr: 'Compresseur de climatisation',
    nameEn: 'A/C compressor',
    category: 'climatisation',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'courroie_accessoires',
    nameFr: 'Courroie d’accessoires',
    nameEn: 'Accessory belt',
    category: 'moteur',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'dephaseur',
    nameFr: 'Déphaseur d’arbre à cames',
    nameEn: 'Camshaft phaser',
    category: 'moteur',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'durite_admission',
    nameFr: 'Durite d’admission',
    nameEn: 'Intake hose',
    category: 'admission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'durite_canister',
    nameFr: 'Durite de canister',
    nameEn: 'Canister hose',
    category: 'depollution',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'durite_carburant',
    nameFr: 'Durite de carburant',
    nameEn: 'Fuel hose',
    category: 'carburant',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'durite_frein',
    nameFr: 'Flexible de frein',
    nameEn: 'Brake hose',
    category: 'freinage',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'durite_refroidissement',
    nameFr: 'Durite de refroidissement',
    nameEn: 'Coolant hose',
    category: 'refroidissement',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'durite_suralimentation',
    nameFr: 'Durite de suralimentation',
    nameEn: 'Boost hose',
    category: 'admission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'echangeur_air',
    nameFr: 'Échangeur air/air (intercooler)',
    nameEn: 'Intercooler',
    category: 'admission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'electrovanne_calage',
    nameFr: 'Électrovanne de calage de distribution',
    nameEn: 'Timing control solenoid',
    category: 'moteur',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'electrovanne_purge',
    nameFr: 'Électrovanne de purge du canister',
    nameEn: 'Canister purge solenoid',
    category: 'depollution',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'electrovanne_suralimentation',
    nameFr: 'Électrovanne de commande de suralimentation',
    nameEn: 'Boost control solenoid',
    category: 'admission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'etrier_frein',
    nameFr: 'Étrier de frein',
    nameEn: 'Brake caliper',
    category: 'freinage',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'filtre_habitacle',
    nameFr: 'Filtre d’habitacle',
    nameEn: 'Cabin filter',
    category: 'climatisation',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'fusible',
    nameFr: 'Fusible et porte-fusible',
    nameEn: 'Fuse and fuse holder',
    category: 'electrique',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'gaz_climatisation',
    nameFr: 'Fluide frigorigène de climatisation',
    nameEn: 'A/C refrigerant',
    category: 'climatisation',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'huile_boite',
    nameFr: 'Huile de boîte de vitesses',
    nameEn: 'Transmission fluid',
    category: 'transmission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'huile_moteur',
    nameFr: 'Huile moteur',
    nameEn: 'Engine oil',
    category: 'consommable',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'injecteur',
    nameFr: 'Injecteur',
    nameEn: 'Fuel injector',
    category: 'injection',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'joint_admission',
    nameFr: 'Joint d’admission',
    nameEn: 'Intake gasket',
    category: 'admission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'joint_culasse',
    nameFr: 'Joint de culasse',
    nameEn: 'Head gasket',
    category: 'moteur',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'kit_distribution',
    nameFr: 'Kit de distribution (courroie ou chaîne, galets)',
    nameEn: 'Timing kit (belt or chain, tensioners)',
    category: 'moteur',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'kit_embrayage',
    nameFr: 'Kit d’embrayage (disque, mécanisme, butée)',
    nameEn: 'Clutch kit (disc, cover, release bearing)',
    category: 'transmission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'liquide_frein',
    nameFr: 'Liquide de frein',
    nameEn: 'Brake fluid',
    category: 'consommable',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'maitre_cylindre',
    nameFr: 'Maître-cylindre de frein',
    nameEn: 'Brake master cylinder',
    category: 'freinage',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'manocontact_huile',
    nameFr: 'Manocontact de pression d’huile',
    nameEn: 'Oil pressure switch',
    category: 'moteur',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'moto_ventilateur',
    nameFr: 'Moto-ventilateur de refroidissement',
    nameEn: 'Cooling fan motor',
    category: 'refroidissement',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'pompe_a_huile',
    nameFr: 'Pompe à huile',
    nameEn: 'Oil pump',
    category: 'moteur',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'pompe_carburant',
    nameFr: 'Pompe à carburant',
    nameEn: 'Fuel pump',
    category: 'carburant',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'radiateur',
    nameFr: 'Radiateur de refroidissement',
    nameEn: 'Cooling radiator',
    category: 'refroidissement',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'refroidisseur_egr',
    nameFr: 'Refroidisseur de vanne EGR',
    nameEn: 'EGR cooler',
    category: 'depollution',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'regulateur_pression',
    nameFr: 'Régulateur de pression de carburant',
    nameEn: 'Fuel pressure regulator',
    category: 'carburant',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'roulement_roue',
    nameFr: 'Roulement de roue',
    nameEn: 'Wheel bearing',
    category: 'transmission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'sonde_o2_aval',
    nameFr: 'Sonde O2 aval (après catalyseur)',
    nameEn: 'Downstream O2 sensor',
    category: 'depollution',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'sonde_temperature_moteur',
    nameFr: 'Sonde de température de liquide de refroidissement',
    nameEn: 'Coolant temperature sensor',
    category: 'refroidissement',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'support_moteur',
    nameFr: 'Support moteur ou boîte',
    nameEn: 'Engine or gearbox mount',
    category: 'moteur',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'turbo',
    nameFr: 'Turbocompresseur',
    nameEn: 'Turbocharger',
    category: 'admission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'valve_pcv',
    nameFr: 'Valve de recyclage des vapeurs d’huile (PCV)',
    nameEn: 'PCV valve',
    category: 'moteur',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
  {
    partKey: 'wastegate',
    nameFr: 'Wastegate (régulation de pression de suralimentation)',
    nameEn: 'Wastegate',
    category: 'admission',
    // Références, équivalents et prix : NON RENSEIGNÉS. XAMOTO n'invente ni une
    // référence constructeur, ni un prix, ni une disponibilité (§28, §47).
    oemReferences: [],
    equivalents: [],
    fitsBrands: [],
    fitsEngines: [],
    availabilitySn: 'unknown',
    typicalPriceXof: null,
  },
];
