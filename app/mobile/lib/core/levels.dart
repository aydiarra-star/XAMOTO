/// XAMOTO — Niveaux de certitude et de sécurité (§10, §11).
///
/// Ces trois énumérations sont volontairement recopiées depuis
/// `shared/src/levels.ts` : elles doivent rester identiques, et
/// `tools/test/mobile_contract.test.ts` échoue si un nom diverge.
///
/// Règle produit : aucune conclusion ne s'affiche sans son niveau de certitude,
/// et le niveau de sécurité final est le PIRE des niveaux déclenchés — jamais une
/// moyenne.
library;

/// §10 — ce que XAMOTO peut affirmer.
enum CertaintyLevel {
  confirmed('CONFIRMÉ', 'CONFIRMED', 'DÉGGAL NA'),
  stronglyCompatible('FORTEMENT COMPATIBLE', 'STRONGLY COMPATIBLE', 'DAÑU KO JÀPP'),
  possible('POSSIBLE', 'POSSIBLE', 'MANA DOON'),
  undeterminable('INDÉTERMINABLE', 'UNDETERMINABLE', 'MANU KO XAM'),
  unavailable('NON DISPONIBLE', 'NOT AVAILABLE', 'AMUL');

  const CertaintyLevel(this.fr, this.en, this.wo);

  final String fr;
  final String en;

  /// Proposition wolof : `''` signifie « pas de texte relu » → repli français.
  final String wo;

  /// Rang : 0 = le plus faible. Sert à `cap()`.
  int get rank => index == 0 ? 4 : index == 1 ? 3 : index == 2 ? 2 : index == 3 ? 1 : 0;

  /// Plafonne un niveau sans jamais l'élever : un plafond sert à réduire.
  CertaintyLevel cap(CertaintyLevel ceiling) => rank <= ceiling.rank ? this : ceiling;

  static CertaintyLevel parse(String? raw) {
    switch (raw) {
      case 'confirmed':
        return CertaintyLevel.confirmed;
      case 'strongly_compatible':
        return CertaintyLevel.stronglyCompatible;
      case 'possible':
        return CertaintyLevel.possible;
      case 'undeterminable':
        return CertaintyLevel.undeterminable;
      default:
        return CertaintyLevel.unavailable;
    }
  }
}

/// §11 — gravité pour l'utilisateur.
enum SafetyLevel {
  normal('NORMAL', 'NORMAL', '🟢'),
  attention('ATTENTION', 'CAUTION', '🟡'),
  important('IMPORTANT', 'IMPORTANT', '🟠'),
  critical('CRITIQUE', 'CRITICAL', '🔴');

  const SafetyLevel(this.fr, this.en, this.icon);

  final String fr;
  final String en;
  final String icon;

  int get rank => index;

  /// Le pire des niveaux : la sécurité ne s'adoucit jamais.
  static SafetyLevel worst(Iterable<SafetyLevel> levels) {
    var result = SafetyLevel.normal;
    for (final level in levels) {
      if (level.rank > result.rank) result = level;
    }
    return result;
  }

  static SafetyLevel parse(String? raw) {
    switch (raw) {
      case 'attention':
        return SafetyLevel.attention;
      case 'important':
        return SafetyLevel.important;
      case 'critical':
        return SafetyLevel.critical;
      default:
        return SafetyLevel.normal;
    }
  }
}
