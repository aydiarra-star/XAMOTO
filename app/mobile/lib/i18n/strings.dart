/// XAMOTO — Textes de l'application (§40, §41).
///
/// Le français est la langue de référence. L'anglais est fourni pour l'interface.
/// Le wolof vient EXCLUSIVEMENT du catalogue généré (`catalogue.g.dart`) : ce
/// fichier n'invente aucun mot wolof, et un texte de sécurité non relu s'affiche
/// en français avec une explication.
library;

import '../core/levels.dart';
import 'catalogue.g.dart';
import 'catalogue_entry.dart';

class I18n {
  const I18n(this.locale);

  /// 'fr', 'en' ou 'wo'.
  final String locale;

  static const List<String> locales = <String>['fr', 'en', 'wo'];

  /// Langue réellement utilisée pour les textes libres : le wolof n'est pas une
  /// langue de rédaction, c'est une langue de libellés relus.
  String get contentLocale => locale == 'en' ? 'en' : 'fr';

  bool get isWolof => locale == 'wo';

  String t(String fr, String en) => contentLocale == 'en' ? en : fr;

  static final Map<String, WolofEntry> _byKey = <String, WolofEntry>{
    for (final entry in kWolofCatalogue) entry.key: entry,
  };

  /// Libellé normalisé (niveau, origine, statut) avec la règle de sécurité.
  String label(String key, {String? fallback}) {
    final entry = _byKey[key];
    if (entry == null) return fallback ?? key;
    if (isWolof && entry.displayableInWolof) return entry.wo;
    return contentLocale == 'en' ? entry.en : entry.fr;
  }

  String certainty(CertaintyLevel level) => label('certainty.${_certaintyKey(level)}', fallback: level.fr);
  String safety(SafetyLevel level) => label('safety.${_safetyKey(level)}', fallback: level.fr);
  String origin(DataOrigin origin) => label('origin.${origin.name}', fallback: origin.fr);

  static String _certaintyKey(CertaintyLevel level) {
    switch (level) {
      case CertaintyLevel.confirmed:
        return 'confirmed';
      case CertaintyLevel.stronglyCompatible:
        return 'strongly_compatible';
      case CertaintyLevel.possible:
        return 'possible';
      case CertaintyLevel.undeterminable:
        return 'undeterminable';
      case CertaintyLevel.unavailable:
        return 'unavailable';
    }
  }

  static String _safetyKey(SafetyLevel level) => level.name;

  /// État de la langue : ce qui est relu, ce qui est provisoire, ce qui manque.
  static WolofReport wolofReport() {
    var displayable = 0;
    var reviewed = 0;
    var safetyPending = 0;
    for (final entry in kWolofCatalogue) {
      if (entry.displayableInWolof) displayable++;
      if (entry.status == WolofStatus.reviewed) reviewed++;
      if (entry.scope == WolofScope.safety && !entry.displayableInWolof) safetyPending++;
    }
    return WolofReport(
      total: kWolofCatalogue.length,
      displayable: displayable,
      reviewed: reviewed,
      safetyPending: safetyPending,
    );
  }

  /// Bandeau affiché quand l'utilisateur a choisi le wolof.
  String get wolofNotice => t(
        'Version wolof partielle : les libellés relus s’affichent en wolof, le reste en français. '
            'Aucune traduction automatique n’est utilisée.',
        'Partial Wolof version: reviewed labels are shown in Wolof, the rest in French. '
            'No machine translation is used.',
      );

  static const Map<String, String> _fallbackLabelsFr = <String, String>{
    'nav.home': 'Accueil',
    'nav.vehicles': 'Véhicules',
    'nav.diagnostic': 'Diagnostic',
    'nav.assistant': 'Assistant',
    'nav.maintenance': 'Entretien',
    'nav.garages': 'Garages',
    'nav.reports': 'Rapports',
  };

  /// Nom des entrées de navigation, repli sur le dictionnaire local si la clé
  /// disparaissait du catalogue (le catalogue peut évoluer, l'écran non).
  String nav(String key) => label(key, fallback: _fallbackLabelsFr[key] ?? key);
}
