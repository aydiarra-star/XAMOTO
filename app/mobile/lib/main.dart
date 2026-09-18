/// XAMOTO — « Connaître sa voiture. » (Comprendre · Diagnostiquer · Agir)
///
/// Point d'entrée de l'application mobile. Il assemble trois choses :
///   • la configuration (adresse du serveur) ;
///   • le stockage local (SQLite) — le mobile fonctionne d'abord hors ligne ;
///   • l'état applicatif, partagé par tous les écrans.
///
/// Aucune règle de diagnostic n'est chargée ici : elle vit sur le serveur (§9).
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api/api_client.dart';
import 'app.dart';
import 'i18n/locale_controller.dart';
import 'state/app_state.dart';
import 'storage/local_db.dart';

/// Adresse du serveur XAMOTO.
///
/// En développement, `--dart-define=XAMOTO_API=http://10.0.2.2:3000` vise le
/// serveur local depuis l'émulateur Android. En production, la valeur est l'URL
/// publique de l'API.
const String kApiBaseUrl = String.fromEnvironment('XAMOTO_API', defaultValue: 'http://10.0.2.2:3000');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final database = await LocalDatabase.open();
  final api = ApiClient(baseUrl: kApiBaseUrl);
  final locale = LocaleController();
  final state = AppState(api: api, locale: locale, database: database);
  await state.bootstrap();

  runApp(
    ChangeNotifierProvider<AppState>.value(
      value: state,
      child: const XamotoApp(),
    ),
  );
}
