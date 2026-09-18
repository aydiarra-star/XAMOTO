/// XAMOTO — Points d'entrée de l'API, en un seul endroit.
///
/// Le mobile ne parle au serveur QUE par ces chemins. Deux raisons :
///   1. un chemin recopié ailleurs finit par diverger ;
///   2. `tools/test/mobile_contract.test.ts` compare cette liste aux routes
///      réellement enregistrées par le serveur — une faute de frappe est donc
///      détectée sans exécuter Dart.
///
/// Convention : `all` contient les chemins canoniques (paramètres notés `:id`).
/// Les fonctions construisent un chemin concret à partir d'eux, sans jamais
/// écrire un nouveau littéral `/api/...`.
library;

abstract final class Api {
  /* ─────────────────────────── Authentification ─────────────────────────── */
  static const String login = '/api/auth/login';
  static const String register = '/api/auth/register';
  static const String demo = '/api/auth/demo';
  static const String me = '/api/auth/me';
  static const String logout = '/api/auth/logout';

  /* ─────────────────────────────── Véhicules ────────────────────────────── */
  static const String vehicles = '/api/vehicles';
  static const String vehicle = '/api/vehicles/:id';
  static const String vehiclePassport = '/api/vehicles/:id/passport';
  static const String vehicleMaintenance = '/api/vehicles/:id/maintenance';
  static const String vehicleMaintenancePlan = '/api/vehicles/:id/maintenance/plan';
  static const String vehicleSyncState = '/api/vehicles/:id/sync-state';

  /* ──────────────────────────────── Scans ───────────────────────────────── */
  static const String scans = '/api/scans';
  static const String scan = '/api/scans/:id';
  static const String scanClear = '/api/scans/:id/clear';

  /* ───────────────────────────── Diagnostic ─────────────────────────────── */
  static const String diagnostics = '/api/diagnostics';
  static const String diagnostic = '/api/diagnostics/:id';
  static const String diagnosticCanIDrive = '/api/diagnostics/:id/can-i-drive';
  static const String diagnosticTests = '/api/diagnostics/:id/tests';
  static const String diagnosticTestResult = '/api/diagnostics/:id/tests/:testKey/result';
  static const String diagnosticSecondOpinion = '/api/diagnostics/:id/second-opinion';
  static const String diagnosticCompare = '/api/diagnostics/:id/compare';

  /* ───────────────────────────── Assistant (§13) ────────────────────────── */
  static const String assistantAsk = '/api/assistant/ask';
  static const String assistantCapabilities = '/api/assistant/capabilities';
  static const String assistantConversations = '/api/assistant/conversations';

  /* ──────────────────── Base de connaissances (§15, §18) ────────────────── */
  static const String knowledgeSymptoms = '/api/knowledge/symptoms';
  static const String knowledgeTests = '/api/knowledge/tests';
  static const String knowledgeSystems = '/api/knowledge/systems';
  /// Un code précis se demande en REQUÊTE (`?code=P0420`), pas par un chemin :
  /// `GET /api/knowledge/dtc/:code` n'existe pas côté serveur. Le test de contrat
  /// a trouvé cet écart avant que l'application ne le fasse à l'exécution.
  static const String knowledgeDtc = '/api/knowledge/dtc';
  static const String knowledgeDtcUnknown = '/api/knowledge/dtc/unknown/:code';

  /* ──────────────────────────────── OBD (§7) ────────────────────────────── */
  static const String obdCandidates = '/api/obd/candidates';
  static const String obdProbe = '/api/obd/probe';
  static const String obdBluetoothDevices = '/api/obd/bluetooth/devices';
  static const String obdSimulatorScenarios = '/api/obd/simulator/scenarios';

  /* ──────────────────────────── Garages (§21) ───────────────────────────── */
  static const String garages = '/api/garages';
  static const String garage = '/api/garages/:id';

  /* ─────────────────────────── Entretien et alertes ─────────────────────── */
  static const String alerts = '/api/alerts';
  static const String alertsRead = '/api/alerts/read';
  static const String parts = '/api/parts';

  /* ─────────────────────────────── Rapports ─────────────────────────────── */
  static const String reports = '/api/reports';
  static const String reportShare = '/api/reports/:id/share';

  /* ────────────────────── Hors ligne : synchronisation (§32) ────────────── */
  static const String syncPull = '/api/sync/pull';
  static const String syncPush = '/api/sync/push';
  static const String syncConflicts = '/api/sync/conflicts';

  static String byId(String pattern, String id) => pattern.replaceFirst(':id', id);

  static String vehiclePath(String id) => byId(vehicle, id);
  static String vehiclePassportPath(String id) => byId(vehiclePassport, id);
  static String vehicleMaintenancePath(String id) => byId(vehicleMaintenance, id);
  static String vehicleMaintenancePlanPath(String id) => byId(vehicleMaintenancePlan, id);
  static String vehicleSyncStatePath(String id) => byId(vehicleSyncState, id);
  static String scanPath(String id) => byId(scan, id);
  static String scanClearPath(String id) => byId(scanClear, id);
  static String diagnosticPath(String id) => byId(diagnostic, id);
  static String diagnosticCanIDrivePath(String id) => byId(diagnosticCanIDrive, id);
  static String diagnosticTestsPath(String id) => byId(diagnosticTests, id);
  static String diagnosticSecondOpinionPath(String id) => byId(diagnosticSecondOpinion, id);
  static String diagnosticComparePath(String id) => byId(diagnosticCompare, id);
  static String diagnosticTestResultPath(String id, String testKey) => byId(diagnosticTestResult, id).replaceFirst(':testKey', testKey);
  static String knowledgeDtcUnknownPath(String code) => byId(knowledgeDtcUnknown, code);
  static String garagePath(String id) => byId(garage, id);
  static String reportSharePath(String id) => byId(reportShare, id);

  /// Chemins canoniques — vérifiés contre les routes du serveur par les tests.
  static const List<String> all = <String>[
    login,
    register,
    demo,
    me,
    logout,
    vehicles,
    vehicle,
    vehiclePassport,
    vehicleMaintenance,
    vehicleMaintenancePlan,
    vehicleSyncState,
    scans,
    scan,
    scanClear,
    diagnostics,
    diagnostic,
    diagnosticCanIDrive,
    diagnosticTests,
    diagnosticTestResult,
    diagnosticSecondOpinion,
    diagnosticCompare,
    assistantAsk,
    assistantCapabilities,
    assistantConversations,
    knowledgeSymptoms,
    knowledgeTests,
    knowledgeSystems,
    knowledgeDtc,
    knowledgeDtcUnknown,
    obdCandidates,
    obdProbe,
    obdBluetoothDevices,
    obdSimulatorScenarios,
    garages,
    garage,
    alerts,
    alertsRead,
    parts,
    reports,
    reportShare,
    syncPull,
    syncPush,
    syncConflicts,
  ];
}
