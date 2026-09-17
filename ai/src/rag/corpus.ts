/**
 * XAMOTO — Base documentaire du RAG automobile (§15).
 *
 * Chaque document conserve : source, date, version, véhicules concernés,
 * niveau de fiabilité. Ces métadonnées sont affichées avec la réponse : c'est
 * ce qui rend une réponse vérifiable (§15, §33).
 *
 * ⚠️ Aucun document ne doit affirmer une valeur constructeur précise. Les
 * documents expliquent des SYSTÈMES, des MÉTHODES et des RELATIONS
 * techniques — jamais des valeurs propres à un moteur donné.
 */
import type { KnowledgeDocument } from '@xamoto/shared';

const V1 = '1.0.0';
const UPDATED = '2026-01-01';

export const RAG_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: 'doc_obd_basics',
    sourceId: 'src_sae_j1979',
    titleFr: 'Ce que l’OBD peut et ne peut pas lire',
    titleEn: 'What OBD can and cannot read',
    contentFr:
      'Le diagnostic embarqué (OBD-II, ISO 15031 / SAE J1979) donne accès aux codes défaut du groupe motopropulseur et à une série de mesures (PID) : régime, vitesse, température de liquide, charge, corrections de carburant, tensions de sonde O2, tension calculateur, débit d’air, pression de collecteur, niveau de carburant. Ces données ne couvrent PAS tout le véhicule : le freinage, la suspension, la direction, l’embrayage, la carrosserie et la boîte automatique ne sont accessibles que par des protocoles constructeur ou des modes étendus. Un moteur essence approuvé depuis 2001 (et un diesel depuis 2004 environ) doit exposer une liste minimale de PID, mais chaque constructeur choisit les PID supplémentaires qu’il expose. Conséquence pratique : l’absence d’un code défaut ne veut pas dire absence de problème, et l’absence d’une mesure ne veut pas dire que la pièce est saine — cela veut dire que XAMOTO ne peut pas la contrôler par ce moyen.',
    contentEn:
      'On-board diagnostics (OBD-II, ISO 15031 / SAE J1979) provides access to powertrain fault codes and a set of measurements (PIDs): engine speed, vehicle speed, coolant temperature, load, fuel trims, O2 sensor voltages, module voltage, air flow, manifold pressure, fuel level. This data does NOT cover the whole vehicle: braking, suspension, steering, clutch, body and automatic transmission are only accessible through manufacturer protocols or extended modes. A petrol engine approved since 2001 (and a diesel since about 2004) must expose a minimal PID list, but each manufacturer chooses which additional PIDs it exposes. Practical consequence: the absence of a fault code does not mean the absence of a problem, and the absence of a measurement does not mean the part is healthy — it means XAMOTO cannot check it by this means.',
    tags: ['obd', 'pid', 'limites', 'lecture', 'diagnostic', 'limitations'],
    relatesTo: {},
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_dtc_nomenclature',
    sourceId: 'src_sae_j2012',
    titleFr: 'Comment lire un code défaut (P, C, B, U)',
    titleEn: 'How to read a fault code (P, C, B, U)',
    contentFr:
      'Un code défaut comporte une lettre, un chiffre et trois caractères hexadécimaux. La lettre désigne le système : P = groupe motopropulseur (moteur, injection, allumage, dépollution, transmission), C = châssis (freinage, ABS, direction), B = carrosserie (airbags, vitres, éclairage), U = réseau de communication entre calculateurs. Le premier chiffre indique le type de code : 0 = code générique normalisé, identique chez tous les constructeurs ; 1 = code spécifique au constructeur, dont la signification dépend de la marque et souvent du modèle et de l’année. Un code « générique » décrit donc une condition détectée, mais jamais la pièce responsable : P0171 signifie « mélange trop pauvre banque 1 », pas « capteur débitmètre à remplacer ». C’est cette distinction que XAMOTO applique systématiquement : un code décrit un symptôme mesuré par le calculateur, pas un diagnostic.',
    contentEn:
      'A fault code has a letter, a digit and three hexadecimal characters. The letter indicates the system: P = powertrain (engine, injection, ignition, emissions, transmission), C = chassis (braking, ABS, steering), B = body (airbags, windows, lighting), U = communication network between control modules. The first digit indicates the code type: 0 = generic standardised code, identical across manufacturers; 1 = manufacturer-specific code whose meaning depends on the brand and often the model and year. A "generic" code therefore describes a detected condition, never the responsible part: P0171 means "system too lean bank 1", not "replace the mass air flow sensor". This is the distinction XAMOTO applies systematically: a code describes a condition measured by the ECU, not a diagnosis.',
    tags: ['dtc', 'nomenclature', 'code', 'sae', 'j2012'],
    relatesTo: {},
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_catalyst_p0420',
    sourceId: 'src_xamoto_practice',
    titleFr: 'P0420 — efficacité du catalyseur insuffisante : pourquoi ce n’est pas forcément le catalyseur',
    titleEn: 'P0420 — catalyst efficiency below threshold: why it is not necessarily the catalyst',
    contentFr:
      'Le code P0420 est produit par une comparaison : le calculateur compare l’activité de la sonde O2 amont (avant le catalyseur) et celle de la sonde aval (après). Lorsque la sonde aval commence à osciller comme la sonde amont, le calculateur conclut que le catalyseur ne stocke plus correctement l’oxygène. Plusieurs situations produisent ce même signal, sans que le catalyseur soit en cause : une fuite d’échappement en amont de la sonde aval (l’air extérieur fausse la mesure), une sonde aval défaillante ou faussée, un mélange trop riche ou trop pauvre non corrigé, des ratés d’allumage persistants, une consommation d’huile ou de liquide de refroidissement qui contamine le catalyseur. Méthode d’atelier recommandée : d’abord vérifier qu’aucun autre défaut moteur n’est présent (mélange, ratés, température), ensuite vérifier l’étanchéité de l’échappement avant la sonde aval, puis seulement après évaluer le catalyseur. Remplacer un catalyseur sur un moteur dont le mélange est incorrect conduit presque toujours à la destruction du catalyseur neuf.',
    contentEn:
      'Code P0420 is produced by a comparison: the ECU compares the activity of the upstream O2 sensor (before the catalyst) with the downstream one (after). When the downstream sensor starts oscillating like the upstream one, the ECU concludes the catalyst no longer stores oxygen properly. Several situations produce the same signal without the catalyst being at fault: an exhaust leak upstream of the downstream sensor (outside air corrupts the measurement), a faulty or biased downstream sensor, an uncorrected rich or lean mixture, persistent misfires, oil or coolant consumption contaminating the catalyst. Recommended workshop method: first verify no other engine fault is present (mixture, misfires, temperature), then check exhaust sealing upstream of the downstream sensor, and only then evaluate the catalyst. Replacing a catalyst on an engine with an incorrect mixture almost always leads to destroying the new catalyst.',
    tags: ['p0420', 'catalyseur', 'sonde o2', 'depollution', 'emission', 'catalyst'],
    relatesTo: { dtc: ['P0420', 'P0430', 'P0134'], systems: ['depollution'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_lean_p0171',
    sourceId: 'src_xamoto_practice',
    titleFr: 'P0171 — mélange pauvre : une condition, plusieurs causes possibles',
    titleEn: 'P0171 — lean mixture: one condition, several possible causes',
    contentFr:
      'Le calculateur ajuste en permanence la quantité de carburant injectée à partir de l’information d’oxygène dans l’échappement. Les corrections à court terme (STFT) réagissent immédiatement, les corrections à long terme (LTFT) mémorisent la tendance. Lorsqu’une correction positive atteint sa limite (souvent autour de +25 % selon les constructeurs), le calculateur mémorise P0171 : le moteur reçoit trop d’air pour le carburant disponible. Causes classiques : prise d’air à l’admission (joints, durites, collecteur, servofrein), capteur de débit d’air encrassé qui sous-estime le débit, pression de carburant insuffisante (filtre colmaté, pompe faible, régulateur), injecteurs encrassés, sonde O2 amont faussée, fuite d’échappement en amont de la sonde. L’ordre de vérification le plus rentable commence par la recherche de prise d’air et le contrôle du débit d’air, car ces causes sont fréquentes et peu coûteuses à tester. Les corrections de carburant ne sont interprétables que moteur chaud, en boucle fermée.',
    contentEn:
      'The ECU continuously adjusts injected fuel quantity based on the oxygen information in the exhaust. Short term trims (STFT) react immediately, long term trims (LTFT) memorise the trend. When a positive trim reaches its limit (often around +25 % depending on the manufacturer), the ECU stores P0171: the engine receives too much air for the available fuel. Classic causes: intake air leak (gaskets, hoses, manifold, brake booster), dirty mass air flow sensor under-reporting flow, insufficient fuel pressure (clogged filter, weak pump, regulator), clogged injectors, biased upstream O2 sensor, exhaust leak upstream of the sensor. The most cost-effective inspection order starts with air leak detection and air flow checking, as these causes are frequent and cheap to test. Fuel trims can only be interpreted with a warm engine in closed loop.',
    tags: ['p0171', 'melange pauvre', 'prise d air', 'debitmetre', 'fuel trim', 'lean'],
    relatesTo: { dtc: ['P0171', 'P0174', 'P0101'], systems: ['carburant', 'admission'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_misfire_p0300',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Ratés d’allumage (P0300 à P0304) : allumage, injection, compression',
    titleEn: 'Misfires (P0300 to P0304): ignition, injection, compression',
    contentFr:
      'Le calculateur détecte les ratés en analysant les variations de vitesse angulaire du vilebrequin : un cylindre qui brûle mal fait légèrement ralentir le moteur au moment de sa combustion. Un code P0301 cible le cylindre 1, P0300 signale des ratés répartis sur plusieurs cylindres. Trois familles de causes existent, et le diagnostic doit les séparer AVANT de remplacer des pièces : (1) allumage — bougie usée, écartement incorrect, bobine fatiguée, câblage ; (2) injection — injecteur encrassé, bouché ou fuyard, pression de carburant insuffisante ; (3) mécanique — compression insuffisante (soupapes, segments, joint de culasse), calibration de distribution. Le test le plus discriminant et le moins coûteux consiste à permuter la bobine (et éventuellement l’injecteur) vers un autre cylindre : si le défaut se déplace avec la pièce, la pièce est en cause ; s’il reste sur le même cylindre, la cause est ailleurs. Un voyant moteur clignotant associé à des ratés signale un risque de destruction du catalyseur par le carburant non brûlé : la conduite doit être interrompue.',
    contentEn:
      'The ECU detects misfires by analysing crankshaft angular speed variations: a cylinder burning poorly slightly slows the engine at its combustion moment. Code P0301 targets cylinder 1, P0300 indicates misfires spread over several cylinders. Three families of causes exist, and the diagnosis must separate them BEFORE replacing parts: (1) ignition — worn plug, incorrect gap, tired coil, wiring; (2) injection — clogged, blocked or leaking injector, insufficient fuel pressure; (3) mechanical — insufficient compression (valves, rings, head gasket), valve timing calibration. The most discriminating and cheapest test is to swap the coil (and possibly injector) to another cylinder: if the fault moves with the part, the part is at fault; if it stays on the same cylinder, the cause is elsewhere. A flashing check-engine light associated with misfires indicates a risk of catalyst destruction from unburnt fuel: driving must be interrupted.',
    tags: ['p0300', 'p0301', 'rates', 'allumage', 'bobine', 'bougie', 'misfire'],
    relatesTo: { dtc: ['P0300', 'P0301', 'P0302', 'P0303', 'P0304', 'P0351'], systems: ['allumage'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_egr_dpf',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Recirculation des gaz et filtre à particules : les défauts liés à l’usage urbain',
    titleEn: 'Exhaust gas recirculation and particulate filter: faults linked to urban use',
    contentFr:
      'Sur les moteurs diesel, deux organes concentrent les défauts liés à l’usage : la vanne EGR (recirculation des gaz d’échappement) et le filtre à particules (FAP). L’EGR réinjecte une partie des gaz d’échappement pour réduire les oxydes d’azote ; les suies qu’elle transporte encrassent progressivement la vanne et les conduits d’admission. Résultat fréquent : P0401 (débit EGR insuffisant), ralenti instable, à-coups, fumée noire. Le FAP piège les particules et les brûle lors de cycles de régénération qui exigent une température et une durée de roulage suffisantes (souvent plusieurs dizaines de minutes à régime soutenu). En usage exclusivement urbain, en embouteillage ou par trajets très courts, ces cycles ne se terminent pas : la suie s’accumule et produit P2002 / P2463, parfois avec passage en mode dégradé. Méthode recommandée : vérifier d’abord l’état du filtre à air et l’absence de codes d’injection, contrôler la mobilité de la vanne EGR et l’encrassement des conduits, contrôler la mesure de pression différentielle du FAP (capteur et durites). Une régénération forcée en atelier peut suffire, mais elle ne dispense pas de corriger la cause de la production excessive de suie.',
    contentEn:
      'On diesel engines, two components concentrate usage-related faults: the EGR valve (exhaust gas recirculation) and the particulate filter (DPF). EGR re-injects part of the exhaust gases to reduce nitrogen oxides; the soot it carries progressively fouls the valve and intake passages. Frequent result: P0401 (insufficient EGR flow), unstable idle, jerking, black smoke. The DPF traps particles and burns them during regeneration cycles that require sufficient temperature and driving duration (often several tens of minutes at sustained speed). In exclusively urban use, in traffic or on very short trips, these cycles do not complete: soot accumulates and produces P2002 / P2463, sometimes with limp mode. Recommended method: first check the air filter condition and the absence of injection codes, check EGR valve movement and passage fouling, check DPF differential pressure measurement (sensor and hoses). Forced regeneration in a workshop may be enough, but does not remove the need to correct the cause of excessive soot production.',
    tags: ['egr', 'fap', 'dpf', 'p0401', 'p2002', 'p2463', 'diesel', 'urbain'],
    relatesTo: { dtc: ['P0401', 'P2002', 'P2463'], systems: ['depollution'], fuelTypes: ['diesel'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_battery_charging',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Batterie et circuit de charge : méthode de contrôle en trois étapes',
    titleEn: 'Battery and charging circuit: three-step check method',
    contentFr:
      'Trois mesures suffisent à situer un problème électrique. 1) Tension de repos : contact coupé, tous consommateurs éteints, après quelques minutes de repos ; une batterie au plomb 12 V bien chargée se situe autour de 12,6 V, et en dessous de 12,2 V elle est insuffisamment chargée. 2) Tension de charge : moteur tournant, un alternateur en bon état maintient généralement entre environ 13,5 et 14,5 V, y compris avec plusieurs consommateurs allumés. 3) Recherche de décharge : véhicule en veille après fermeture complète, mesurer le courant résiduel pour détecter un consommateur parasite. Dans un climat chaud, la durée de vie des batteries diminue nettement, et les trajets courts répétés empêchent la recharge complète : une batterie peut être « bonne » mais systématiquement sous-chargée. Avant de remplacer une batterie, il faut donc vérifier la tension de charge et l’absence de consommateur parasite — sinon la batterie neuve se dégradera de la même manière.',
    contentEn:
      'Three measurements are enough to locate an electrical problem. 1) Rest voltage: ignition off, all consumers off, after a few minutes of rest; a well-charged 12 V lead-acid battery sits around 12.6 V, and below 12.2 V it is undercharged. 2) Charging voltage: with the engine running, a healthy alternator typically maintains about 13.5 to 14.5 V, including with several consumers on. 3) Drain search: vehicle in sleep mode after full closure, measure residual current to detect a parasitic load. In hot climates battery life drops significantly, and repeated short trips prevent full recharging: a battery can be "good" yet systematically undercharged. Before replacing a battery, charging voltage and the absence of parasitic drain must be checked — otherwise the new battery will degrade in the same way.',
    tags: ['batterie', 'alternateur', 'charge', 'p0562', 'tension', 'electrique'],
    relatesTo: { dtc: ['P0562', 'P0563', 'P0335'], systems: ['electrique'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_overheating',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Surchauffe moteur : ordre de vérification et danger',
    titleEn: 'Engine overheating: inspection order and danger',
    contentFr:
      'Une surchauffe est traitée comme une urgence : au-delà de la plage normale (environ 75 à 105 °C pour la plupart des moteurs), le risque est la déformation de culasse, la destruction du joint de culasse et le serrage du moteur. Aucune ouverture du bouchon de vase d’expansion ne doit être faite moteur chaud : le liquide sous pression provoque des brûlures graves. Ordre de vérification à froid : niveau et état du liquide, traces de fuite (durites, radiateur, pompe à eau, boîtier de sortie), déclenchement du ventilateur de refroidissement, montée en température dans le temps (thermostat), homogénéité de la température du radiateur (colmatage, ailettes obstruées par la poussière), puis recherche de gaz de combustion dans le liquide (joint de culasse). Dans un contexte de chaleur, d’embouteillages et de poussière, le nettoyage du faisceau du radiateur et le contrôle du ventilateur sont des gestes prioritaires et peu coûteux.',
    contentEn:
      'Overheating is treated as an emergency: beyond the normal range (about 75 to 105 °C for most engines) the risk is cylinder head warping, head gasket failure and engine seizure. The expansion tank cap must never be opened with a hot engine: pressurised coolant causes severe burns. Cold inspection order: coolant level and condition, leak traces (hoses, radiator, water pump, outlet housing), cooling fan activation, temperature rise over time (thermostat), radiator temperature uniformity (blockage, fins blocked by dust), then search for combustion gases in the coolant (head gasket). In a context of heat, traffic jams and dust, cleaning the radiator fins and checking the fan are priority, low-cost actions.',
    tags: ['surchauffe', 'refroidissement', 'p0217', 'thermostat', 'ventilateur', 'joint de culasse'],
    relatesTo: { dtc: ['P0217', 'P0128', 'P0117', 'P0118'], systems: ['moteur'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_sensors_o2_maf_map',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Sondes et capteurs : interpréter une mesure avant de remplacer',
    titleEn: 'Sensors: interpreting a measurement before replacing',
    contentFr:
      'Un capteur ne « tombe pas en panne » de la même manière qu’une pièce mécanique : il se dégrade progressivement, se salit, ou son câblage vieillit. La méthode consiste à vérifier la COHÉRENCE de la mesure, pas seulement sa présence. Sonde O2 amont : moteur chaud en boucle fermée, elle doit osciller rapidement entre une tension basse et une tension haute ; une tension figée oriente vers une sonde en fin de vie, mais aussi vers une fuite d’échappement, un câblage ou un mélange anormal. Capteur de débit d’air (MAF) : sa valeur doit augmenter de façon cohérente avec le régime et la charge ; un capteur encrassé sous-estime souvent le débit et provoque un mélange pauvre. Capteur de pression de collecteur (MAP) : contact mis moteur arrêté, la pression doit être proche de la pression atmosphérique du lieu ; au ralenti elle doit chuter nettement. Capteurs de position (vilebrequin, arbre à cames) : c’est l’absence de signal pendant le démarrage qui est discriminante. Dans tous les cas, le contrôle du connecteur et du faisceau précède le remplacement de la pièce.',
    contentEn:
      'A sensor does not "fail" the way a mechanical part does: it degrades progressively, gets dirty, or its wiring ages. The method consists in checking the CONSISTENCY of the measurement, not just its presence. Upstream O2 sensor: with a warm engine in closed loop, it should oscillate rapidly between a low and a high voltage; a fixed voltage points to a sensor at end of life, but also to an exhaust leak, wiring or an abnormal mixture. Mass air flow sensor (MAF): its value should increase consistently with engine speed and load; a dirty sensor often under-reports flow and causes a lean mixture. Manifold pressure sensor (MAP): ignition on with the engine off, pressure should be close to local atmospheric pressure; at idle it should drop clearly. Position sensors (crankshaft, camshaft): the absence of signal during cranking is the discriminating element. In all cases, checking the connector and harness comes before replacing the part.',
    tags: ['capteur', 'sonde o2', 'maf', 'map', 'vilebrequin', 'arbre a cames', 'sensor'],
    relatesTo: { dtc: ['P0134', 'P0101', 'P0102', 'P0106', 'P0335', 'P0340'], systems: ['admission', 'allumage', 'depollution'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_can_i_drive_method',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Méthode « puis-je rouler ? » : comment XAMOTO raisonne',
    titleEn: '"Can I drive?" method: how XAMOTO reasons',
    contentFr:
      'La question « puis-je rouler ? » est une question de sécurité, pas de confort. XAMOTO la traite en quatre temps. 1) Y a-t-il un danger immédiat identifiable ? Sont concernés : voyant de pression d’huile allumé, pédale de frein molle ou perte de freinage, surchauffe constatée, direction anormalement dure, odeur de carburant, voyant moteur clignotant avec ratés, calages répétés en circulation, tension effondrée moteur tournant sur un véhicule récent. Ces situations imposent l’arrêt. 2) Les données permettent-elles de se prononcer ? Si aucune mesure ni aucun code n’est disponible, XAMOTO ne peut pas garantir la sécurité et le dit. 3) Quelle est la gravité intrinsèque des codes présents ? Un défaut de catalyseur et un défaut de capteur de vilebrequin n’ont pas le même poids. 4) Quelles précautions réduire le risque en attendant le contrôle ? XAMOTO recommande alors ce qu’il faut éviter (accélérations fortes, embouteillages, longs trajets, effacement des défauts) et quand consulter. XAMOTO ne délivre jamais d’autorisation de rouler : il qualifie un risque à partir de données.',
    contentEn:
      'The question "can I drive?" is a safety question, not a comfort one. XAMOTO handles it in four steps. 1) Is there an identifiable immediate danger? These include: oil pressure light on, soft brake pedal or brake loss, observed overheating, abnormally stiff steering, fuel smell, flashing check-engine light with misfires, repeated stalling in traffic, voltage collapse with the engine running on a recent vehicle. These situations require stopping. 2) Does the data allow a conclusion? If no measurement or code is available, XAMOTO cannot guarantee safety and says so. 3) What is the intrinsic severity of the present codes? A catalyst fault and a crankshaft sensor fault do not carry the same weight. 4) Which precautions reduce risk while waiting for a check? XAMOTO then recommends what to avoid (hard acceleration, traffic jams, long trips, clearing faults) and when to seek help. XAMOTO never issues permission to drive: it characterises a risk from data.',
    tags: ['puis-je rouler', 'securite', 'can i drive', 'danger', 'risque'],
    relatesTo: {},
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_repair_verification',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Vérifier une réparation : pourquoi un effacement ne prouve rien',
    titleEn: 'Verifying a repair: why clearing faults proves nothing',
    contentFr:
      'Effacer un code défaut ne répare rien et ne prouve rien : cela remet à zéro la mémoire du calculateur. Certains défauts se confirment en quelques minutes, d’autres demandent plusieurs cycles de conduite complets — un cycle étant en général un démarrage à froid suivi d’un roulage avec montée en température, ralenti, accélération et décélération. Les défauts de catalyseur (P0420), de circuit de vapeurs de carburant (P0442, P0455) et de filtre à particules (P2002, P2463) font partie de ceux qui demandent le plus de temps : ils peuvent disparaître après effacement puis revenir plusieurs jours plus tard. La méthode correcte consiste donc à : relever les codes et les mesures AVANT l’intervention, effectuer la réparation, effacer le code, rouler réellement (plusieurs trajets), refaire un scan, et comparer les deux relevés. Si le code revient, la cause n’a pas été traitée — et XAMOTO le dit sans détour, pour éviter de payer deux fois la même réparation.',
    contentEn:
      'Clearing a fault code repairs nothing and proves nothing: it resets the ECU memory. Some faults are confirmed within minutes, others require several complete drive cycles — a cycle generally being a cold start followed by driving with warm-up, idle, acceleration and deceleration. Catalyst faults (P0420), fuel vapour circuit faults (P0442, P0455) and particulate filter faults (P2002, P2463) are among those requiring the most time: they can disappear after clearing and return several days later. The correct method is therefore: record codes and measurements BEFORE the work, perform the repair, clear the code, actually drive (several trips), rescan, and compare both records. If the code returns, the cause was not addressed — and XAMOTO says so plainly, to avoid paying twice for the same repair.',
    tags: ['reparation', 'verification', 'effacement', 'cycle de conduite', 'apres reparation'],
    relatesTo: { dtc: ['P0420', 'P0442', 'P0455', 'P2002', 'P2463'], systems: ['depollution'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_fuel_quality_west_africa',
    sourceId: 'src_african_context',
    titleFr: 'Qualité du carburant et conséquences mécaniques observables',
    titleEn: 'Fuel quality and observable mechanical consequences',
    contentFr:
      'La qualité du carburant disponible varie selon les stations, les livraisons et les périodes. Trois situations produisent des symptômes mesurables : la présence d’eau (démarrage difficile, ratés, corrosion du circuit d’injection), un indice d’octane ou de cétane insuffisant (cliquetis, perte de rendement, surchauffe en charge), et des impuretés ou dépôts (colmatage du filtre à carburant, encrassement des injecteurs, dégradation de la pompe). Ces situations produisent des codes que l’on attribue souvent à tort à un capteur : P0171, P0300, P0087, P0401. L’analyse de carburant (échantillon au filtre ou au réservoir, contrôle de la séparation eau/carburant, examen du filtre) est peu coûteuse et doit être envisagée lorsque plusieurs codes apparaissent simultanément sans cause mécanique évidente. XAMOTO utilise ce contexte comme ORIENTATION de recherche : il ne conclut jamais à une panne à partir de la qualité du carburant sans test sur le véhicule.',
    contentEn:
      'Fuel quality available varies between stations, deliveries and periods. Three situations produce measurable symptoms: water content (hard starting, misfires, injection circuit corrosion), insufficient octane or cetane rating (knocking, efficiency loss, overheating under load), and impurities or deposits (fuel filter clogging, injector fouling, pump degradation). These situations produce codes often wrongly attributed to a sensor: P0171, P0300, P0087, P0401. Fuel analysis (sample at the filter or tank, water/fuel separation check, filter inspection) is cheap and should be considered when several codes appear simultaneously without an obvious mechanical cause. XAMOTO uses this context as a RESEARCH ORIENTATION: it never concludes a fault from fuel quality without a test on the vehicle.',
    tags: ['carburant', 'qualite', 'eau', 'injecteurs', 'afrique', 'senegal'],
    relatesTo: { dtc: ['P0171', 'P0300', 'P0087', 'P0401'], systems: ['carburant', 'injection'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_dust_heat_maintenance',
    sourceId: 'src_african_context',
    titleFr: 'Chaleur, poussière, embouteillages : ce que cela change dans l’entretien',
    titleEn: 'Heat, dust, traffic: what changes in maintenance',
    contentFr:
      'Trois facteurs d’usage modifient les intervalles d’entretien habituels. La poussière (saison sèche, pistes, chantiers) colmate le filtre à air plus vite, encrasse le boîtier papillon, obstrue les ailettes du radiateur et du condenseur de climatisation. La chaleur accélère le vieillissement de la batterie, des liquides, des durites et des plastiques, et augmente la charge du système de refroidissement et de la climatisation. Les embouteillages et trajets courts empêchent la montée en température complète du moteur et du filtre à particules, et multiplient les freinages. Conséquences pratiques documentées : inspection plus fréquente du filtre à air, nettoyage du radiateur et du condenseur, contrôle plus régulier de la batterie et des plaquettes de frein, vigilance sur le FAP pour les diesels. Ces facteurs doivent être annoncés comme CONTEXTE : ils modifient la fréquence des contrôles, ils ne remplacent jamais un test technique, et ils ne permettent pas de conclure qu’une pièce est usée.',
    contentEn:
      'Three usage factors change usual service intervals. Dust (dry season, dirt roads, construction sites) clogs the air filter faster, fouls the throttle body, blocks radiator and air conditioning condenser fins. Heat accelerates the ageing of the battery, fluids, hoses and plastics, and increases the load on cooling and air conditioning. Traffic jams and short trips prevent complete engine and particulate filter warm-up, and multiply braking events. Documented practical consequences: more frequent air filter inspection, radiator and condenser cleaning, more regular battery and brake pad checks, DPF vigilance for diesels. These factors must be stated as CONTEXT: they change how often checks are done, they never replace a technical test, and they do not allow concluding that a part is worn.',
    tags: ['poussiere', 'chaleur', 'entretien', 'afrique', 'climat', 'embouteillages'],
    relatesTo: {},
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_used_car_inspection',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Inspection avant achat : ce que l’OBD peut révéler, et ses angles morts',
    titleEn: 'Pre-purchase inspection: what OBD can reveal, and its blind spots',
    contentFr:
      'Lors de l’achat d’un véhicule d’occasion, l’outil de diagnostic apporte des éléments factuels impossibles à obtenir à l’œil : codes mémorisés, codes en attente, contexte d’apparition des défauts, données de fonctionnement (température, corrections de carburant, compteurs de ratés), état du voyant. Deux limites doivent être annoncées clairement. Première limite : des défauts récemment effacés ne laissent parfois aucune trace exploitable — d’où l’importance de rouler avant le contrôle (idéalement plusieurs dizaines de kilomètres), de vérifier le nombre de cycles et de distances enregistrés si le véhicule les expose, et d’exiger une période d’essai. Deuxième limite : l’OBD ne voit pas le freinage, la suspension, la direction, l’embrayage, la carrosserie, ni l’usure réelle. Un rapport d’inspection XAMOTO indique donc explicitement les points « non contrôlés » : cette transparence fait partie de la valeur du rapport. Un véhicule sans code défaut n’est pas un véhicule vérifié.',
    contentEn:
      'When buying a used vehicle, the diagnostic tool provides factual elements impossible to obtain visually: stored codes, pending codes, fault context, operating data (temperature, fuel trims, misfire counters), warning light state. Two limitations must be stated clearly. First limitation: recently cleared faults sometimes leave no usable trace — hence the importance of driving before the check (ideally several tens of kilometres), checking recorded cycle and distance counters if the vehicle exposes them, and requesting a trial period. Second limitation: OBD cannot see braking, suspension, steering, clutch, bodywork or actual wear. A XAMOTO inspection report therefore explicitly lists "not checked" items: this transparency is part of the report value. A vehicle without fault codes is not a verified vehicle.',
    tags: ['inspection', 'achat', 'occasion', 'rapport', 'used car'],
    relatesTo: {},
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_evap_system',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Circuit de vapeurs de carburant (EVAP) : cause fréquente, réparation souvent simple',
    titleEn: 'Fuel vapour system (EVAP): frequent cause, often simple repair',
    contentFr:
      'Le circuit EVAP empêche les vapeurs de carburant de s’échapper dans l’atmosphère : le réservoir est mis en légère dépression et les vapeurs sont stockées dans un canister à charbon actif, puis brûlées par le moteur lors de cycles de purge. Le calculateur teste l’étanchéité du circuit et mémorise P0442 (petite fuite), P0455 (fuite importante) ou P0456 (très petite fuite). La cause la plus fréquente et la moins coûteuse reste le bouchon de réservoir mal fermé, absent ou dont le joint est durci — surtout avec les écarts de température et la poussière. Viennent ensuite les durites de canister fissurées, l’électrovanne de purge et le canister lui-même. Ces défauts n’affectent pratiquement pas la conduite, mais ils allument le voyant et reviennent après effacement tant que la fuite existe. Méthode : vérifier d’abord le bouchon, rouler plusieurs jours, puis rechercher la fuite par mise en pression si le défaut revient.',
    contentEn:
      'The EVAP system prevents fuel vapour from escaping into the atmosphere: the tank is placed under slight vacuum, vapours are stored in an activated charcoal canister and burned by the engine during purge cycles. The ECU tests circuit sealing and stores P0442 (small leak), P0455 (large leak) or P0456 (very small leak). The most frequent and cheapest cause remains a loose or missing fuel cap, or one whose seal has hardened — especially with temperature swings and dust. Next come cracked canister hoses, the purge solenoid and the canister itself. These faults hardly affect driving, but they light the warning lamp and return after clearing as long as the leak exists. Method: check the cap first, drive for several days, then look for the leak by pressure testing if the fault returns.',
    tags: ['evap', 'p0442', 'p0455', 'bouchon', 'canister', 'vapeurs'],
    relatesTo: { dtc: ['P0442', 'P0455'], systems: ['depollution'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_turbo_diesel',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Suralimentation diesel : fuites, commande et capteurs',
    titleEn: 'Diesel turbocharging: leaks, control and sensors',
    contentFr:
      'Sur un moteur diesel suralimenté, la perte de puissance (P0299) ou la surpression (P0234) proviennent de trois familles de causes : une fuite du circuit de suralimentation (durite fissurée, collier desserré, échangeur percé — cause la plus fréquente et la moins coûteuse à corriger), un défaut de commande (électrovanne, wastegate ou géométrie variable bloquée par les suies), ou une usure du turbocompresseur lui-même. La géométrie variable s’encrasse particulièrement en usage urbain et sur les moteurs fortement kilométrés. Méthode recommandée, du moins coûteux au plus coûteux : inspection visuelle et contrôle des colliers, vérification du mouvement de la commande sous dépression ou commande d’actionneur, vérification de la cohérence de la mesure de pression de suralimentation avec la consigne, et contrôle de la mesure du capteur MAP avant de suspecter le turbo. Remplacer un turbocompresseur sans avoir vérifié l’étanchéité du circuit et la commande revient souvent à payer une pièce coûteuse inutilement.',
    contentEn:
      'On a turbocharged diesel engine, power loss (P0299) or overboost (P0234) come from three families of causes: a boost circuit leak (split hose, loose clamp, punctured intercooler — the most frequent and cheapest cause to fix), a control fault (solenoid, wastegate or variable geometry seized by soot), or wear of the turbocharger itself. Variable geometry fouls particularly in urban use and on high-mileage engines. Recommended method, from cheapest to most expensive: visual inspection and clamp check, actuator movement check under vacuum or actuator command, verification that measured boost pressure matches the setpoint, and MAP sensor measurement check before suspecting the turbo. Replacing a turbocharger without having checked circuit sealing and control often means paying for an expensive part unnecessarily.',
    tags: ['turbo', 'suralimentation', 'p0299', 'p0234', 'diesel', 'geometrie variable'],
    relatesTo: { dtc: ['P0299', 'P0234'], systems: ['admission'], fuelTypes: ['diesel'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_braking_abs',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Freinage et ABS : lire un code de châssis sans se tromper',
    titleEn: 'Braking and ABS: reading a chassis code without getting it wrong',
    contentFr:
      'Les codes de châssis (C0xxx) et les codes réseau (U0xxx) ont une particularité : ils peuvent être produits par une cause électrique et non mécanique. Un capteur de vitesse de roue « en défaut » (C0035 pour la roue avant gauche) résulte souvent, dans un contexte de poussière et d’humidité, d’une bague magnétique encrassée, d’un connecteur oxydé ou d’un câblage frotté près de la roue, plutôt que du capteur lui-même. Une perte de communication avec le calculateur ABS (U0121) vient fréquemment d’un fusible, d’une masse défectueuse ou d’un connecteur. Méthode : lire les quatre vitesses de roue en temps réel et rouler très lentement en ligne droite — la comparaison est bien plus parlante qu’un code isolé ; puis inspecter et nettoyer bague magnétique, connecteurs et faisceaux avant de remplacer un capteur. Les codes de freinage touchent à la sécurité : un voyant ABS ou frein allumé ne doit jamais être ignoré, même si le freinage classique fonctionne encore.',
    contentEn:
      'Chassis codes (C0xxx) and network codes (U0xxx) have a specific feature: they can be produced by an electrical rather than mechanical cause. A "faulty" wheel speed sensor (C0035 for the front left wheel) often results, in dusty and humid conditions, from a fouled reluctor ring, a corroded connector or chafed wiring near the wheel, rather than from the sensor itself. A loss of communication with the ABS module (U0121) frequently comes from a fuse, a bad ground or a connector. Method: read all four wheel speeds live and drive very slowly in a straight line — comparison is far more informative than an isolated code; then inspect and clean the reluctor ring, connectors and harnesses before replacing a sensor. Braking codes involve safety: an ABS or brake warning light must never be ignored, even if conventional braking still works.',
    tags: ['abs', 'freinage', 'c0035', 'u0121', 'capteur de roue', 'chassis'],
    relatesTo: { dtc: ['C0035', 'U0121', 'U0100'], systems: ['freinage', 'reseau'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_diagnostic_method',
    sourceId: 'src_xamoto_practice',
    titleFr: 'Méthode de diagnostic : mesurer, comparer, tester, jamais deviner',
    titleEn: 'Diagnostic method: measure, compare, test, never guess',
    contentFr:
      'Toute méthode de diagnostic rigoureuse suit le même ordre : 1) collecter les faits (codes, données de fonctionnement, contexte mémorisé au moment du défaut, symptômes décrits par le conducteur, historique des interventions) ; 2) formuler les hypothèses compatibles avec ces faits ; 3) choisir le test qui permet de séparer les hypothèses au coût le plus faible ; 4) exécuter le test et enregistrer le résultat ; 5) éliminer les hypothèses contredites et poursuivre avec celles qui restent ; 6) ne remplacer une pièce que lorsque le test la désigne, ou lorsque le coût de la pièce est inférieur au coût du test et que l’hypothèse est suffisamment forte. Cette dernière situation doit être annoncée honnêtement comme un pari, pas comme un diagnostic. XAMOTO applique exactement cet ordre, et refuse de passer à l’étape suivante quand l’étape précédente n’est pas disponible : c’est le sens de la règle « je ne dispose pas de cette donnée ».',
    contentEn:
      'Any rigorous diagnostic method follows the same order: 1) collect facts (codes, operating data, context stored when the fault appeared, symptoms described by the driver, repair history); 2) formulate hypotheses compatible with these facts; 3) choose the test that separates hypotheses at the lowest cost; 4) run the test and record the result; 5) eliminate contradicted hypotheses and continue with the remaining ones; 6) replace a part only when a test points to it, or when the part cost is lower than the test cost and the hypothesis is strong enough. The latter situation must be honestly announced as a bet, not as a diagnosis. XAMOTO applies exactly this order, and refuses to move to the next step when the previous one is unavailable: that is the meaning of the rule "I do not have this data".',
    tags: ['methode', 'diagnostic', 'hypotheses', 'tests', 'raisonnement'],
    relatesTo: {},
    version: V1,
    updatedAt: UPDATED,
  },
  /* ─────── Systèmes non lisibles par l'OBD : la limite est documentée ─────── */
  {
    id: 'doc_obd_readiness_monitors',
    sourceId: 'src_sae_j1979',
    titleFr: 'Tests de disponibilité : pourquoi un scan juste après un effacement ne prouve rien',
    titleEn: 'Readiness monitors: why a scan right after clearing proves nothing',
    contentFr:
      'Le calculateur ne surveille pas tout en permanence : il exécute des « moniteurs » (ratés d’allumage, circuit de carburant, catalyseur, sonde O2, circuit de vapeurs, EGR…) dans des conditions de conduite précises. Après un effacement de codes ou une coupure d’alimentation, ces moniteurs repassent à « non terminé » et le calculateur indique qu’il n’est « pas prêt ». Conséquence pour le diagnostic : un véhicule dont les moniteurs sont incomplets peut très bien avoir des défauts présents que le calculateur n’a pas encore eu l’occasion de détecter, et un véhicule « prêt » sans code défaut est un véhicule dont les moniteurs se sont exécutés — pas un véhicule dont toutes les pièces sont neuves. Pour un achat d’occasion, un effacement récent est un point à signaler : XAMOTO le fait apparaître au lieu de conclure que le véhicule est sain.',
    contentEn:
      'The ECU does not monitor everything continuously: it runs “monitors” (misfire, fuel system, catalyst, O2 sensor, evaporative system, EGR…) under specific driving conditions. After clearing codes or disconnecting the battery, these monitors return to “not complete” and the ECU reports “not ready”. Consequence for diagnosis: a vehicle with incomplete monitors may well have present faults the ECU has not yet had the chance to detect, and a “ready” vehicle with no fault code is a vehicle whose monitors ran — not a vehicle whose parts are all new. For a used-car purchase, a recent clear is a point to flag: XAMOTO surfaces it instead of concluding the vehicle is healthy.',
    tags: ['moniteurs', 'readiness', 'contrôle technique', 'effacement', 'achat occasion', 'monitors'],
    relatesTo: { systems: ['moteur', 'depollution'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_abs_braking_codes',
    sourceId: 'src_workshop_methods',
    titleFr: 'Freinage et ABS : pourquoi un code de châssis ne désigne jamais une pièce',
    titleEn: 'Braking and ABS: why a chassis code never names a part',
    contentFr:
      'Le calculateur de freinage surveille des signaux : vitesse de chaque roue, alimentation de ses propres circuits, cohérence entre les roues. Quand il mémorise un code de capteur, il dit « ce signal ne me parvient pas ou ne me convient pas », pas « cette pièce est morte ». L’ordre de vérification qui évite les remplacements inutiles est toujours le même : 1) la roue concernée — cible magnétique sale, limaille, boue, pneu de taille différente ; 2) le câblage — connecteur oxydé, fil coupé près de la roue, gaine frottée ; 3) la masse et l’alimentation du calculateur ; 4) le capteur lui-même ; 5) seulement en dernier, le calculateur. Deux points de méthode comptent. D’une part, comparer les quatre vitesses de roue en roulant lentement situe le circuit fautif sans rien démonter. D’autre part, le liquide de frein usé (chargé en eau) abaisse le point d’ébullition et se traduit par une pédale qui s’enfonce à chaud : c’est une cause réelle qui ne produit aucun code. XAMOTO ne fournit aucune épaisseur de plaquette ni aucune cote constructeur : ces valeurs appartiennent à la documentation du véhicule.',
    contentEn:
      'The braking module monitors signals: each wheel speed, the supply to its own circuits, consistency between wheels. When it stores a sensor code, it says “this signal does not reach me or does not suit me”, not “this part is dead”. The check order that avoids useless replacements is always the same: 1) the wheel concerned — dirty magnetic target, metal debris, mud, a different tyre size; 2) the wiring — corroded connector, wire broken near the wheel, chafed loom; 3) module ground and supply; 4) the sensor itself; 5) only last, the module. Two method points matter. First, comparing the four wheel speeds while driving slowly locates the faulty circuit without dismantling anything. Second, worn brake fluid (water-loaded) lowers the boiling point and shows up as a pedal that sinks when hot: a real cause that produces no code. XAMOTO provides no pad thickness and no manufacturer specification: those belong to the vehicle documentation.',
    tags: ['freinage', 'abs', 'capteur de roue', 'c0035', 'liquide de frein', 'chassis code'],
    relatesTo: { dtc: ['C0035', 'U0121'], systems: ['freinage', 'abs'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_airbag_pyrotechnic_safety',
    sourceId: 'src_workshop_methods',
    titleFr: 'Airbags et prétensionneurs : ce que XAMOTO refuse de guider, et pourquoi',
    titleEn: 'Airbags and pretensioners: what XAMOTO refuses to guide, and why',
    contentFr:
      'Un circuit d’airbag contient un détonateur. Une mesure faite avec un ohmmètre ou une alimentation envoyée dans ce circuit peut déclencher le déploiement : c’est rare, c’est grave, et c’est entièrement évitable. Les règles de sécurité s’appliquent sans exception : ne jamais mesurer un circuit de déclencheur, couper le contact et respecter le délai de décharge des condensateurs indiqué par le constructeur avant toute intervention, ne pas travailler sur un circuit sous tension, ne pas laisser un connecteur d’airbag débranché contact mis. Cela retire ce système de ce que XAMOTO peut accompagner : il n’existe pas de test guidé « airbag » dans l’application. En revanche, trois informations sont utiles et sûres : un voyant d’airbag allumé signifie que le système peut ne pas se déclencher et qu’un contrôle professionnel est nécessaire ; la cause la plus fréquente n’est pas un airbag mais un connecteur sous un siège (aspirateur, objets glissés, humidité) ; et un voyant d’airbag allumé peut faire échouer un contrôle technique dans plusieurs pays. XAMOTO dit cela, et s’arrête là.',
    contentEn:
      'An airbag circuit contains a detonator. A measurement made with an ohmmeter, or power sent into that circuit, can trigger deployment: it is rare, it is serious, and it is entirely avoidable. Safety rules apply without exception: never measure a deployer circuit, switch off the ignition and respect the manufacturer capacitor discharge delay before any work, never work on a live circuit, do not leave an airbag connector unplugged with the ignition on. This takes the system out of what XAMOTO can guide: there is no “airbag” guided test in the application. However, three pieces of information are useful and safe: a lit airbag warning light means the system may not deploy and a professional check is required; the most frequent cause is not an airbag but a connector under a seat (vacuum cleaner, objects slid underneath, moisture); and a lit airbag light can fail a roadworthiness test in several countries. XAMOTO says that, and stops there.',
    tags: ['airbag', 'prétensionneur', 'pyrotechnique', 'sécurité', 'voyant', 'safety'],
    relatesTo: { systems: ['airbag', 'carrosserie'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_automatic_transmission',
    sourceId: 'src_workshop_methods',
    titleFr: 'Boîte automatique : ce que l’OBD donne, et ce qu’il garde pour lui',
    titleEn: 'Automatic transmission: what OBD gives, and what it keeps to itself',
    contentFr:
      'Sur une boîte automatique, l’OBD standard apporte peu : quelques codes de groupe motopropulseur, dont le plus courant signale que le calculateur de boîte a demandé l’allumage du voyant moteur, ou qu’un capteur de vitesse d’entrée ne renvoie pas un signal correct. Les valeurs qui permettraient un vrai diagnostic — pression de ligne, températures, glissement des embrayages, temps de passage, historique des rapports — restent dans le calculateur de boîte, accessibles seulement par le protocole constructeur. Conséquence directe : « la boîte est morte » n’est jamais une conclusion recevable à partir d’un scan OBD. Ce qui est vérifiable sans outil constructeur : le niveau et l’état de l’huile de boîte (couleur, odeur de brûlé, présence de limaille), la propreté du connecteur du calculateur de boîte, l’état du refroidisseur d’huile de boîte, et surtout le contexte d’usage — embouteillages, pentes, remorquage, transports chargés accélèrent l’usure de l’huile. Enfin, une boîte qui « patine » à froid puis se comporte normalement à chaud n’a pas la même signification qu’une boîte qui patine en permanence : cette distinction, l’utilisateur peut la décrire, et XAMOTO l’enregistre.',
    contentEn:
      'On an automatic transmission, standard OBD gives little: a few powertrain codes, the most common being that the transmission module requested the check-engine light, or that an input speed sensor does not return a correct signal. The values that would allow a real diagnosis — line pressure, temperatures, clutch slip, shift times, gear history — stay inside the transmission module, reachable only through the manufacturer protocol. Direct consequence: “the gearbox is dead” is never an acceptable conclusion from an OBD scan. What is checkable without a manufacturer tool: transmission fluid level and condition (colour, burnt smell, metal debris), the cleanliness of the transmission module connector, the condition of the transmission oil cooler, and above all the usage context — traffic jams, slopes, towing, loaded transport accelerate fluid wear. Finally, a gearbox slipping when cold then behaving normally when hot does not mean the same as one slipping permanently: this distinction the driver can describe, and XAMOTO records it.',
    tags: ['boîte automatique', 'transmission', 'p0700', 'p0715', 'huile de boîte', 'automatic transmission'],
    relatesTo: { dtc: ['P0700', 'P0715'], systems: ['transmission'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_can_network_ucodes',
    sourceId: 'src_workshop_methods',
    titleFr: 'Réseau CAN : les codes U et la tentation de remplacer un calculateur',
    titleEn: 'CAN network: U codes and the temptation to replace a module',
    contentFr:
      'Les codes de la famille U signalent une communication interrompue ou perturbée entre calculateurs. Ce sont les codes qui coûtent le plus cher, parce qu’ils conduisent fréquemment à remplacer un boîtier qui n’était pas fautif. Une alimentation instable, une cosse de batterie desserrée, une masse moteur ou châssis oxydée, un connecteur mouillé et un fil pincé produisent exactement les mêmes codes qu’un calculateur en panne. L’ordre de vérification est donc invariable : tension de batterie au repos, tension de charge moteur tournant, état et serrage des cosses, continuité des masses, connecteurs des calculateurs concernés, puis seulement mesure du bus. Mesurer un bus CAN réellement demande un outil adapté (oscilloscope ou outil constructeur) : un multimètre moyenne les tensions et ne permet pas de conclure sur la forme du signal, la terminaison ou les perturbations. Deux situations particulières méritent d’être connues : sur certains véhicules, l’arrêt volontaire d’un calculateur de confort perturbe le réseau et allume plusieurs voyants ; et un premier scan suivi d’une batterie débranchée peut réveiller une série de codes U qui n’existent plus, parce que les calculateurs ne se sont pas encore re-synchronisés.',
    contentEn:
      'Codes in the U family indicate interrupted or disturbed communication between modules. They are the most expensive codes, because they frequently lead to replacing a module that was not at fault. An unstable supply, a loose battery terminal, a corroded engine or chassis ground, a wet connector and a pinched wire produce exactly the same codes as a failed module. The check order is therefore invariable: battery rest voltage, charging voltage with the engine running, terminal condition and tightness, ground continuity, connectors of the modules concerned, and only then bus measurement. Actually measuring a CAN bus requires a suitable tool (oscilloscope or manufacturer tool): a multimeter averages voltages and cannot conclude on signal shape, termination or interference. Two particular situations are worth knowing: on some vehicles, intentionally shutting down a comfort module disturbs the network and lights several warning lights; and a first scan followed by disconnecting the battery can wake a series of U codes that no longer exist, because modules have not re-synchronised yet.',
    tags: ['réseau', 'can', 'u0100', 'u0121', 'masse', 'module', 'network'],
    relatesTo: { dtc: ['U0100', 'U0121'], systems: ['reseau', 'electrique'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_air_conditioning_dust',
    sourceId: 'src_african_context',
    titleFr: 'Climatisation : nettoyer avant de recharger',
    titleEn: 'Air conditioning: clean before topping up',
    contentFr:
      'Une climatisation qui refroidit mal se termine trop souvent par une recharge de gaz. Dans un contexte de chaleur, de poussière et de circulation dense, l’ordre inverse est pourtant le bon : 1) le filtre d’habitacle, qui limite le débit d’air et donne l’impression que le froid a disparu ; 2) le condenseur, placé devant le radiateur, que le sable et les insectes obstruent progressivement — un simple rinçage à l’eau restitue souvent le refroidissement ; 3) l’enclenchement du compresseur et la courroie d’accessoires, faciles à observer moteur tournant ; 4) seulement ensuite, les pressions, qui exigent une station et une habilitation. Une fuite se recherche avant de recharger : recharger sans chercher la fuite revient à payer deux fois, et le fluide rejeté dans l’atmosphère n’est pas neutre. À l’arrêt, dans un véhicule garé au soleil, un écart de quelques degrés entre l’air extérieur et l’air soufflé peut n’être qu’un effet de l’ensoleillement : comparer sur un même trajet, pas au démarrage.',
    contentEn:
      'Poor air conditioning too often ends in a refrigerant top-up. In a context of heat, dust and dense traffic, the reverse order is the right one: 1) the cabin filter, which limits air flow and makes cooling feel lost; 2) the condenser, mounted in front of the radiator, which sand and insects progressively block — a simple water rinse often restores cooling; 3) compressor engagement and the accessory belt, easy to observe with the engine running; 4) only then, pressures, which require a station and certification. A leak is looked for before topping up: topping up without finding the leak means paying twice, and refrigerant released into the atmosphere is not neutral. When stationary, in a vehicle parked in the sun, a few degrees between outside and blown air can be a sunlight effect alone: compare on the same trip, not at start-up.',
    tags: ['climatisation', 'poussière', 'condenseur', 'filtre habitacle', 'fluide', 'climatisation afrique'],
    relatesTo: { systems: ['climatisation'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_clutch_manual_gearbox',
    sourceId: 'src_african_context',
    titleFr: 'Embrayage : distinguer un patinage d’un manque de puissance',
    titleEn: 'Clutch: telling slipping apart from a lack of power',
    contentFr:
      'Sur une boîte manuelle, une perte de puissance est souvent attribuée au moteur alors que l’embrayage patine — et l’inverse arrive aussi. Ce qui distingue les deux est observable sans outil : si le régime moteur monte franchement sans que la vitesse du véhicule suive, notamment en rapport élevé ou en côte, l’embrayage n’est plus capable de transmettre le couple. Trois situations accélèrent cette usure : la circulation en accordéon (embrayage utilisé en permanence), les démarrages en côte avec un véhicule chargé, et le fait de garder le pied posé sur la pédale d’embrayage en roulant. Deux erreurs symétriques sont à éviter : remplacer l’embrayage sur une simple impression sans avoir écarté une cause moteur (allumage, alimentation en carburant, prise d’air), et continuer à rouler sur un embrayage très usé, ce qui finit par user le volant moteur et transforme une réparation simple en réparation lourde. Un point de sécurité : un essai de patinage fait chauffer l’embrayage et ne doit pas être répété ; il se pratique sur une route dégagée, sans circulation, jamais en pente occupée.',
    contentEn:
      'On a manual gearbox, a loss of power is often blamed on the engine while the clutch is slipping — and the opposite happens too. The difference is observable without tools: if engine speed rises clearly without vehicle speed following, especially in a high gear or uphill, the clutch can no longer transmit torque. Three situations accelerate this wear: stop-and-go traffic (clutch used continuously), hill starts with a loaded vehicle, and keeping a foot resting on the clutch pedal while driving. Two symmetrical mistakes must be avoided: replacing the clutch on an impression without ruling out an engine cause (ignition, fuel supply, air leak), and continuing to drive on a very worn clutch, which eventually wears the flywheel and turns a simple repair into a major one. One safety point: a slip test heats the clutch and must not be repeated; it is done on an open road, without traffic, never on an occupied slope.',
    tags: ['embrayage', 'boîte manuelle', 'patinage', 'perte de puissance', 'clutch'],
    relatesTo: { systems: ['transmission', 'moteur'] },
    version: V1,
    updatedAt: UPDATED,
  },
  {
    id: 'doc_suspension_steering_vibration',
    sourceId: 'src_workshop_methods',
    titleFr: 'Vibrations et bruits de roulement : séparer les roues de la transmission',
    titleEn: 'Vibrations and bearing noises: separating wheels from the driveline',
    contentFr:
      'Une vibration n’est pas lisible par l’OBD : elle se situe par la vitesse à laquelle elle apparaît et par ce qui la fait varier. Une fréquence qui suit la vitesse du véhicule (et non le régime moteur) oriente vers les roues : équilibrage, pression, pneu déformé ou usé en facettes, plomb de balourd perdu, roulement de roue. Une fréquence qui suit le régime moteur oriente vers le moteur, son échappement ou un support fatigué. Une vibration qui apparaît au freinage pointe un disque voilé ou un moyeu sale. La vérification commence par ce qui ne coûte rien : pression des quatre pneus à froid et comparaison entre eux (une différence marquée suffit à créer une vibration et une usure irrégulière), examen visuel des flancs, puis, véhicule levé et posé sur chandelles, rotation à la main de chaque roue et recherche de jeu en saisissant la roue en haut et en bas. Enfin, une règle constante : une vibration apparue juste après le remplacement d’un pneu ou une réparation de suspension fait d’abord suspecter cette intervention récente — c’est le premier point à revoir, avant toute autre hypothèse.',
    contentEn:
      'A vibration cannot be read through OBD: it is located by the speed at which it appears and by what changes it. A frequency that follows vehicle speed (not engine speed) points to the wheels: balancing, pressure, a deformed or scalloped tyre, a lost balance weight, a wheel bearing. A frequency that follows engine speed points to the engine, its exhaust or a worn mount. A vibration appearing when braking points to a warped disc or a dirty hub. The check starts with what costs nothing: all four tyre pressures cold and compared with each other (a marked difference is enough to create vibration and uneven wear), a visual inspection of the sidewalls, then, with the vehicle lifted on stands, spinning each wheel by hand and looking for play by grabbing the wheel top and bottom. Finally, a constant rule: a vibration appearing just after a tyre change or suspension repair first makes that recent work suspect — it is the first thing to review, before any other hypothesis.',
    tags: ['vibration', 'roulement', 'équilibrage', 'pression des pneus', 'suspension', 'vibration'],
    relatesTo: { systems: ['transmission', 'moteur'] },
    version: V1,
    updatedAt: UPDATED,
  },
];

export const RAG_DOCUMENT_BY_ID = new Map(RAG_DOCUMENTS.map((d) => [d.id, d]));
