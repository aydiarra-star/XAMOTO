/**
 * XAMOTO — Tests guidés (§18, §51).
 *
 * Chaque test précise : objectif, matériel nécessaire, procédure, résultat
 * attendu LORSQUE CONNU, interprétation et niveau de sécurité.
 *
 * Règle (§16, §47-1) : lorsque la valeur attendue n'est pas documentée pour ce
 * véhicule, `expectedFr` vaut `null`. XAMOTO dit alors qu'il ne dispose pas de
 * la valeur de référence au lieu d'en inventer une.
 */
import type { GuidedTestDefinition } from '@xamoto/shared';

const T = (t: GuidedTestDefinition): GuidedTestDefinition => t;

const SOURCE_PRACTICE = 'src_xamoto_practice';
const SOURCE_SAE = 'src_sae_j1979';

export const GUIDED_TESTS: GuidedTestDefinition[] = [
  /* ───────────────────────────── Batterie / charge ──────────────────────── */
  T({
    id: 'test_battery_rest_voltage',
    titleFr: 'Mesurer la tension de batterie au repos',
    titleEn: 'Measure battery rest voltage',
    objectiveFr: 'Vérifier l’état de charge de la batterie avant toute autre mesure électrique.',
    objectiveEn: 'Check battery state of charge before any other electrical measurement.',
    equipment: ['Multimètre ou lecture OBD de la tension', 'Aucun outil spécialisé'],
    stepsFr: [
      'Couper le contact et éteindre tous les consommateurs (phares, autoradio, climatisation).',
      'Attendre au moins 10 minutes (ou laisser la batterie reposer après une nuit).',
      'Mesurer la tension directement aux bornes de la batterie, ou lire la tension OBD contact mis sans démarrer.',
      'Noter la valeur et la température ambiante (la tension baisse avec la chaleur).',
    ],
    stepsEn: [
      'Switch off the ignition and all consumers (lights, radio, air conditioning).',
      'Wait at least 10 minutes (or let the battery rest overnight).',
      'Measure voltage directly at the battery terminals, or read OBD voltage with ignition on, engine off.',
      'Record the value and the ambient temperature (voltage drops with heat).',
    ],
    expectedFr:
      'Batterie au repos, plomb-acide 12 V : environ 12,6 V pleinement chargée ; 12,2 V correspond à un état de charge d’environ 50 % ; en dessous de 12,0 V la batterie est insuffisamment chargée.',
    expectedEn:
      'Resting 12 V lead-acid battery: about 12.6 V fully charged; 12.2 V corresponds to roughly 50 % state of charge; below 12.0 V the battery is undercharged.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr:
          'Tension de repos inférieure à environ 12,2 V : charge insuffisante. La batterie, la charge (alternateur) ou un consommateur parasite est en cause. Vérifier ensuite la tension de charge.',
        meaningEn:
          'Resting voltage below about 12.2 V: insufficient charge. The battery, the charging system or a parasitic load is involved. Then check charging voltage.',
        confirms: ['battery_worn', 'parasitic_drain'],
      },
      {
        outcome: 'ok',
        meaningFr:
          'Tension de repos correcte : la batterie ne semble pas être la cause directe. Continuer avec la tension de charge et la recherche de défaut.',
        meaningEn: 'Correct resting voltage: the battery does not appear to be the direct cause. Continue with charging voltage and fault search.',
        excludes: ['battery_worn'],
      },
      {
        outcome: 'intermittent',
        meaningFr:
          'Tension instable : vérifier les cosses, les bornes et les masses avant de remplacer la batterie.',
        meaningEn: 'Unstable voltage: check terminals, clamps and grounds before replacing the battery.',
      },
    ],
    safety: 'normal',
    conditions: ['engine_off'],
    durationMin: 5,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_charging_voltage',
    titleFr: 'Contrôler la tension de charge (alternateur)',
    titleEn: 'Check charging voltage (alternator)',
    objectiveFr: 'Vérifier que l’alternateur recharge correctement la batterie moteur tournant.',
    objectiveEn: 'Verify the alternator correctly charges the battery with the engine running.',
    equipment: ['Multimètre (ou lecture OBD contact mis, moteur tournant)'],
    stepsFr: [
      'Démarrer le moteur et le laisser au ralenti.',
      'Mesurer la tension aux bornes de la batterie (ou la tension calculateur par OBD).',
      'Augmenter légèrement le régime (environ 1 500 tr/min) et allumer des consommateurs (phares, dégivrage).',
      'Noter la tension dans les deux conditions.',
    ],
    stepsEn: [
      'Start the engine and let it idle.',
      'Measure voltage at the battery terminals (or the module voltage via OBD).',
      'Raise engine speed slightly (about 1500 rpm) and turn on consumers (lights, defrost).',
      'Record voltage in both conditions.',
    ],
    expectedFr:
      'Moteur tournant, un alternateur en bon état maintient généralement entre environ 13,5 V et 14,5 V, y compris avec plusieurs consommateurs allumés.',
    expectedEn:
      'With the engine running, a healthy alternator typically maintains roughly 13.5 V to 14.5 V, including with several consumers switched on.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr:
          'Tension trop basse ou trop haute pendant la charge : le circuit de charge est concerné (alternateur, régulateur, courroie, câblage). Une batterie très faible peut aussi empêcher une mesure fiable : rechargez puis recontrôlez.',
        meaningEn:
          'Voltage too low or too high while charging: the charging circuit is involved (alternator, regulator, belt, wiring). A very weak battery can also prevent a reliable measurement: recharge then re-check.',
        confirms: ['alternator_weak'],
        excludes: ['battery_worn'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Charge correcte : la batterie est bien rechargée par le véhicule.',
        meaningEn: 'Charging is correct: the battery is properly recharged by the vehicle.',
      },
      {
        outcome: 'intermittent',
        meaningFr:
          'Tension de charge qui fluctue : vérifier la courroie d’accessoires, la poulie débrayable et les connexions.',
        meaningEn: 'Fluctuating charging voltage: check the accessory belt, overrunning pulley and connections.',
      },
    ],
    safety: 'attention',
    conditions: ['engine_running'],
    durationMin: 10,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_parasitic_drain',
    titleFr: 'Rechercher une décharge à l’arrêt (consommateur parasite)',
    titleEn: 'Look for a parasitic drain',
    objectiveFr: 'Identifier si un consommateur vide la batterie lorsque le véhicule est stationné.',
    objectiveEn: 'Identify whether a consumer drains the battery while the vehicle is parked.',
    equipment: ['Multimètre avec fonction ampèremètre (calibre 10 A) ou pince ampèremétrique'],
    stepsFr: [
      'Fermer toutes les portes, capot, coffre et attendre que le véhicule se mette en veille (15 à 45 minutes selon modèle).',
      'Brancher l’ampèremètre en série sur la borne négative (ou utiliser une pince ampèremétrique).',
      'Ne rien allumer et ne pas ouvrir les portes pendant la mesure.',
      'Noter le courant résiduel et le temps de mise en veille.',
    ],
    stepsEn: [
      'Close all doors, bonnet and boot and wait for the vehicle to enter sleep mode (15 to 45 minutes depending on model).',
      'Connect the ammeter in series with the negative terminal (or use a clamp meter).',
      'Do not switch anything on and do not open doors during the measurement.',
      'Record the residual current and the sleep delay.',
    ],
    expectedFr: null,
    expectedEn: null,
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr:
          'Courant résiduel anormalement élevé après mise en veille : rechercher les consommateurs un par un (fusibles). XAMOTO ne peut pas donner la valeur limite exacte pour votre véhicule : elle dépend du modèle et des équipements.',
        meaningEn:
          'Abnormally high residual current after sleep: investigate consumers one by one (fuses). XAMOTO cannot state the exact limit for your vehicle: it depends on the model and equipment.',
        confirms: ['parasitic_drain'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Aucune décharge anormale détectée après mise en veille.',
        meaningEn: 'No abnormal drain detected after sleep mode.',
        excludes: ['parasitic_drain'],
      },
      { outcome: 'not_testable', meaningFr: 'Mesure impossible dans ces conditions : le test devra être repris avec un matériel adapté.', meaningEn: 'Measurement not possible in these conditions: repeat the test with suitable equipment.' },
    ],
    safety: 'normal',
    conditions: ['engine_off'],
    durationMin: 45,
    sourceId: SOURCE_PRACTICE,
  }),

  /* ───────────────────────────── Allumage / ratés ───────────────────────── */
  T({
    id: 'test_ignition_spark_check',
    titleFr: 'Contrôler l’allumage (bobine et bougie) du cylindre concerné',
    titleEn: 'Check ignition (coil and plug) on the affected cylinder',
    objectiveFr: 'Déterminer si un raté d’allumage vient de la bobine, de la bougie ou d’ailleurs (compression, injection).',
    objectiveEn: 'Determine whether a misfire comes from the coil, spark plug or elsewhere (compression, injection).',
    equipment: ['Clé à bougie', 'Bougie neuve ou de rechange', 'Éventuellement un testeur d’étincelle', 'Gants'],
    stepsFr: [
      'Moteur froid, débrancher la batterie si le constructeur l’exige pour intervenir sur l’allumage.',
      'Démonter la bobine et la bougie du cylindre concerné (identifié par le code, ex. cylindre 1 pour P0301).',
      'Examiner la bougie : couleur, usure des électrodes, dépôts, présence d’huile ou de carburant.',
      'Échanger la bobine avec celle d’un cylindre voisin (test croisé), remonter une bougie en bon état.',
      'Effacer les défauts, démarrer et laisser tourner quelques minutes, puis relire les défauts.',
    ],
    stepsEn: [
      'Engine cold, disconnect the battery if the manufacturer requires it for ignition work.',
      'Remove the coil and spark plug from the affected cylinder (identified by the code, e.g. cylinder 1 for P0301).',
      'Inspect the plug: colour, electrode wear, deposits, oil or fuel presence.',
      'Swap the coil with a neighbouring cylinder (cross test), refit a known-good plug.',
      'Clear faults, start and run for a few minutes, then read faults again.',
    ],
    expectedFr:
      'Si le défaut suit la bobine déplacée vers l’autre cylindre, la bobine est en cause. Si le défaut reste sur le cylindre d’origine, la cause est ailleurs (bougie, injecteur, compression).',
    expectedEn:
      'If the fault moves with the coil to the other cylinder, the coil is at fault. If the fault stays on the original cylinder, the cause is elsewhere (plug, injector, compression).',
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr: 'Bougie ou bobine visiblement endommagée : remplacement justifié, puis contrôle du défaut après essai.',
        meaningEn: 'Plug or coil visibly damaged: replacement justified, then check the fault after a test drive.',
        confirms: ['ignition_coil_1', 'spark_plug_1'],
      },
      {
        outcome: 'ok',
        meaningFr:
          'Allumage en bon état : le raté vient probablement de l’injection ou de la compression. Poursuivre avec les tests correspondants.',
        meaningEn: 'Ignition in good condition: the misfire probably comes from injection or compression. Continue with the corresponding tests.',
        excludes: ['ignition_coil_1', 'spark_plug_1'],
      },
      {
        outcome: 'other',
        meaningFr: 'Résultat du test croisé : si le défaut s’est déplacé avec la bobine, la bobine est confirmée en cause.',
        meaningEn: 'Cross-test result: if the fault moved with the coil, the coil is confirmed as the cause.',
        confirms: ['ignition_coil_1'],
      },
    ],
    safety: 'attention',
    conditions: ['engine_off'],
    durationMin: 30,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_injector_balance',
    titleFr: 'Comparer le débit des injecteurs',
    titleEn: 'Compare injector flow',
    objectiveFr: 'Identifier un injecteur encrassé, bouché ou qui fuit.',
    objectiveEn: 'Identify a clogged, blocked or leaking injector.',
    equipment: ['Banc de test d’injecteurs (atelier) ou méthode de coupure cylindre par cylindre si le matériel le permet'],
    stepsFr: [
      'Relever les corrections de carburant cylindre par cylindre lorsque le véhicule le permet.',
      'Sur un banc, comparer les débits et la forme du jet entre injecteurs.',
      'Contrôler l’absence de fuite sous pression après fermeture.',
      'Comparer les débits relevés (valeurs, unités et méthode selon le banc utilisé).',
    ],
    stepsEn: [
      'Record per-cylinder fuel corrections when the vehicle supports it.',
      'On a bench, compare flow rates and spray patterns between injectors.',
      'Check for leaks under pressure after closing.',
      'Compare recorded flows (values, units and method depend on the bench used).',
    ],
    expectedFr:
      'Les injecteurs d’un même moteur doivent présenter des débits proches les uns des autres. XAMOTO ne fournit pas de valeur constructeur de débit : elle n’est pas disponible pour votre véhicule.',
    expectedEn:
      'Injectors of the same engine should show closely matching flow rates. XAMOTO does not provide a manufacturer flow value: it is not available for your vehicle.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr: 'Injecteur nettement en écart ou fuyard : nettoyage ou remplacement, puis contrôle du défaut après essai.',
        meaningEn: 'Injector clearly out of range or leaking: cleaning or replacement, then fault re-check after a test drive.',
        confirms: ['injector_1', 'injectors_clogged', 'injector_leaking'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Injecteurs homogènes : cette piste s’éloigne, examiner la compression et l’allumage.',
        meaningEn: 'Injectors consistent: this lead weakens, examine compression and ignition.',
        excludes: ['injector_1', 'injectors_clogged'],
      },
      { outcome: 'not_testable', meaningFr: 'Test non réalisable sans banc : XAMOTO ne conclura pas sur l’injection sans cette donnée.', meaningEn: 'Test not feasible without a bench: XAMOTO will not conclude on injection without this data.' },
    ],
    safety: 'attention',
    conditions: ['engine_off'],
    durationMin: 60,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_compression',
    titleFr: 'Mesurer les compressions moteur',
    titleEn: 'Measure engine compression',
    objectiveFr: 'Vérifier l’étanchéité des cylindres (soupapes, segments, joint de culasse).',
    objectiveEn: 'Check cylinder sealing (valves, rings, head gasket).',
    equipment: ['Compressiomètre (ou testeur d’étanchéité cylindre)', 'Clé à bougie / clé adaptée aux injecteurs', 'Gants'],
    stepsFr: [
      'Moteur chaud mais arrêté depuis quelques minutes. Retirer le fusible de la pompe à carburant pour éviter l’injection.',
      'Retirer la bougie (essence) ou l’injecteur (diesel) du cylindre à tester. Sur diesel, n’utiliser qu’un compressiomètre diesel adapté.',
      'Visser le compressiomètre et faire tourner le démarreur 4 à 5 secondes, papillon ouvert.',
      'Relever la valeur, remettre un peu d’huile dans le cylindre et refaire la mesure si une fuite est suspectée (comparaison segments / soupapes).',
      'Répéter pour chaque cylindre et comparer les valeurs entre elles.',
    ],
    stepsEn: [
      'Engine warm but stopped for a few minutes. Remove the fuel pump fuse to avoid injection.',
      'Remove the spark plug (petrol) or injector (diesel) of the cylinder to test. On diesel, use only a suitable diesel compression tester.',
      'Screw in the compression gauge and crank for 4 to 5 seconds with the throttle open.',
      'Record the value, add a little oil to the cylinder and repeat if a leak is suspected (rings vs valves comparison).',
      'Repeat for each cylinder and compare values between cylinders.',
    ],
    expectedFr:
      'L’écart entre cylindres est le critère le plus exploitable : un écart important entre deux cylindres signale un problème d’étanchéité. XAMOTO ne publie pas la valeur constructeur : elle dépend du moteur et doit provenir de la documentation du constructeur.',
    expectedEn:
      'The variation between cylinders is the most usable criterion: a large difference between two cylinders indicates a sealing problem. XAMOTO does not publish the manufacturer value: it depends on the engine and must come from manufacturer documentation.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr:
          'Écart important entre cylindres : étanchéité insuffisante. Ajouter de l’huile et refaire la mesure aide à distinguer segments (valeur qui remonte) et soupapes (valeur inchangée).',
        meaningEn:
          'Large variation between cylinders: insufficient sealing. Adding oil and re-measuring helps distinguish rings (value rises) from valves (value unchanged).',
        confirms: ['compression_low'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Compressions homogènes : la mécanique de base ne semble pas en cause.',
        meaningEn: 'Compression values consistent: base mechanics do not appear to be the cause.',
        excludes: ['compression_low'],
      },
    ],
    safety: 'important',
    conditions: ['engine_warm'],
    durationMin: 60,
    sourceId: SOURCE_PRACTICE,
  }),

  /* ───────────────────────────── Admission / étanchéité ─────────────────── */
  T({
    id: 'test_vacuum_leak',
    titleFr: 'Rechercher une prise d’air à l’admission',
    titleEn: 'Look for an intake vacuum leak',
    objectiveFr: 'Détecter une entrée d’air non mesurée, cause fréquente de mélange pauvre (P0171).',
    objectiveEn: 'Detect unmeasured air entry, a common cause of lean mixture (P0171).',
    equipment: ['Pulvérisateur d’eau savonneuse ou de nettoyant non inflammable', 'Éventuellement un détecteur de fuite à l’ultrason', 'Lampe'],
    stepsFr: [
      'Moteur tournant au ralenti, moteur chaud.',
      'Pulvériser par petites touches autour des joints d’admission, du collecteur, des durites et du boîtier papillon.',
      'Observer une éventuelle variation du régime moteur à l’endroit pulvérisé.',
      'Ne jamais pulvériser sur un moteur très chaud, sur l’échappement ou près d’un point d’étincelle.',
      'Alternative plus sûre : utiliser un détecteur de fuite à l’ultrason, sans produit inflammable.',
    ],
    stepsEn: [
      'Engine idling, warm.',
      'Spray small amounts around intake gaskets, manifold, hoses and throttle body.',
      'Watch for a change in engine speed where the spray is applied.',
      'Never spray on a very hot engine, exhaust or near an ignition source.',
      'Safer alternative: use an ultrasonic leak detector, with no flammable product.',
    ],
    expectedFr: 'Sur un système étanche, la pulvérisation ne provoque aucune variation de régime.',
    expectedEn: 'On a sealed system, spraying causes no change in engine speed.',
    interpretation: [
      {
        outcome: 'intermittent',
        meaningFr:
          'Le régime varie à l’endroit pulvérisé : une prise d’air est très probable à cet endroit précis. La cause est localisée et peut être confirmée par un test ciblé.',
        meaningEn:
          'Engine speed changes where sprayed: an air leak is very likely at that exact point. The cause is located and can be confirmed by a targeted test.',
        confirms: ['vacuum_leak', 'air_leak_after_maf', 'leak_in_fuel_line'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Aucune variation de régime : pas de prise d’air détectée par cette méthode. Une petite fuite peut rester invisible : compléter par la lecture des corrections de carburant.',
        meaningEn: 'No change in engine speed: no leak detected by this method. A small leak may remain invisible: complete with fuel trim readings.',
        excludes: ['vacuum_leak'],
      },
      { outcome: 'not_testable', meaningFr: 'Test non concluant : préciser la méthode utilisée avant toute conclusion.', meaningEn: 'Inconclusive test: specify the method used before any conclusion.' },
    ],
    safety: 'attention',
    conditions: ['engine_running', 'engine_warm'],
    durationMin: 20,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_maf_reading',
    titleFr: 'Comparer le débit d’air mesuré aux valeurs attendues',
    titleEn: 'Compare measured air flow with expected values',
    objectiveFr: 'Vérifier la cohérence du capteur de débit d’air (débit au ralenti et en accélération).',
    objectiveEn: 'Verify mass air flow sensor consistency (idle and acceleration flow).',
    equipment: ['Outil de diagnostic XAMOTO (lecture OBD des PID) ou valise'],
    stepsFr: [
      'Moteur chaud au ralenti : relever le débit d’air (g/s) et le régime.',
      'Accélérer franchement sans charge jusqu’à environ 2 500 tr/min : le débit doit augmenter nettement et de façon proportionnelle.',
      'Comparer avec la charge moteur (%) et la position papillon au même instant.',
      'Noter les valeurs relevées pour comparaison après intervention.',
    ],
    stepsEn: [
      'Warm engine at idle: record air flow (g/s) and engine speed.',
      'Accelerate briskly without load up to about 2500 rpm: flow should rise clearly and proportionally.',
      'Compare with engine load (%) and throttle position at the same moment.',
      'Record values for comparison after any repair.',
    ],
    expectedFr:
      'Sur un moteur essence au ralenti, un débit d’air typique se situe dans une plage de l’ordre de quelques grammes par seconde et augmente avec le régime. XAMOTO ne fournit pas de valeur exacte : elle dépend du moteur et doit venir de la documentation constructeur.',
    expectedEn:
      'On a petrol engine at idle, typical air flow is in the order of a few grams per second and increases with engine speed. XAMOTO does not provide an exact value: it depends on the engine and must come from manufacturer documentation.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr: 'Débit incohérent avec le régime et la charge : capteur encrassé, prise d’air ou câblage à vérifier.',
        meaningEn: 'Flow inconsistent with speed and load: dirty sensor, air leak or wiring to check.',
        confirms: ['maf_dirty', 'maf_faulty'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Débit cohérent : le capteur est probablement fiable, examiner les autres causes.',
        meaningEn: 'Consistent flow: the sensor is probably reliable, examine other causes.',
        excludes: ['maf_dirty', 'maf_faulty'],
      },
    ],
    safety: 'normal',
    conditions: ['engine_running', 'engine_warm'],
    durationMin: 15,
    sourceId: SOURCE_SAE,
  }),
  T({
    id: 'test_map_reading',
    titleFr: 'Vérifier le capteur de pression d’admission (MAP)',
    titleEn: 'Check the intake pressure sensor (MAP)',
    objectiveFr: 'Contrôler la cohérence de la pression mesurée dans le collecteur.',
    objectiveEn: 'Check consistency of measured manifold pressure.',
    equipment: ['Lecture OBD (PID pression collecteur)'],
    stepsFr: [
      'Contact mis, moteur arrêté : la pression affichée doit être proche de la pression atmosphérique (la valeur exacte dépend de l’altitude).',
      'Moteur au ralenti : la pression doit chuter nettement (dépression d’admission).',
      'Comparer à la pression barométrique si le véhicule la fournit.',
    ],
    stepsEn: [
      'Ignition on, engine off: displayed pressure should be close to atmospheric (exact value depends on altitude).',
      'Engine idling: pressure should drop clearly (intake vacuum).',
      'Compare with barometric pressure if the vehicle provides it.',
    ],
    expectedFr:
      'Moteur arrêté : proche de la pression atmosphérique du lieu. Au ralenti : nettement plus basse. Ces deux points de comparaison sont plus utiles que la valeur absolue.',
    expectedEn:
      'Engine off: close to local atmospheric pressure. At idle: clearly lower. These two comparison points are more useful than the absolute value.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr: 'Pression qui ne bouge pas entre arrêt et ralenti : capteur, durite ou câblage concerné.',
        meaningEn: 'Pressure unchanged between engine off and idle: sensor, hose or wiring involved.',
        confirms: ['map_sensor_faulty', 'map_hose_blocked'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Variation conforme : le capteur MAP donne une information exploitable.',
        meaningEn: 'Expected variation: the MAP sensor provides usable information.',
        excludes: ['map_sensor_faulty'],
      },
    ],
    safety: 'normal',
    conditions: ['ignition_on', 'engine_running'],
    durationMin: 10,
    sourceId: SOURCE_SAE,
  }),

  /* ───────────────────────────── Carburant ──────────────────────────────── */
  T({
    id: 'test_fuel_pressure',
    titleFr: 'Mesurer la pression de carburant',
    titleEn: 'Measure fuel pressure',
    objectiveFr: 'Vérifier que la pression d’alimentation correspond aux besoins du moteur.',
    objectiveEn: 'Verify that supply pressure meets engine requirements.',
    equipment: ['Manomètre de carburant adapté au circuit (essence/diesel)', 'Chiffons, extincteur à proximité', 'Gants et lunettes'],
    stepsFr: [
      'Ne jamais intervenir sur un circuit diesel haute pression moteur tournant : risque de projection mortelle.',
      'Dépressuriser le circuit selon la procédure du constructeur.',
      'Brancher le manomètre sur le point de mesure prévu.',
      'Mesurer : contact mis (pompe amorcée), moteur au ralenti, puis en accélération.',
      'Retirer l’outil, contrôler l’absence de fuite.',
    ],
    stepsEn: [
      'Never work on a high-pressure diesel circuit with the engine running: risk of lethal injection injury.',
      'Depressurise the circuit according to manufacturer procedure.',
      'Connect the gauge to the designated test point.',
      'Measure: ignition on (pump primed), engine idling, then during acceleration.',
      'Remove the tool, check for leaks.',
    ],
    expectedFr:
      'La pression attendue dépend du système (retour de carburant, rampe commune, injection directe). XAMOTO ne connaît pas la valeur exacte de votre véhicule : comparez à la documentation constructeur avant d’interpréter.',
    expectedEn:
      'Expected pressure depends on the system (return type, common rail, direct injection). XAMOTO does not know your vehicle exact value: compare with manufacturer documentation before interpreting.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr:
          'Pression trop basse ou trop haute : filtre, pompe, régulateur ou capteur concerné. Sur diesel, une pression insuffisante provoque des coupures en charge.',
        meaningEn:
          'Pressure too low or too high: filter, pump, regulator or sensor involved. On diesel, insufficient pressure causes cuts under load.',
        confirms: ['fuel_pressure_low', 'fuel_pressure_high', 'fuel_filter_clogged', 'fuel_pump_weak', 'pressure_regulator_faulty'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Pression conforme aux attentes du système : cette piste s’éloigne.',
        meaningEn: 'Pressure meets system expectations: this lead weakens.',
        excludes: ['fuel_pressure_low', 'fuel_filter_clogged'],
      },
    ],
    safety: 'important',
    conditions: ['engine_off', 'engine_running'],
    durationMin: 45,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_fuel_quality',
    titleFr: 'Vérifier la qualité du carburant',
    titleEn: 'Check fuel quality',
    objectiveFr: 'Écarter une cause très fréquente en contexte d’approvisionnement variable : carburant inadapté, présence d’eau ou de dépôts.',
    objectiveEn: 'Rule out a very common cause where supply quality varies: unsuitable fuel, water or deposits.',
    equipment: ['Récipient propre transparent', 'Éventuellement filtre à carburant neuf'],
    stepsFr: [
      'Prélever un petit échantillon de carburant au filtre ou au réservoir.',
      'Laisser reposer : observer une séparation eau/carburant ou des particules.',
      'Sentir et examiner la couleur (un carburant très foncé ou à odeur forte est suspect).',
      'Contrôler l’état du filtre à carburant (date, présence d’eau, colmatage).',
    ],
    stepsEn: [
      'Take a small fuel sample at the filter or tank.',
      'Let it settle: look for water/fuel separation or particles.',
      'Smell and inspect colour (very dark or strongly smelling fuel is suspicious).',
      'Check fuel filter condition (date, water, clogging).',
    ],
    expectedFr: 'Un carburant conforme est limpide, sans séparation d’eau ni particules visibles.',
    expectedEn: 'Compliant fuel is clear, without water separation or visible particles.',
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr:
          'Eau, particules ou carburant altéré : la cause peut être le carburant lui-même. Vider et rincer le circuit, remplacer le filtre, puis refaire un scan après usage réel.',
        meaningEn:
          'Water, particles or degraded fuel: the cause may be the fuel itself. Drain and flush the circuit, replace the filter, then rescan after real use.',
        confirms: ['fuel_quality'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Carburant propre et filtre en état : cette piste peut être écartée (sans garantie sur le lots précédents).',
        meaningEn: 'Clean fuel and serviceable filter: this lead can be excluded (no guarantee on previous fills).',
        excludes: ['fuel_quality'],
      },
    ],
    safety: 'attention',
    conditions: ['engine_off'],
    durationMin: 30,
    sourceId: SOURCE_PRACTICE,
  }),

  /* ─────────────────────── Dépollution / échappement ────────────────────── */
  T({
    id: 'test_o2_sensor_activity',
    titleFr: 'Observer l’activité de la sonde O2 amont',
    titleEn: 'Observe upstream O2 sensor activity',
    objectiveFr: 'Vérifier que la sonde O2 amont oscille correctement (régulation du mélange en boucle fermée).',
    objectiveEn: 'Verify that the upstream O2 sensor oscillates correctly (closed-loop mixture regulation).',
    equipment: ['Lecture OBD de la tension de sonde O2 (PID 14) en temps réel'],
    stepsFr: [
      'Moteur chaud (au-dessus de 70 °C), au ralenti.',
      'Afficher la tension de la sonde amont en temps réel pendant au moins 60 secondes.',
      'Accélérer légèrement par intermittence pour provoquer des variations de mélange.',
      'Observer si la tension oscille entre une valeur basse et une valeur haute, ou si elle reste figée.',
    ],
    stepsEn: [
      'Warm engine (above 70 °C), idling.',
      'Display upstream sensor voltage live for at least 60 seconds.',
      'Rev slightly and intermittently to provoke mixture changes.',
      'Observe whether voltage oscillates between low and high, or stays fixed.',
    ],
    expectedFr:
      'Moteur chaud en boucle fermée, une sonde amont saine oscille rapidement entre une tension basse et une tension haute (ordre de grandeur : environ 0,1 V à 0,9 V, plusieurs fois par seconde).',
    expectedEn:
      'Warm engine in closed loop, a healthy upstream sensor oscillates rapidly between low and high voltage (order of magnitude: about 0.1 V to 0.9 V, several times per second).',
    interpretation: [
      {
        outcome: 'no_signal',
        meaningFr: 'Tension figée ou absente : sonde probablement en fin de vie, ou câblage/échappement en amont à vérifier.',
        meaningEn: 'Fixed or absent voltage: sensor probably at end of life, or wiring/upstream exhaust to check.',
        confirms: ['o2_upstream_faulty', 'o2_sensor_biased', 'o2_wiring'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Oscillation conforme : la sonde amont fournit une information exploitable.',
        meaningEn: 'Expected oscillation: the upstream sensor provides usable information.',
        excludes: ['o2_upstream_faulty', 'o2_sensor_biased'],
      },
      { outcome: 'not_testable', meaningFr: 'Mesure impossible : véhicule non passé en boucle fermée ou PID non disponible.', meaningEn: 'Measurement not possible: vehicle not in closed loop or PID unavailable.' },
    ],
    safety: 'normal',
    conditions: ['engine_running', 'engine_warm'],
    durationMin: 20,
    sourceId: SOURCE_SAE,
  }),
  T({
    id: 'test_o2_downstream_activity',
    titleFr: 'Vérifier la sonde O2 aval et l’efficacité du catalyseur',
    titleEn: 'Check downstream O2 sensor and catalyst efficiency',
    objectiveFr: 'Distinguer un catalyseur usé d’une sonde aval défaillante (défaut P0420).',
    objectiveEn: 'Distinguish a worn catalyst from a faulty downstream sensor (P0420 fault).',
    equipment: ['Lecture OBD simultanée des sondes amont (PID 14) et aval (PID 15)'],
    stepsFr: [
      'Moteur chaud, enregistrer les deux tensions pendant 60 secondes au ralenti puis à régime maintenu (environ 2 000 tr/min).',
      'Une sonde aval saine doit rester relativement stable comparée à la sonde amont qui oscille.',
      'Observer si la sonde aval copie le rythme d’oscillation de la sonde amont.',
    ],
    stepsEn: [
      'Warm engine, record both voltages for 60 seconds at idle then at steady speed (about 2000 rpm).',
      'A healthy downstream sensor should stay relatively stable compared with the oscillating upstream sensor.',
      'Observe whether the downstream sensor copies the upstream oscillation rate.',
    ],
    expectedFr:
      'Sonde aval saine : signal relativement stable. Si la sonde aval oscille au même rythme que la sonde amont, le catalyseur ne stocke plus correctement l’oxygène — indice d’un catalyseur usé. Ce test ne remplace pas une mesure d’efficacité en conditions homologuées.',
    expectedEn:
      'Healthy downstream sensor: relatively stable signal. If the downstream sensor oscillates at the same rate as the upstream one, the catalyst no longer stores oxygen properly — evidence of a worn catalyst. This test does not replace an efficiency measurement under homologation conditions.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr:
          'Sonde aval oscillante comme la sonde amont : le catalyseur est fortement suspecté. Un contrôle supplémentaire (mélange, ratés, consommation d’huile) est nécessaire avant de remplacer une pièce coûteuse.',
        meaningEn:
          'Downstream sensor oscillating like the upstream one: the catalyst is strongly suspected. An additional check (mixture, misfires, oil consumption) is required before replacing an expensive part.',
        confirms: ['catalyst_worn'],
      },
      {
        outcome: 'ok',
        meaningFr:
          'Sonde aval stable : le catalyseur semble encore fonctionner. Le défaut vient probablement de la sonde aval elle-même ou d’une fuite d’échappement.',
        meaningEn:
          'Stable downstream sensor: the catalyst still appears to work. The fault likely comes from the downstream sensor itself or an exhaust leak.',
        confirms: ['o2_downstream_faulty'],
        excludes: ['catalyst_worn'],
      },
    ],
    safety: 'normal',
    conditions: ['engine_running', 'engine_warm'],
    durationMin: 25,
    sourceId: SOURCE_SAE,
  }),
  T({
    id: 'test_exhaust_leak',
    titleFr: 'Contrôler les fuites d’échappement',
    titleEn: 'Check for exhaust leaks',
    objectiveFr: 'Détecter une entrée d’air dans l’échappement qui fausse la mesure des sondes O2 et du catalyseur.',
    objectiveEn: 'Detect air entering the exhaust, corrupting O2 sensor and catalyst measurements.',
    equipment: ['Lampe', 'Miroir', 'Moteur froid avant intervention'],
    stepsFr: [
      'Moteur froid, inspecter visuellement le collecteur, le flexible, les joints et la ligne avant les sondes.',
      'Rechercher les traces de suie noire, les fissures, les joints manquants.',
      'Au besoin, au ralenti, écouter l’échappement (sifflement, souffle). Ne pas approcher les mains près de la ligne chaude.',
    ],
    stepsEn: [
      'Engine cold, visually inspect manifold, flex pipe, gaskets and line upstream of the sensors.',
      'Look for black soot traces, cracks, missing gaskets.',
      'If needed, at idle, listen to the exhaust (whistle, blowing). Do not bring hands near the hot line.',
    ],
    expectedFr: 'Aucune trace de suie, aucune fissure, joints présents et serrés.',
    expectedEn: 'No soot traces, no cracks, gaskets in place and tight.',
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr:
          'Fuite visible ou trace de suie : elle fausse la mesure des sondes et peut expliquer un P0420 ou un P0171. Réparer d’abord, puis refaire un scan.',
        meaningEn:
          'Visible leak or soot trace: it corrupts sensor measurement and can explain P0420 or P0171. Repair first, then rescan.',
        confirms: ['exhaust_leak', 'exhaust_leak_before_o2'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Échappement étanche visuellement : cette piste s’éloigne.',
        meaningEn: 'Exhaust visually sealed: this lead weakens.',
        excludes: ['exhaust_leak', 'exhaust_leak_before_o2'],
      },
    ],
    safety: 'normal',
    conditions: ['engine_off'],
    durationMin: 20,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_egr_operation',
    titleFr: 'Contrôler le fonctionnement de la vanne EGR',
    titleEn: 'Check EGR valve operation',
    objectiveFr: 'Vérifier si la vanne EGR s’ouvre réellement et si les conduits ne sont pas obstrués.',
    objectiveEn: 'Verify whether the EGR valve actually opens and whether passages are blocked.',
    equipment: ['Outil de diagnostic (commande d’actionneur si supportée)', 'Clé adaptée', 'Nettoyant EGR'],
    stepsFr: [
      'Moteur arrêté et froid. Relever la position/tension de commande EGR avec le contact mis.',
      'Si l’outil le permet, commander la vanne et observer un changement de régime ou de bruit.',
      'Déposer la vanne si nécessaire et examiner l’encrassement (suie) et la mobilité du clapet.',
      'Vérifier que les conduits dans le collecteur ne sont pas bouchés.',
    ],
    stepsEn: [
      'Engine stopped and cold. Record EGR command position/voltage with ignition on.',
      'If the tool allows, actuate the valve and observe any change in engine speed or noise.',
      'Remove the valve if necessary and inspect soot clogging and flap movement.',
      'Verify that passages in the manifold are not blocked.',
    ],
    expectedFr:
      'Commande EGR qui varie avec le régime, clapet mobile, conduits non obstrués. Sur moteur diesel fortement kilométré et usage urbain, l’encrassement est très fréquent.',
    expectedEn:
      'EGR command varying with engine speed, moving flap, unobstructed passages. On high-mileage diesel engines with urban use, clogging is very common.',
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr: 'Vanne encrassée, bloquée ou conduits obstrués : nettoyage ou remplacement justifié, suivi d’un scan après usage réel.',
        meaningEn: 'Clogged, stuck valve or blocked passages: cleaning or replacement justified, followed by a scan after real use.',
        confirms: ['egr_clogged', 'egr_valve_faulty', 'egr_stuck_open'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Vanne mobile et conduits propres : la cause est ailleurs (capteur, câblage, FAP).',
        meaningEn: 'Valve moves and passages are clean: the cause is elsewhere (sensor, wiring, DPF).',
        excludes: ['egr_clogged', 'egr_valve_faulty'],
      },
    ],
    safety: 'attention',
    conditions: ['engine_off', 'engine_running'],
    durationMin: 60,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_dpf_soot_load',
    titleFr: 'Évaluer le chargement en suie du filtre à particules',
    titleEn: 'Assess particulate filter soot load',
    objectiveFr: 'Savoir si le FAP peut se régénérer normalement ou s’il est trop chargé.',
    objectiveEn: 'Determine whether the DPF can regenerate normally or is overloaded.',
    equipment: ['Outil de diagnostic diesel (mesure de perte de charge / masse de suie)'],
    stepsFr: [
      'Lire la masse de suie estimée et la perte de charge du FAP moteur chaud au ralenti.',
      'Comparer avant et après un trajet routier à régime élevé (200–300 km/h interdits : respecter les limitations ; viser un roulage régulier de 30 à 40 minutes).',
      'Vérifier la dernière régénération réussie enregistrée.',
    ],
    stepsEn: [
      'Read estimated soot mass and DPF differential pressure with warm engine at idle.',
      'Compare before and after a motorway-speed drive (respect speed limits; aim for 30 to 40 minutes of steady driving).',
      'Check the last successful regeneration recorded.',
    ],
    expectedFr:
      'XAMOTO ne fournit pas de seuil constructeur pour la masse de suie : elle dépend du moteur et du FAP. L’évolution (baisse après roulage, absence de régénération réussie) est l’information la plus exploitable.',
    expectedEn:
      'XAMOTO does not provide a manufacturer threshold for soot mass: it depends on the engine and the filter. The trend (decrease after driving, absence of successful regeneration) is the most usable information.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr:
          'Chargement élevé avec absence de régénération réussie : usage urbain probablement en cause. Une régénération forcée en atelier peut être nécessaire, après vérification de l’EGR et de l’injection.',
        meaningEn:
          'High loading with no successful regeneration: urban use probably the cause. A forced regeneration at a workshop may be needed, after checking EGR and injection.',
        confirms: ['dpf_soot_short_trips', 'dpf_partially_clogged'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Le FAP se régénère : le défaut vient peut-être du capteur ou des durites de pression différentielle.',
        meaningEn: 'The DPF regenerates: the fault may come from the differential pressure sensor or hoses.',
        confirms: ['dpf_sensor_faulty'],
        excludes: ['dpf_soot_short_trips'],
      },
    ],
    safety: 'attention',
    conditions: ['engine_warm'],
    durationMin: 60,
    sourceId: SOURCE_PRACTICE,
    appliesTo: { fuelTypes: ['diesel'] },
  }),
  T({
    id: 'test_dpf_pressure_sensor',
    titleFr: 'Contrôler le capteur de pression différentielle du FAP',
    titleEn: 'Check DPF differential pressure sensor',
    objectiveFr: 'Vérifier que la mesure de perte de charge du FAP est fiable.',
    objectiveEn: 'Verify DPF pressure drop measurement reliability.',
    equipment: ['Lecture OBD de la pression différentielle'],
    stepsFr: [
      'Moteur arrêté : lire la pression différentielle, elle doit être nulle ou presque.',
      'Moteur au ralenti : relever la valeur.',
      'Contrôler visuellement les durites du capteur (fissures, bouchage par suie).',
    ],
    stepsEn: [
      'Engine off: read differential pressure, it should be zero or nearly zero.',
      'Engine idling: record the value.',
      'Visually check sensor hoses (cracks, soot blockage).',
    ],
    expectedFr: 'Moteur arrêté : pression différentielle nulle ou très faible. Une valeur non nulle moteur arrêté oriente vers le capteur ou une durite bouchée.',
    expectedEn: 'Engine off: zero or very low differential pressure. A non-zero value with the engine off points to the sensor or a blocked hose.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr: 'Valeur non nulle moteur arrêté : capteur à zéro incorrect ou durite obstruée. Ce défaut peut faire croire à un FAP colmaté.',
        meaningEn: 'Non-zero value with engine off: incorrect sensor zero or blocked hose. This fault can imitate a clogged DPF.',
        confirms: ['dpf_sensor_faulty', 'dpf_hoses'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Mesure cohérente : le capteur donne une information exploitable.',
        meaningEn: 'Consistent measurement: the sensor provides usable information.',
        excludes: ['dpf_sensor_faulty'],
      },
    ],
    safety: 'normal',
    conditions: ['engine_off', 'engine_running'],
    durationMin: 20,
    sourceId: SOURCE_PRACTICE,
    appliesTo: { fuelTypes: ['diesel'] },
  }),
  T({
    id: 'test_engine_baseline_scan',
    titleFr: 'Établir une mesure de référence du moteur',
    titleEn: 'Establish an engine baseline',
    objectiveFr:
      'Avant de conclure sur un défaut de catalyseur, vérifier qu’aucun autre défaut moteur ne fausse la mesure (mélange, ratés, consommation d’huile).',
    objectiveEn:
      'Before concluding on a catalyst fault, verify that no other engine fault corrupts the measurement (mixture, misfires, oil consumption).',
    equipment: ['XAMOTO — nouveau scan moteur chaud'],
    stepsFr: [
      'Moteur chaud, effectuer un scan complet des données.',
      'Relever : corrections de carburant, ratés, température moteur, données carburant.',
      'Comparer avec un scan antérieur si disponible.',
    ],
    stepsEn: [
      'Warm engine, perform a full data scan.',
      'Record: fuel trims, misfire counters, engine temperature, fuel data.',
      'Compare with a previous scan if available.',
    ],
    expectedFr: null,
    expectedEn: null,
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr:
          'Anomalies détectées (corrections hors plage, ratés) : elles doivent être traitées AVANT de conclure sur le catalyseur. Un catalyseur remplacé sur un moteur mal réglé se dégradera à nouveau.',
        meaningEn:
          'Anomalies detected (out-of-range trims, misfires): they must be addressed BEFORE concluding on the catalyst. A catalyst replaced on a poorly tuned engine will degrade again.',
        confirms: ['upstream_issue_hidden'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Aucune anomalie moteur détectée : le défaut de catalyseur est plus probable, sans être certain.',
        meaningEn: 'No engine anomaly detected: the catalyst fault is more likely, without being certain.',
        confirms: ['catalyst_worn'],
      },
    ],
    safety: 'normal',
    conditions: ['engine_warm'],
    durationMin: 20,
    sourceId: SOURCE_PRACTICE,
  }),

  /* ───────────────────────────── Refroidissement ────────────────────────── */
  T({
    id: 'test_coolant_level',
    titleFr: 'Contrôler le niveau et l’état du liquide de refroidissement',
    titleEn: 'Check coolant level and condition',
    objectiveFr: 'Vérifier que le circuit est plein et étanche, ce qui conditionne toute interprétation de température.',
    objectiveEn: 'Verify the circuit is full and sealed, a prerequisite for any temperature interpretation.',
    equipment: ['Chiffons', 'Lampe', 'Liquide de refroidissement adapté au véhicule'],
    stepsFr: [
      '⚠️ Ne JAMAIS ouvrir le bouchon du vase d’expansion moteur chaud : risque de brûlure grave.',
      'Attendre le refroidissement complet du moteur.',
      'Ouvrir le bouchon et vérifier le niveau par rapport aux repères MIN/MAX.',
      'Examiner la couleur du liquide (rouille, dépôts, présence d’huile en surface).',
      'Vérifier l’absence de traces de fuite sous le véhicule et sur les durites.',
    ],
    stepsEn: [
      '⚠️ NEVER open the expansion tank cap with the engine hot: risk of severe burns.',
      'Wait until the engine has fully cooled.',
      'Open the cap and check the level against MIN/MAX marks.',
      'Inspect coolant colour (rust, deposits, oil film on the surface).',
      'Check for leaks under the vehicle and on hoses.',
    ],
    expectedFr:
      'Niveau entre MIN et MAX, liquide propre de la couleur recommandée par le constructeur, absence de trace d’huile et de fuite. Une couleur rouille indique un entretien insuffisant du circuit.',
    expectedEn:
      'Level between MIN and MAX, clean coolant of the manufacturer-recommended colour, no oil film and no leak trace. Rust colour indicates poor circuit maintenance.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr:
          'Niveau bas ou liquide dégradé : rechercher une fuite (durite, radiateur, pompe à eau, joint de culasse) avant de conclure sur une surchauffe.',
        meaningEn:
          'Low level or degraded coolant: look for a leak (hose, radiator, water pump, head gasket) before concluding on overheating.',
        confirms: ['coolant_level_low'],
      },
      {
        outcome: 'visual_damage',
        meaningFr: 'Traces d’huile dans le liquide : suspicion de joint de culasse, à confirmer par un test de gaz de combustion.',
        meaningEn: 'Oil traces in coolant: suspicion of head gasket, to be confirmed by a combustion gas test.',
        confirms: ['head_gasket'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Circuit plein et propre : cette cause est écartée pour le moment.',
        meaningEn: 'Circuit full and clean: this cause is excluded for now.',
        excludes: ['coolant_level_low'],
      },
    ],
    safety: 'critical',
    conditions: ['engine_off'],
    durationMin: 15,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_fan_operation',
    titleFr: 'Vérifier le déclenchement du ventilateur de refroidissement',
    titleEn: 'Check cooling fan operation',
    objectiveFr: 'Vérifier que le ventilateur se déclenche et refroidit le circuit.',
    objectiveEn: 'Verify the fan starts and cools the circuit.',
    equipment: ['Aucun matériel spécifique', 'Éventuellement lecture OBD de la température'],
    stepsFr: [
      'Moteur chaud arrivé à température normale, capot ouvert, laisser tourner au ralenti.',
      'Observer le déclenchement du ventilateur quand la température monte.',
      'Vérifier que l’air soufflé est chaud côté radiateur.',
      'Ne jamais approcher les mains des pales, de la courroie ou de l’échappement.',
    ],
    stepsEn: [
      'Warm engine at normal temperature, bonnet open, let it idle.',
      'Observe fan activation as temperature rises.',
      'Verify that air blown past the radiator is hot.',
      'Never bring hands near blades, belts or exhaust.',
    ],
    expectedFr:
      'Le ventilateur se déclenche à une température de liquide élevée (selon véhicule : souvent au-delà de 95–100 °C, la stratégie exacte dépend du constructeur) et s’arrête après refroidissement.',
    expectedEn:
      'The fan starts at high coolant temperature (depending on vehicle: often above 95–100 °C, exact strategy depends on the manufacturer) and stops after cooling.',
    interpretation: [
      {
        outcome: 'no_signal',
        meaningFr: 'Ventilateur qui ne se déclenche pas : vérifier fusible, relais, moto-ventilateur et sonde de température avant de conclure à une surchauffe mécanique.',
        meaningEn: 'Fan does not start: check fuse, relay, fan motor and temperature sensor before concluding a mechanical overheating.',
        confirms: ['fan_not_working'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Ventilateur fonctionnel : la cause de la surchauffe est ailleurs (thermostat, pompe à eau, radiateur).',
        meaningEn: 'Fan working: the overheating cause is elsewhere (thermostat, water pump, radiator).',
        excludes: ['fan_not_working'],
      },
    ],
    safety: 'attention',
    conditions: ['engine_running', 'engine_warm'],
    durationMin: 25,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_warm_up_curve',
    titleFr: 'Suivre la courbe de montée en température',
    titleEn: 'Follow the warm-up curve',
    objectiveFr: 'Vérifier que le moteur atteint sa température normale (défaut P0128 / thermostat).',
    objectiveEn: 'Verify the engine reaches normal temperature (P0128 / thermostat fault).',
    equipment: ['XAMOTO — enregistrement de la température moteur sur 10 à 15 minutes'],
    stepsFr: [
      'Démarrer moteur froid (température ambiante).',
      'Enregistrer la température du liquide toutes les 30 secondes pendant 10 à 15 minutes.',
      'Noter le temps nécessaire pour dépasser environ 80 °C et la stabilité une fois atteinte.',
    ],
    stepsEn: [
      'Start with a cold engine (ambient temperature).',
      'Record coolant temperature every 30 seconds for 10 to 15 minutes.',
      'Note the time needed to exceed about 80 °C and stability once reached.',
    ],
    expectedFr:
      'La température doit monter régulièrement puis se stabiliser dans la plage de fonctionnement normale. Le temps de montée dépend du moteur, de la température ambiante et du type d’usage : c’est la comparaison avec la valeur précédente du même véhicule qui est la plus utile.',
    expectedEn:
      'Temperature should rise steadily then stabilise in the normal operating range. Warm-up time depends on the engine, ambient temperature and driving type: comparison with a previous value of the same vehicle is the most useful.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr:
          'Montée très lente ou température qui plafonne sous la plage normale : thermostat probablement bloqué ouvert. Attention : par temps frais et en circulation lente, une montée lente peut être normale.',
        meaningEn:
          'Very slow rise or temperature plateauing below normal range: thermostat probably stuck open. Note: in cool weather and slow traffic, a slow rise can be normal.',
        confirms: ['thermostat_stuck_open'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Montée en température conforme : thermostat fonctionnel.',
        meaningEn: 'Expected warm-up: thermostat functional.',
        excludes: ['thermostat_stuck_open'],
      },
    ],
    safety: 'normal',
    conditions: ['engine_running'],
    durationMin: 15,
    sourceId: SOURCE_SAE,
  }),
  T({
    id: 'test_coolant_sensor_compare',
    titleFr: 'Comparer la sonde de température moteur à la température réelle',
    titleEn: 'Compare coolant sensor with real temperature',
    objectiveFr: 'Vérifier la fiabilité de la sonde de température (défauts P0117 / P0118 / P0128).',
    objectiveEn: 'Verify temperature sensor reliability (P0117 / P0118 / P0128 faults).',
    equipment: ['Thermomètre infrarouge ou sonde de contact', 'Lecture OBD de la température'],
    stepsFr: [
      'Moteur refroidi mais pas totalement froid (ou après un roulage court), lire la température OBD.',
      'Mesurer la température réelle sur le boîtier de sortie de liquide (thermostat) ou sur la durite.',
      'Comparer les deux valeurs et l’écart avec la température ambiante avant démarrage.',
    ],
    stepsEn: [
      'With a cooled but not fully cold engine (or after a short drive), read OBD temperature.',
      'Measure actual temperature at the coolant outlet housing (thermostat) or hose.',
      'Compare both values and the difference with ambient temperature before starting.',
    ],
    expectedFr:
      'Moteur arrêté depuis longtemps, la température lue doit être proche de la température ambiante. Après quelques minutes de fonctionnement, les deux mesures ne doivent pas montrer d’écart important.',
    expectedEn:
      'After a long stop, the reading should be close to ambient temperature. After a few minutes of running, both measurements should not show a significant difference.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr: 'Écart important entre mesure OBD et mesure physique : sonde ou câblage concerné.',
        meaningEn: 'Significant difference between OBD and physical measurement: sensor or wiring involved.',
        confirms: ['coolant_temp_sensor_faulty', 'sensor_wiring_short', 'sensor_wiring_open'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Mesures cohérentes : la sonde de température est fiable.',
        meaningEn: 'Consistent measurements: the temperature sensor is reliable.',
        excludes: ['coolant_temp_sensor_faulty'],
      },
    ],
    safety: 'attention',
    conditions: ['engine_off', 'engine_warm'],
    durationMin: 25,
    sourceId: SOURCE_SAE,
  }),
  T({
    id: 'test_combustion_gases_coolant',
    titleFr: 'Rechercher des gaz de combustion dans le liquide de refroidissement',
    titleEn: 'Test for combustion gases in coolant',
    objectiveFr: 'Confirmer ou écarter un joint de culasse défaillant.',
    objectiveEn: 'Confirm or rule out a failed head gasket.',
    equipment: ['Kit de détection CO2 dans le liquide (réactif coloré)'],
    stepsFr: [
      '⚠️ Moteur froid uniquement. Ouvrir le bouchon après refroidissement complet.',
      'Placer l’outil avec le réactif au-dessus du vase d’expansion, liquidé à mi-niveau.',
      'Faire tourner le moteur au ralenti et aspirer les gaz au-dessus du liquide pendant 1 à 2 minutes.',
      'Observer le changement de couleur du réactif selon la notice du fabricant.',
    ],
    stepsEn: [
      '⚠️ Cold engine only. Open the cap only after full cooling.',
      'Place the tool with reagent above the expansion tank, filled to mid-level.',
      'Run the engine at idle and draw gases above the liquid for 1 to 2 minutes.',
      'Observe reagent colour change according to the manufacturer instructions.',
    ],
    expectedFr: 'Réactif inchangé : pas de gaz de combustion détectés dans le liquide.',
    expectedEn: 'Reagent unchanged: no combustion gases detected in the coolant.',
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr:
          'Réactif qui change de couleur : présence de gaz de combustion — joint de culasse ou culasse fissurée très probable. Ce test est un indice fort, à confirmer par un test d’étanchéité en atelier.',
        meaningEn:
          'Reagent changing colour: combustion gases present — head gasket or cracked cylinder head very likely. This is strong evidence, to be confirmed by a workshop leak-down test.',
        confirms: ['head_gasket'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Aucun gaz de combustion détecté : cette cause s’éloigne (un joint peut fuir seulement à chaud : un test en atelier reste nécessaire en cas de doute).',
        meaningEn: 'No combustion gases detected: this cause weakens (a gasket may leak only when hot: a workshop test is still required if in doubt).',
        excludes: ['head_gasket'],
      },
    ],
    safety: 'critical',
    conditions: ['engine_off'],
    durationMin: 30,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_radiator_flow',
    titleFr: 'Contrôler l’écoulement du radiateur',
    titleEn: 'Check radiator flow',
    objectiveFr: 'Détecter un radiateur entartré ou obstrué.',
    objectiveEn: 'Detect a clogged or blocked radiator.',
    equipment: ['Thermomètre infrarouge', 'Lampe'],
    stepsFr: [
      'Moteur chaud, mesurer la température en haut et en bas du radiateur.',
      'Une différence importante entre l’entrée et la sortie indique un mauvais écoulement.',
      'Inspecter les ailettes (poussière, insectes, chocs) et l’extérieur du radiateur.',
    ],
    stepsEn: [
      'With a warm engine, measure temperature at the top and bottom of the radiator.',
      'A large difference between inlet and outlet indicates poor flow.',
      'Inspect the fins (dust, insects, impacts) and the radiator exterior.',
    ],
    expectedFr:
      'Le radiateur doit être chaud sur toute sa surface et présenter une différence mesurable entre entrée et sortie lorsque le thermostat est ouvert. XAMOTO ne fournit pas de valeur d’écart constructeur.',
    expectedEn:
      'The radiator should be hot over its whole surface and show a measurable difference between inlet and outlet once the thermostat is open. XAMOTO does not provide a manufacturer difference value.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr: 'Zone froide ou écart important : radiateur partiellement obstrué (calcaire, boues, ailettes bouchées par la poussière).',
        meaningEn: 'Cold area or large difference: partially blocked radiator (scale, sludge, dust-blocked fins).',
        confirms: ['radiator_clogged'],
      },
      { outcome: 'ok', meaningFr: 'Radiateur homogène : cette piste s’éloigne.', meaningEn: 'Radiator uniform: this lead weakens.', excludes: ['radiator_clogged'] },
    ],
    safety: 'important',
    conditions: ['engine_warm'],
    durationMin: 20,
    sourceId: SOURCE_PRACTICE,
  }),

  /* ───────────────────────────── Électrique / capteurs ──────────────────── */
  T({
    id: 'test_wiring_visual',
    titleFr: 'Inspecter les connecteurs et le câblage',
    titleEn: 'Inspect connectors and wiring',
    objectiveFr: 'Écarter une cause très fréquente en climat chaud et poussiéreux : oxydation, frottement, connecteur mal enclenché.',
    objectiveEn: 'Rule out a very common cause in hot, dusty climates: corrosion, chafing, loose connector.',
    equipment: ['Lampe', 'Nettoyant contact', 'Pince à dégarnir si nécessaire'],
    stepsFr: [
      'Batterie débranchée (borne négative) si des connecteurs doivent être manipulés.',
      'Inspecter les connecteurs concernés : oxydation verte/blanche, traces de chaleur, broches tordues.',
      'Vérifier que chaque connecteur est correctement enclenché (clip).',
      'Suivre le faisceau à la main : rechercher frottements, durites chaudes, passages près d’arêtes.',
    ],
    stepsEn: [
      'Disconnect the battery (negative terminal) if connectors must be handled.',
      'Inspect relevant connectors: green/white corrosion, heat marks, bent pins.',
      'Check each connector is properly latched.',
      'Follow the harness by hand: look for chafing, hot hoses, edges.',
    ],
    expectedFr: 'Connecteurs propres, enclenchés, sans trace de chaleur ni de frottement.',
    expectedEn: 'Connectors clean, latched, without heat or chafing marks.',
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr: 'Oxydation, fil abîmé ou connecteur desserré : nettoyer ou réparer le câblage AVANT de remplacer un capteur.',
        meaningEn: 'Corrosion, damaged wire or loose connector: clean or repair the wiring BEFORE replacing a sensor.',
        confirms: ['maf_wiring', 'map_wiring', 'coil_wiring', 'sensor_wiring_open', 'sensor_wiring_short', 'o2_wiring', 'crank_sensor_wiring', 'cam_sensor_wiring', 'connector_oxidation', 'battery_terminals'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Câblage visuellement sain : les pistes de capteur redeviennent prioritaires.',
        meaningEn: 'Wiring visually sound: sensor leads become the priority again.',
      },
    ],
    safety: 'attention',
    conditions: ['engine_off'],
    durationMin: 30,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_crank_sensor_signal',
    titleFr: 'Vérifier le capteur de position vilebrequin',
    titleEn: 'Check crankshaft position sensor',
    objectiveFr: 'Confirmer ou écarter un capteur de vilebrequin qui provoque calages et non-démarrage.',
    objectiveEn: 'Confirm or rule out a crankshaft sensor causing stalls and no-start.',
    equipment: ['Outil de diagnostic (compte-tours lors du démarrage)', 'Oscilloscope si disponible'],
    stepsFr: [
      'Effacer les défauts puis tenter un démarrage en observant le régime moteur affiché par l’outil.',
      'Si le compte-tours reste à zéro pendant que le démarreur entraîne le moteur, le signal de vilebrequin est probablement absent.',
      'Inspecter le connecteur et le faisceau du capteur (chaleur, huile, frottement).',
      'Contrôler la couronne dentée ou la bague magnétique si accessible.',
    ],
    stepsEn: [
      'Clear faults then attempt a start while watching engine speed on the tool.',
      'If the tachometer stays at zero while the starter cranks the engine, the crankshaft signal is probably absent.',
      'Inspect the sensor connector and harness (heat, oil, chafing).',
      'Check the reluctor ring or magnetic target if accessible.',
    ],
    expectedFr: 'Pendant le démarrage, le régime doit afficher une valeur non nulle (généralement 150 à 300 tr/min entraînés par le démarreur).',
    expectedEn: 'While cranking, engine speed should show a non-zero value (typically 150 to 300 rpm from the starter).',
    interpretation: [
      {
        outcome: 'no_signal',
        meaningFr: 'Aucun régime pendant le démarrage : capteur, câblage ou couronne concerné. Sur un véhicule qui cale en circulation, ce défaut impose une immobilisation jusqu’à réparation.',
        meaningEn: 'No engine speed while cranking: sensor, wiring or target involved. On a vehicle stalling in traffic, this fault requires immobilisation until repaired.',
        confirms: ['crank_sensor_faulty', 'crank_sensor_wiring', 'crank_target_ring'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Régime présent au démarrage : le capteur de vilebrequin fonctionne à cet instant. Un défaut intermittent peut ne pas apparaître.',
        meaningEn: 'Speed present while cranking: the crankshaft sensor works at this moment. An intermittent fault may not appear.',
        excludes: ['crank_sensor_faulty'],
      },
    ],
    safety: 'important',
    conditions: ['ignition_on'],
    durationMin: 30,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_cam_sensor_signal',
    titleFr: 'Vérifier le capteur d’arbre à cames',
    titleEn: 'Check camshaft position sensor',
    objectiveFr: 'Contrôler la synchronisation de l’arbre à cames et la qualité du signal.',
    objectiveEn: 'Check camshaft synchronisation and signal quality.',
    equipment: ['Outil de diagnostic (données capteur arbre à cames, synchronisation)'],
    stepsFr: [
      'Moteur au ralenti, afficher la synchronisation arbre à cames / vilebrequin si le véhicule la fournit.',
      'Noter la présence ou l’absence de signal et les valeurs de calage variables si disponibles.',
      'Inspecter le connecteur et la zone du capteur (huile, dépôts).',
    ],
    stepsEn: [
      'At idle, display camshaft/crankshaft synchronisation if the vehicle provides it.',
      'Note presence or absence of signal and variable timing values if available.',
      'Inspect the connector and sensor area (oil, deposits).',
    ],
    expectedFr: 'Signal présent et synchronisation stable au ralenti.',
    expectedEn: 'Signal present and stable synchronisation at idle.',
    interpretation: [
      {
        outcome: 'no_signal',
        meaningFr: 'Signal absent ou synchronisation instable : capteur, câblage ou calage de distribution concerné. Comparer avec le défaut P0016 si présent.',
        meaningEn: 'Absent signal or unstable synchronisation: sensor, wiring or valve timing involved. Compare with P0016 if present.',
        confirms: ['cam_sensor_faulty', 'timing_stretched'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Signal stable : cette piste s’éloigne.',
        meaningEn: 'Stable signal: this lead weakens.',
        excludes: ['cam_sensor_faulty'],
      },
    ],
    safety: 'attention',
    conditions: ['engine_running'],
    durationMin: 20,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_timing_alignment',
    titleFr: 'Vérifier le calage de la distribution',
    titleEn: 'Verify valve timing alignment',
    objectiveFr: 'Déterminer si la distribution est décalée (défaut P0016, perte de puissance, mauvais démarrage).',
    objectiveEn: 'Determine whether valve timing is shifted (P0016 fault, power loss, poor starting).',
    equipment: ['Atelier : kit de calage adapté au moteur', 'Documentation technique constructeur obligatoire'],
    stepsFr: [
      'Cette vérification nécessite la procédure du constructeur pour VOTRE moteur : XAMOTO ne la remplace pas.',
      'En atelier : contrôler les repères de distribution selon la méthode du constructeur.',
      'Vérifier le tendeur, la chaîne ou la courroie, et l’état des pignons.',
      'Comparer les valeurs de calage lues par l’outil avant et après intervention.',
    ],
    stepsEn: [
      'This check requires the manufacturer procedure for YOUR engine: XAMOTO does not replace it.',
      'In a workshop: check timing marks using the manufacturer method.',
      'Check tensioner, chain or belt, and sprocket condition.',
      'Compare timing values read by the tool before and after the work.',
    ],
    expectedFr: null,
    expectedEn: null,
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr: 'Distribution décalée : intervention de calage ou remplacement du kit nécessaire (opération d’atelier).',
        meaningEn: 'Timing shifted: timing adjustment or kit replacement required (workshop operation).',
        confirms: ['timing_stretched'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Distribution conforme : la cause est ailleurs (capteur, huile, déphaseur).',
        meaningEn: 'Timing correct: the cause is elsewhere (sensor, oil, phaser).',
        excludes: ['timing_stretched'],
      },
      { outcome: 'not_testable', meaningFr: 'Vérification impossible sans documentation et outillage spécifiques : XAMOTO ne conclura pas.', meaningEn: 'Check not possible without specific documentation and tooling: XAMOTO will not conclude.' },
    ],
    safety: 'important',
    conditions: ['engine_off'],
    durationMin: 180,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_oil_pressure',
    titleFr: 'Contrôler la pression d’huile moteur',
    titleEn: 'Check engine oil pressure',
    objectiveFr: 'Vérifier que la lubrification est correcte (chaîne de distribution hydraulique, déphaseurs, usure).',
    objectiveEn: 'Verify correct lubrication (hydraulic timing chain, phasers, wear).',
    equipment: ['Manomètre mécanique de pression d’huile adapté', 'Documentation constructeur'],
    stepsFr: [
      'Moteur froid, déposer le capteur de pression d’huile et brancher le manomètre.',
      'Démarrer, relever la pression au ralenti puis à régime moyen, moteur chaud.',
      'Comparer avec les valeurs du constructeur (XAMOTO ne les fournit pas).',
      'Vérifier le niveau d’huile et l’état de l’huile (viscosité, dépôts).',
    ],
    stepsEn: [
      'Cold engine, remove the oil pressure sensor and connect the gauge.',
      'Start, record pressure at idle and at medium speed, warm engine.',
      'Compare with manufacturer values (XAMOTO does not provide them).',
      'Check oil level and oil condition (viscosity, deposits).',
    ],
    expectedFr: null,
    expectedEn: null,
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr: 'Pression insuffisante : arrêter le moteur. Causes possibles : niveau, pompe, filtre, usure interne. Un voyant de pression d’huile allumé impose l’arrêt immédiat.',
        meaningEn: 'Insufficient pressure: stop the engine. Possible causes: level, pump, filter, internal wear. An illuminated oil pressure light requires immediate stop.',
        confirms: ['oil_pressure_low'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Pression conforme aux attentes du système de mesure.',
        meaningEn: 'Pressure meets measurement system expectations.',
        excludes: ['oil_pressure_low'],
      },
    ],
    safety: 'critical',
    conditions: ['engine_off', 'engine_running'],
    durationMin: 60,
    sourceId: SOURCE_PRACTICE,
  }),

  /* ───────────────────────────── Freinage / transmission ────────────────── */
  T({
    id: 'test_brake_visual',
    titleFr: 'Contrôler visuellement le système de freinage',
    titleEn: 'Visually inspect the braking system',
    objectiveFr: 'Vérifier un élément de sécurité prioritaire.',
    objectiveEn: 'Check a priority safety system.',
    equipment: ['Cric et chandelles obligatoires', 'Lampe', 'Jauge de mesure des plaquettes'],
    stepsFr: [
      'Lever le véhicule et le poser sur chandelles (jamais sous le cric seul).',
      'Contrôler l’épaisseur des plaquettes et l’état des disques (rainures, voile, épaisseur).',
      'Vérifier le niveau de liquide de frein et sa couleur (un liquide foncé indique un remplacement à prévoir).',
      'Rechercher les fuites au niveau des étriers et des flexibles.',
    ],
    stepsEn: [
      'Jack up the vehicle and support on stands (never on the jack alone).',
      'Check pad thickness and disc condition (grooves, runout, thickness).',
      'Check brake fluid level and colour (dark fluid indicates replacement is due).',
      'Look for leaks at calipers and flexible hoses.',
    ],
    expectedFr: null,
    expectedEn: null,
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr: 'Usure avancée, disque marqué ou fuite : intervention rapide nécessaire. XAMOTO ne fournit pas de cote d’usure constructeur pour ce véhicule.',
        meaningEn: 'Advanced wear, scored disc or leak: prompt repair required. XAMOTO does not provide a manufacturer wear limit for this vehicle.',
        confirms: ['brake_pads_worn'],
      },
      { outcome: 'ok', meaningFr: 'Aucune anomalie visible : un contrôle reste recommandé en cas de symptôme de freinage.', meaningEn: 'No visible anomaly: a check is still recommended if braking symptoms exist.' },
    ],
    safety: 'critical',
    conditions: ['engine_off'],
    durationMin: 45,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_wheel_sensor_signal',
    titleFr: 'Vérifier le capteur de vitesse de roue',
    titleEn: 'Check wheel speed sensor',
    objectiveFr: 'Contrôler un capteur ABS et sa cible (défaut C0035).',
    objectiveEn: 'Check an ABS sensor and its target (C0035 fault).',
    equipment: ['Outil de diagnostic (lecture des quatre vitesses de roue)', 'Éventuellement multimètre'],
    stepsFr: [
      'Afficher les quatre vitesses de roue en temps réel et rouler très lentement en ligne droite.',
      'Comparer les quatre valeurs : elles doivent être proches à vitesse constante.',
      'Inspecter le connecteur du capteur concerné, le câblage près de la roue et l’état de la bague magnétique.',
    ],
    stepsEn: [
      'Display all four wheel speeds live and drive very slowly in a straight line.',
      'Compare the four values: they should be close at constant speed.',
      'Inspect the affected sensor connector, wiring near the wheel and magnetic ring condition.',
    ],
    expectedFr: 'Quatre vitesses de roue cohérentes à vitesse constante ; une roue à 0 ou très différente signale un capteur ou une cible en cause.',
    expectedEn: 'Four consistent wheel speeds at constant speed; a wheel at 0 or clearly different indicates a sensor or target issue.',
    interpretation: [
      {
        outcome: 'no_signal',
        meaningFr: 'Une roue ne donne aucune vitesse : capteur, câblage ou cible magnétique concerné. Vérifier la présence de limaille ou de boue sur la cible.',
        meaningEn: 'One wheel gives no speed: sensor, wiring or magnetic target involved. Check for metal debris or mud on the target.',
        confirms: ['wheel_sensor_faulty', 'sensor_ring_dirty', 'wheel_sensor_wiring'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Vitesses cohérentes : cette piste s’éloigne.',
        meaningEn: 'Consistent speeds: this lead weakens.',
        excludes: ['wheel_sensor_faulty'],
      },
    ],
    safety: 'important',
    conditions: ['engine_running'],
    durationMin: 30,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_transmission_fluid',
    titleFr: 'Contrôler l’huile de boîte de vitesses',
    titleEn: 'Check transmission fluid',
    objectiveFr: 'Vérifier niveau, couleur et odeur de l’huile de boîte (défauts P0700 / P0715).',
    objectiveEn: 'Check transmission fluid level, colour and smell (P0700 / P0715 faults).',
    equipment: ['Chiffons', 'Lampe', 'Jauge ou bouchon de contrôle selon boîte'],
    stepsFr: [
      'Moteur et boîte à température de fonctionnement selon la procédure du constructeur (boîte automatique).',
      'Contrôler le niveau selon la méthode du constructeur (boîte chaude, moteur tournant pour certaines).',
      'Observer la couleur : rouge clair (récent) à brun foncé (dégradé) ; rechercher une odeur de brûlé et des particules.',
    ],
    stepsEn: [
      'Engine and transmission at operating temperature according to manufacturer procedure (automatic).',
      'Check level using the manufacturer method (hot, engine running for some).',
      'Observe colour: light red (fresh) to dark brown (degraded); look for burnt smell and particles.',
    ],
    expectedFr: 'Niveau correct selon la procédure constructeur, huile sans odeur de brûlé et sans particules métalliques visibles.',
    expectedEn: 'Correct level per manufacturer procedure, fluid without burnt smell and without visible metal particles.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr: 'Niveau incorrect ou huile dégradée : une vidange de boîte peut corriger le comportement. Sur boîte automatique, respecter impérativement la procédure du constructeur.',
        meaningEn: 'Incorrect level or degraded fluid: a fluid change may correct behaviour. On automatic transmissions, strictly follow manufacturer procedure.',
        confirms: ['transmission_fluid'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Huile correcte : cette piste s’éloigne, examiner les capteurs et le câblage.',
        meaningEn: 'Correct fluid: this lead weakens, examine sensors and wiring.',
        excludes: ['transmission_fluid'],
      },
    ],
    safety: 'attention',
    conditions: ['engine_warm'],
    durationMin: 45,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_boost_leak',
    titleFr: 'Rechercher une fuite sur le circuit de suralimentation',
    titleEn: 'Look for a boost circuit leak',
    objectiveFr: 'Détecter une fuite de pression de turbo (défauts P0299 / perte de puissance).',
    objectiveEn: 'Detect a turbo boost leak (P0299 / power loss).',
    equipment: ['Inspection visuelle', 'Test de pression si matériel disponible', 'Brouillard d’huile fin ou eau savonneuse selon méthode du garage'],
    stepsFr: [
      'Moteur froid, inspecter les durites (fissures, traces d’huile, colliers desserrés).',
      'Vérifier l’échangeur et les raccords plastiques (fissures fréquentes).',
      'Écouter au ralenti et à l’accélération (sifflement de fuite).',
      'En atelier : test d’étanchéité sous pression contrôlée.',
    ],
    stepsEn: [
      'Cold engine, inspect hoses (cracks, oil traces, loose clamps).',
      'Check the intercooler and plastic connectors (frequent cracks).',
      'Listen at idle and during acceleration (leak whistle).',
      'In workshop: pressure test under controlled pressure.',
    ],
    expectedFr: 'Aucune fissure, colliers serrés, aucune trace d’huile aux raccords.',
    expectedEn: 'No cracks, tight clamps, no oil traces at connections.',
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr: 'Durite percée, échangeur fissuré ou collier desserré : réparation peu coûteuse à essayer en premier, puis nouveau scan.',
        meaningEn: 'Split hose, cracked intercooler or loose clamp: low-cost repair to try first, then rescan.',
        confirms: ['boost_hose_leak'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Circuit visuellement étanche : examiner la commande de suralimentation et le turbo.',
        meaningEn: 'Circuit visually sealed: examine boost control and turbocharger.',
        excludes: ['boost_hose_leak'],
      },
    ],
    safety: 'attention',
    conditions: ['engine_off'],
    durationMin: 40,
    sourceId: SOURCE_PRACTICE,
    appliesTo: { fuelTypes: ['diesel', 'essence'] },
  }),
  T({
    id: 'test_boost_control',
    titleFr: 'Contrôler la commande de suralimentation (wastegate / géométrie variable)',
    titleEn: 'Check boost control (wastegate / VNT)',
    objectiveFr: 'Vérifier que la commande de pression de turbo fonctionne (défauts P0234 / P0299).',
    objectiveEn: 'Verify turbo pressure control operation (P0234 / P0299 faults).',
    equipment: ['Outil de diagnostic (commande d’actionneur)', 'Dépression / pince'],
    stepsFr: [
      'Contrôler le mouvement de la tige de wastegate ou de la géométrie variable à la commande.',
      'Vérifier que la tige revient librement et sans point dur (encrassement fréquent sur diesel).',
      'Contrôler les durites de dépression et l’électrovanne.',
    ],
    stepsEn: [
      'Check wastegate rod or VNT linkage movement when commanded.',
      'Verify the rod returns freely without a hard spot (frequent soot build-up on diesel).',
      'Check vacuum hoses and solenoid.',
    ],
    expectedFr: 'Mouvement complet et libre de la commande, retour immédiat, absence de durite percée.',
    expectedEn: 'Full and free actuator movement, immediate return, no split hose.',
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr: 'Mécanisme grippé, tige qui ne revient pas ou durite percée : nettoyage ou remplacement du mécanisme, puis scan de contrôle.',
        meaningEn: 'Seized mechanism, rod not returning or split hose: cleaning or mechanism replacement, then control scan.',
        confirms: ['wastegate_stuck', 'boost_control_valve'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Commande fonctionnelle : examiner le turbo lui-même et les capteurs de pression.',
        meaningEn: 'Control functional: examine the turbo itself and pressure sensors.',
        excludes: ['wastegate_stuck', 'boost_control_valve'],
      },
    ],
    safety: 'attention',
    conditions: ['engine_off'],
    durationMin: 40,
    sourceId: SOURCE_PRACTICE,
    appliesTo: { fuelTypes: ['diesel'] },
  }),
  T({
    id: 'test_driving_profile_review',
    titleFr: 'Analyser le profil d’utilisation du véhicule',
    titleEn: 'Analyse vehicle usage profile',
    objectiveFr: 'Vérifier si l’usage explique un chargement du FAP ou une batterie faible (sans en faire une conclusion).',
    objectiveEn: 'Verify whether usage explains a DPF load or weak battery (without turning it into a conclusion).',
    equipment: ['Historique XAMOTO', 'Distances et durées de trajet habituelles'],
    stepsFr: [
      'Renseigner les trajets habituels : durée, distance, type de circulation.',
      'Indiquer si le véhicule fait surtout de la ville, des embouteillages, ou de la route.',
      'Comparer avec la date et la fréquence des défauts enregistrés.',
    ],
    stepsEn: [
      'Enter usual trips: duration, distance, traffic type.',
      'Indicate whether the vehicle is mostly used in city, traffic jams, or on the road.',
      'Compare with the date and frequency of recorded faults.',
    ],
    expectedFr: null,
    expectedEn: null,
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr:
          'Profil d’usage défavorable (trajets très courts répétés, embouteillages permanents) : cela peut expliquer un FAP chargé ou une batterie insuffisamment rechargée. Cela ne remplace jamais le test technique : la cause doit être vérifiée.',
        meaningEn:
          'Unfavourable usage profile (repeated very short trips, permanent traffic): this may explain a loaded DPF or an undercharged battery. It never replaces the technical test: the cause must be verified.',
        confirms: ['dpf_soot_short_trips'],
      },
      { outcome: 'ok', meaningFr: 'Profil d’usage compatible avec le fonctionnement normal du système.', meaningEn: 'Usage profile compatible with normal system operation.' },
    ],
    safety: 'normal',
    conditions: ['engine_off'],
    durationMin: 10,
    sourceId: SOURCE_PRACTICE,
  }),
  T({
    id: 'test_fuel_cap',
    titleFr: 'Contrôler le bouchon de réservoir',
    titleEn: 'Check fuel filler cap',
    objectiveFr: 'Vérifier la cause la plus fréquente et la moins coûteuse des défauts EVAP (P0442 / P0455).',
    objectiveEn: 'Check the most frequent and cheapest cause of EVAP faults (P0442 / P0455).',
    equipment: ['Aucun'],
    stepsFr: [
      'Ouvrir le bouchon et examiner le joint : craquelures, durcissement, corps étranger.',
      'Refermer le bouchon jusqu’au clic (plusieurs crans).',
      'Effacer le défaut, rouler plusieurs jours en usage normal, puis relire les défauts.',
    ],
    stepsEn: [
      'Open the cap and inspect the seal: cracks, hardening, foreign body.',
      'Refit the cap until it clicks (several notches).',
      'Clear the fault, drive normally for several days, then read faults again.',
    ],
    expectedFr: 'Joint souple et intact, bouchon qui se verrouille avec un clic net.',
    expectedEn: 'Soft intact seal, cap locking with a clear click.',
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr: 'Joint craquelé ou dur : remplacer le bouchon, effacer le défaut et vérifier après quelques jours de roulage réel.',
        meaningEn: 'Cracked or hard seal: replace the cap, clear the fault and check after a few days of real driving.',
        confirms: ['fuel_cap_seal', 'fuel_cap_missing'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Bouchon en bon état : chercher une fuite sur les durites et le canister.',
        meaningEn: 'Cap in good condition: look for a leak on hoses and canister.',
        excludes: ['fuel_cap_seal'],
      },
    ],
    safety: 'normal',
    conditions: ['engine_off'],
    durationMin: 10,
    sourceId: SOURCE_PRACTICE,
  }),
  /* ──────────── Climatisation, embrayage, suspension, fusibles ──────────── */
  T({
    id: 'test_ac_visual',
    titleFr: 'Contrôler la climatisation sans toucher au circuit de fluide',
    titleEn: 'Check the air conditioning without touching the refrigerant circuit',
    objectiveFr: 'Écarter les causes simples d’une climatisation qui ne refroidit plus, sans intervenir sur le fluide frigorigène.',
    objectiveEn: 'Rule out simple causes of poor air conditioning without touching the refrigerant.',
    equipment: ['Lampe', 'Chiffons ou brosse souple', 'Eau (rinçage du condenseur)'],
    stepsFr: [
      'Moteur tournant, climatisation à fond et ventilateur habitacle au maximum : écouter et regarder si l’embrayage du compresseur s’enclenche (il doit tourner par intermittence).',
      'Contrôler l’état du condenseur devant le radiateur : poussière, sable, insectes, feuilles. Un condenseur obstrué fait chuter le refroidissement, surtout en saison sèche et en embouteillage.',
      'Contrôler le filtre d’habitacle (s’il est accessible) : un filtre colmaté réduit fortement le débit d’air, ce qui donne l’impression que la climatisation ne refroidit plus.',
      'Vérifier l’état et la tension de la courroie d’accessoires si le compresseur ne s’enclenche jamais.',
      'Ne JAMAIS ouvrir le circuit de fluide frigorigène, ni ajouter de gaz : cette opération exige un équipement de récupération et une habilitation.',
    ],
    stepsEn: [
      'Engine running, A/C at maximum and cabin fan at maximum: listen and look whether the compressor clutch engages (it should cycle).',
      'Check the condenser in front of the radiator: dust, sand, insects, leaves. A blocked condenser kills cooling, especially in the dry season and in traffic.',
      'Check the cabin filter (if accessible): a clogged filter strongly reduces air flow, which feels like poor cooling.',
      'Check accessory belt condition and tension if the compressor never engages.',
      'NEVER open the refrigerant circuit or top up gas: this requires recovery equipment and certification.',
    ],
    expectedFr: 'Condenseur propre, filtre d’habitacle propre, embrayage du compresseur qui s’enclenche par intermittence.',
    expectedEn: 'Clean condenser, clean cabin filter, compressor clutch cycling.',
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr: 'Condenseur obstrué ou filtre colmaté : le nettoyage est une cause fréquente et sans risque, à faire avant toute recharge de gaz.',
        meaningEn: 'Blocked condenser or clogged filter: cleaning is a frequent and safe cause, to be done before any gas top-up.',
        confirms: ['ac_filter_dirty'],
      },
      {
        outcome: 'not_testable',
        meaningFr: 'Compresseur qui ne s’enclenche jamais ou circuit visiblement gras : la vérification des pressions revient à un professionnel équipé.',
        meaningEn: 'Compressor never engaging or visibly oily circuit: pressure testing belongs to an equipped professional.',
      },
      {
        outcome: 'ok',
        meaningFr: 'Ces causes simples sont écartées : un contrôle des pressions par un professionnel devient nécessaire. XAMOTO ne peut pas mesurer la charge de fluide.',
        meaningEn: 'These simple causes are ruled out: a professional pressure check becomes necessary. XAMOTO cannot measure refrigerant charge.',
      },
    ],
    safety: 'normal',
    conditions: ['engine_running'],
    durationMin: 20,
    sourceId: 'src_african_context',
  }),
  T({
    id: 'test_ac_pressure_pro',
    titleFr: 'Faire contrôler les pressions de climatisation par un professionnel',
    titleEn: 'Have A/C pressures checked by a professional',
    objectiveFr: 'Confirmer ou écarter une charge insuffisante ou un compresseur faible, avec le matériel adapté.',
    objectiveEn: 'Confirm or rule out low charge or a weak compressor, with the proper equipment.',
    equipment: ['Station de climatisation (professionnel)', 'Détecteur de fuite (professionnel)'],
    stepsFr: [
      'Confier le véhicule à un professionnel équipé d’une station de récupération et de recharge.',
      'Demander la relevé des pressions basse et haute pression, moteur tournant et climatisation en fonctionnement.',
      'Demander une recherche de fuite (traceur ou azote) en cas de charge insuffisante, plutôt qu’une recharge systématique.',
      'Conserver le relevé : il constitue une preuve datée pour la suite du diagnostic.',
    ],
    stepsEn: [
      'Hand the vehicle to a professional equipped with a recovery and recharge station.',
      'Ask for the low-side and high-side pressure readings, engine running and A/C on.',
      'Ask for a leak search (tracer or nitrogen) when the charge is low, rather than a systematic top-up.',
      'Keep the reading: it is a dated record for the rest of the diagnosis.',
    ],
    expectedFr: null,
    expectedEn: null,
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr: 'Pressions hors plage : fuite, charge insuffisante ou compresseur faible. Le relevé oriente la réparation, XAMOTO ne la prescrit pas.',
        meaningEn: 'Pressures out of range: leak, low charge or weak compressor. The reading guides the repair; XAMOTO does not prescribe it.',
        confirms: ['ac_gas_low', 'ac_compressor'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Pressions conformes au relevé du professionnel : la cause est ailleurs (filtre, condenseur, commande).',
        meaningEn: 'Pressures in line with the professional reading: the cause is elsewhere (filter, condenser, control).',
        excludes: ['ac_gas_low'],
      },
    ],
    safety: 'normal',
    conditions: ['engine_running'],
    durationMin: 60,
    sourceId: 'src_workshop_methods',
  }),
  T({
    id: 'test_clutch_wear',
    titleFr: 'Évaluer l’usure de l’embrayage',
    titleEn: 'Assess clutch wear',
    objectiveFr: 'Distinguer un embrayage qui patine d’un manque de puissance moteur.',
    objectiveEn: 'Tell a slipping clutch apart from a lack of engine power.',
    equipment: ['Zone dégagée', 'Frein de stationnement en état'],
    stepsFr: [
      'Moteur chaud, sur une route dégagée et sans circulation : engager un rapport élevé (3e ou 4e) à basse vitesse.',
      'Accélérer franchement : si le régime moteur monte nettement sans que la vitesse suive, l’embrayage patine.',
      'Véhicule à l’arrêt, moteur tournant au ralenti, frein de stationnement serré : engager puis relâcher lentement en observant si le moteur cale. Sur un embrayage très usé, le moteur ne cale pas facilement.',
      'Sentir l’odeur après l’essai : une odeur âcre persistante signale un embrayage qui patine.',
      'Ne pas répéter cet essai plus de deux fois : il fait chauffer l’embrayage.',
    ],
    stepsEn: [
      'Warm engine, on an open road without traffic: engage a high gear (3rd or 4th) at low speed.',
      'Accelerate firmly: if engine speed rises clearly without the vehicle following, the clutch is slipping.',
      'Stationary, engine idling, parking brake applied: engage a gear and release slowly while watching whether the engine stalls. With a very worn clutch, the engine stalls less easily.',
      'Notice the smell after the test: a persistent acrid smell signals a slipping clutch.',
      'Do not repeat this test more than twice: it heats the clutch.',
    ],
    expectedFr: 'Le régime et la vitesse montent ensemble en rapport élevé ; le moteur cale au relâchement en rapport haut.',
    expectedEn: 'Engine speed and vehicle speed rise together in a high gear; the engine stalls when releasing in a high gear.',
    interpretation: [
      {
        outcome: 'out_of_range',
        meaningFr: 'Le régime monte sans que la vitesse suive : embrayage qui patine. La comparaison avant/après repose sur ce même essai.',
        meaningEn: 'Engine speed rises without vehicle speed following: slipping clutch. The before/after comparison relies on the same test.',
        confirms: ['clutch_worn'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Pas de patinage constaté : si la perte de puissance persiste, la cause est côté moteur (allumage, carburant, admission).',
        meaningEn: 'No slipping observed: if the power loss persists, the cause is on the engine side (ignition, fuel, intake).',
        excludes: ['clutch_worn'],
      },
      {
        outcome: 'not_testable',
        meaningFr: 'Essai impossible en sécurité (circulation dense, terrain en pente) : il doit être fait par un professionnel sur route ou au banc.',
        meaningEn: 'Test impossible to perform safely (heavy traffic, slope): it must be done by a professional on the road or on a bench.',
      },
    ],
    safety: 'important',
    conditions: ['engine_warm', 'engine_running'],
    durationMin: 20,
    sourceId: 'src_workshop_methods',
  }),
  T({
    id: 'test_suspension_vibration',
    titleFr: 'Situer une vibration ou un bruit de roulement',
    titleEn: 'Locate a vibration or a wheel bearing noise',
    objectiveFr: 'Séparer une vibration liée aux roues d’une vibration liée à la transmission ou au moteur.',
    objectiveEn: 'Separate a wheel-related vibration from a driveline or engine vibration.',
    equipment: ['Cric et chandelles', 'Manomètre de pression des pneus'],
    stepsFr: [
      'Relever la pression des quatre pneus à froid et les comparer : une pression insuffisante ou inégale produit une vibration et une usure irrégulière.',
      'Inspecter les pneus : hernies, usure en facettes, plomb de balourd arraché.',
      'Véhicule levé et posé sur chandelles, roue libre : faire tourner chaque roue à la main et écouter (frottement, jeu), puis vérifier le jeu en saisissant la roue à 12 h et 6 h.',
      'Sur route, à vitesse constante et volant droit : noter à quelle vitesse la vibration apparaît. Une fréquence liée à la vitesse des roues pointe les roues ou les roulements ; une fréquence liée au régime moteur pointe le moteur ou l’échappement.',
    ],
    stepsEn: [
      'Read all four tyre pressures cold and compare: low or uneven pressure produces vibration and uneven wear.',
      'Inspect tyres: bulges, scalloped wear, missing balance weight.',
      'Vehicle lifted on stands, wheel free: spin each wheel by hand and listen (rubbing, play), then check play by grabbing the wheel at 12 and 6 o’clock.',
      'On the road at steady speed and straight steering: note at which speed the vibration appears. A wheel-speed frequency points to wheels or bearings; an engine-speed frequency points to the engine or exhaust.',
    ],
    expectedFr: null,
    expectedEn: null,
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr: 'Pneu déformé, usure en facettes ou jeu dans un roulement : cause mécanique identifiée, à faire confirmer par un professionnel qui fera l’équilibrage ou le remplacement.',
        meaningEn: 'Deformed tyre, scalloped wear or bearing play: mechanical cause identified, to be confirmed by a professional who will balance or replace.',
        confirms: ['wheel_imbalance', 'wheel_bearing_worn'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Roues et roulements sans anomalie apparente : la vibration vient probablement de la transmission ou du moteur. XAMOTO ne peut pas trancher sans essai routier encadré.',
        meaningEn: 'Wheels and bearings apparently fine: the vibration probably comes from the driveline or engine. XAMOTO cannot decide without a supervised road test.',
      },
    ],
    safety: 'attention',
    conditions: ['engine_off', 'engine_running'],
    durationMin: 30,
    sourceId: 'src_workshop_methods',
  }),
  T({
    id: 'test_fuse_continuity',
    titleFr: 'Contrôler un fusible avant d’accuser un boîtier',
    titleEn: 'Check a fuse before blaming a module',
    objectiveFr: 'Écarter la cause la plus simple et la moins coûteuse d’une perte d’alimentation.',
    objectiveEn: 'Rule out the simplest and cheapest cause of a power loss.',
    equipment: ['Multimètre (position continuité)', 'Lampe', 'Pince à fusibles'],
    stepsFr: [
      'Identifier le fusible concerné dans la boîte à fusibles du véhicule (moteur et habitacle) à l’aide du schéma du constructeur ou du couvercle.',
      'Contrôler visuellement le filament ; un fusible peut sembler intact sans l’être.',
      'Contact coupé : mesurer la continuité entre les deux lames du fusible, retiré de son logement. Un signal sonore indique un fusible conducteur.',
      'Examiner le logement : traces de chauffe, oxydation, fusible de calibre incorrect posé par un précédent intervenant.',
      'Ne jamais remplacer un fusible par un calibre supérieur : c’est exactement ainsi qu’on transforme un défaut de circuit en risque d’incendie.',
    ],
    stepsEn: [
      'Locate the relevant fuse in the vehicle fuse box (engine and cabin) using the manufacturer diagram or the cover.',
      'Check the filament visually; a fuse can look intact without being intact.',
      'Ignition off: measure continuity across the two blades of the fuse removed from its socket. A beep indicates a conductive fuse.',
      'Inspect the socket: heat marks, corrosion, wrong rating fitted by a previous repairer.',
      'Never replace a fuse with a higher rating: that is exactly how a circuit fault turns into a fire risk.',
    ],
    expectedFr: null,
    expectedEn: null,
    interpretation: [
      {
        outcome: 'visual_damage',
        meaningFr: 'Fusible fondu : chercher d’abord la cause (court-circuit, consommerateur en défaut) avant de le remplacer, sinon il grillera à nouveau.',
        meaningEn: 'Blown fuse: find the cause first (short circuit, faulty consumer) before replacing it, otherwise it will blow again.',
        confirms: ['blown_fuse'],
      },
      {
        outcome: 'ok',
        meaningFr: 'Fusible conducteur : l’alimentation n’est pas coupée à cet endroit. Continuer par la connectique et les masses.',
        meaningEn: 'Fuse conductive: supply is not cut at this point. Continue with connectors and grounds.',
        excludes: ['blown_fuse'],
      },
    ],
    safety: 'attention',
    conditions: ['engine_off'],
    durationMin: 15,
    sourceId: 'src_workshop_methods',
  }),
];

export const TEST_BY_ID = new Map(GUIDED_TESTS.map((t) => [t.id, t]));

export function getTests(ids: string[]): GuidedTestDefinition[] {
  return ids.map((id) => TEST_BY_ID.get(id)).filter((t): t is GuidedTestDefinition => Boolean(t));
}

/** Tests de dépannage rapide proposés d'office quand aucun test n'est disponible. */
export const FALLBACK_TESTS: string[] = ['test_wiring_visual', 'test_battery_rest_voltage'];
