/// XAMOTO — Provenance des données (§33).
///
/// Fichier séparé de `levels.dart` pour que les modèles n'importent que ce dont
/// ils ont besoin, et pour que la provenance reste visible partout où une valeur
/// est affichée : une mesure, un calcul et une simulation ne se lisent pas pareil.
library;

enum DataOrigin {
  measured('Mesuré', 'Measured', 'Natt na'),
  documented('Documenté', 'Documented', 'Ñu ko bind'),
  calculated('Calculé', 'Calculated', 'Ñu ko jàppe'),
  estimated('Estimé', 'Estimated', 'Ñu ko méngoo'),
  simulated('Simulé', 'Simulated', 'Simulation'),
  unknown('Inconnu', 'Unknown', 'Xamul');

  const DataOrigin(this.fr, this.en, this.wo);

  final String fr;
  final String en;

  /// `''` = pas de texte relu : l'interface affiche le français.
  final String wo;

  bool get isSimulated => this == DataOrigin.simulated;

  static DataOrigin parse(String? raw) {
    switch (raw) {
      case 'measured':
        return DataOrigin.measured;
      case 'documented':
        return DataOrigin.documented;
      case 'calculated':
        return DataOrigin.calculated;
      case 'estimated':
        return DataOrigin.estimated;
      case 'simulated':
        return DataOrigin.simulated;
      default:
        return DataOrigin.unknown;
    }
  }
}
