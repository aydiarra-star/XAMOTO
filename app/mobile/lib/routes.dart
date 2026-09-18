/// XAMOTO — Navigation de l'application mobile.
///
/// Liste centralisée : `tools/test/mobile_contract.test.ts` vérifie que chaque
/// écran déclaré ici existe bien dans `lib/screens/`. Un écran supprimé sans
/// mettre à jour la navigation ferait planter l'application à l'exécution — un
/// défaut qu'aucun test Dart ne peut voir sans SDK, mais qu'une vérification de
/// structure peut voir.
library;

abstract final class Routes {
  static const String home = '/';
  static const String login = '/login';
  static const String vehicles = '/vehicles';
  static const String scan = '/scan';
  static const String diagnostic = '/diagnostic';
  static const String canIDrive = '/can-i-drive';
  static const String guidedTests = '/tests';
  static const String assistant = '/assistant';
  static const String maintenance = '/maintenance';
  static const String garages = '/garages';
  static const String report = '/report';
  static const String settings = '/settings';
  static const String alerts = '/alerts';
  static const String quotes = '/quotes';
  static const String postRepair = '/post-repair';
  static const String secondOpinion = '/second-opinion';
  static const String inspection = '/inspection';

  /// Écrans et fichiers correspondants (chemin relatif à `lib/`).
  static const Map<String, String> screens = <String, String>{
    home: 'screens/home_screen.dart',
    login: 'screens/login_screen.dart',
    vehicles: 'screens/vehicles_screen.dart',
    scan: 'screens/scan_screen.dart',
    diagnostic: 'screens/diagnostic_screen.dart',
    canIDrive: 'screens/can_i_drive_screen.dart',
    guidedTests: 'screens/guided_tests_screen.dart',
    assistant: 'screens/assistant_screen.dart',
    maintenance: 'screens/maintenance_screen.dart',
    garages: 'screens/garages_screen.dart',
    report: 'screens/report_screen.dart',
    settings: 'screens/settings_screen.dart',
    alerts: 'screens/alerts_screen.dart',
    quotes: 'screens/quotes_screen.dart',
    postRepair: 'screens/post_repair_screen.dart',
    secondOpinion: 'screens/second_opinion_screen.dart',
    inspection: 'screens/inspection_screen.dart',
  };
}
