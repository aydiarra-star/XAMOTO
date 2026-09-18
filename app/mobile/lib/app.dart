/// XAMOTO — Application : thème, langue, navigation.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'routes.dart';
import 'screens/assistant_screen.dart';
import 'screens/can_i_drive_screen.dart';
import 'screens/diagnostic_screen.dart';
import 'screens/garages_screen.dart';
import 'screens/guided_tests_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/maintenance_screen.dart';
import 'screens/report_screen.dart';
import 'screens/scan_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/vehicles_screen.dart';
import 'state/app_state.dart';

class XamotoApp extends StatelessWidget {
  const XamotoApp({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return MaterialApp(
      title: 'XAMOTO',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0B3C5D)),
        useMaterial3: true,
      ),
      // La langue vient du contrôleur d'état : changer de langue reconstruit
      // l'arbre, sans redémarrage ni écran intermédiaire.
      locale: Locale(state.i18n.contentLocale),
      supportedLocales: const <Locale>[Locale('fr'), Locale('en')],
      initialRoute: Routes.home,
      routes: <String, WidgetBuilder>{
        Routes.home: (_) => const HomeScreen(),
        Routes.login: (_) => const LoginScreen(),
        Routes.vehicles: (_) => const VehiclesScreen(),
        Routes.scan: (_) => const ScanScreen(),
        Routes.diagnostic: (_) => const DiagnosticScreen(),
        Routes.canIDrive: (_) => const CanIDriveScreen(),
        Routes.guidedTests: (_) => const GuidedTestsScreen(),
        Routes.assistant: (_) => const AssistantScreen(),
        Routes.maintenance: (_) => const MaintenanceScreen(),
        Routes.garages: (_) => const GaragesScreen(),
        Routes.report: (_) => const ReportScreen(),
        Routes.settings: (_) => const SettingsScreen(),
      },
    );
  }
}
