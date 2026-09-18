/// XAMOTO — Phrases exigées et refus explicites (§16, §47).
///
/// Le texte est ici, en clair, pour deux raisons : il est identique partout dans
/// l'application, et il est vérifiable. `tools/test/mobile_contract.test.ts`
/// compare ces chaînes à `shared/src/index.ts` (source de vérité du serveur et du
/// web) : impossible de « reformuler gentiment » une phrase de sécurité.
library;

const String kInsufficientDataFr = 'Je ne dispose pas de cette donnée pour votre véhicule.';
const String kInsufficientDataEn = 'I do not have this data for your vehicle.';
const String kSeveralCausesFr = 'Plusieurs causes sont possibles.';
const String kSeveralCausesEn = 'Several causes are possible.';
const String kTestRequiredFr = 'Ce test est nécessaire avant de conclure.';
const String kTestRequiredEn = 'This test is required before concluding.';
const String kSimulationFr = 'MODE SIMULATION';
const String kSimulationEn = 'SIMULATION MODE';
const String kSimulationNoticeFr = 'Les données affichées sont simulées et ne proviennent pas d’un véhicule réel.';
const String kSimulationNoticeEn = 'The data shown is simulated and does not come from a real vehicle.';
const String kNoGuaranteeFr =
    'XAMOTO ne peut pas garantir la sécurité de circulation lorsque les données disponibles sont insuffisantes. En cas de doute, faites contrôler le véhicule.';
const String kNoGuaranteeEn =
    'XAMOTO cannot guarantee road safety when available data is insufficient. If in doubt, have the vehicle inspected.';

/// Message affiché lorsqu'un système ne peut pas être lu par l'OBD (§15).
const String kNotReadableFr =
    'Un système non accessible par l’OBD n’est pas un système en bon état : c’est un système que XAMOTO ne peut pas contrôler par ce moyen.';
const String kNotReadableEn =
    'A system that OBD cannot reach is not a healthy system: it is a system XAMOTO cannot check this way.';
