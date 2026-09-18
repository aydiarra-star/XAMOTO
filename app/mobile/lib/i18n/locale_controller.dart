/// XAMOTO — Choix de langue, mémorisé localement (§40, §41).
library;

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'strings.dart';

const String kLocaleStorageKey = 'xamoto.locale';

class LocaleController extends ChangeNotifier {
  LocaleController({String initial = 'fr'}) : _locale = I18n.locales.contains(initial) ? initial : 'fr';

  String _locale;

  String get locale => _locale;
  I18n get i18n => I18n(_locale);

  /// Charge la langue enregistrée. Une langue inconnue retombe sur le français :
  /// on n'affiche jamais une interface dans une langue non prévue.
  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(kLocaleStorageKey);
    if (stored != null && I18n.locales.contains(stored)) {
      _locale = stored;
      notifyListeners();
    }
  }

  Future<void> setLocale(String value) async {
    if (!I18n.locales.contains(value)) return;
    _locale = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(kLocaleStorageKey, value);
  }

  /// Cycle français → anglais → wolof.
  Future<void> cycle() async {
    final index = I18n.locales.indexOf(_locale);
    await setLocale(I18n.locales[(index + 1) % I18n.locales.length]);
  }
}
