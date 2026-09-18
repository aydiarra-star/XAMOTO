/// XAMOTO — Types du catalogue wolof (§40, §41).
///
/// Le catalogue lui-même est GÉNÉRÉ depuis `shared/src/i18n.ts`
/// (`npm run mobile:i18n`) : la relecture se fait en un seul endroit.
library;

/// Portée d'un texte : ce n'est pas la même chose de traduire un bouton et une
/// consigne de freinage.
enum WolofScope {
  /// Navigation, boutons, titres.
  ui,

  /// Libellés normalisés (niveaux, origines, statuts).
  label,

  /// Consignes de sécurité, refus, avertissements : relecture obligatoire.
  safety,
}

enum WolofStatus { reviewed, draft }

class WolofEntry {
  const WolofEntry({
    required this.key,
    required this.fr,
    required this.en,
    required this.wo,
    required this.scope,
    required this.status,
    required this.reviewer,
    this.note,
  });

  final String key;
  final String fr;
  final String en;
  final String wo;
  final WolofScope scope;
  final WolofStatus status;

  /// Nom du relecteur natif — `null` tant que la relecture n'a pas eu lieu.
  final String? reviewer;
  final String? note;

  /// Un texte de sécurité non relu n'est JAMAIS affiché en wolof.
  bool get displayableInWolof => wo.isNotEmpty && (scope != WolofScope.safety || status == WolofStatus.reviewed);
}

class WolofReport {
  const WolofReport({
    required this.total,
    required this.displayable,
    required this.reviewed,
    required this.safetyPending,
  });

  final int total;
  final int displayable;
  final int reviewed;
  final int safetyPending;

  bool get safetyReady => safetyPending == 0;
}
