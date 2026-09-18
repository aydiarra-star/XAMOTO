/// XAMOTO — Catalogue wolof : aucune consigne de sécurité non relue (§47-7).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:xamoto_mobile/i18n/catalogue.g.dart';
import 'package:xamoto_mobile/i18n/catalogue_entry.dart';
import 'package:xamoto_mobile/i18n/strings.dart';

void main() {
  test('le catalogue est cohérent (clé, français, anglais, portée, statut)', () {
    expect(kWolofCatalogue, isNotEmpty);
    for (final entry in kWolofCatalogue) {
      expect(entry.key, isNotEmpty);
      expect(entry.fr, isNotEmpty);
      expect(entry.en, isNotEmpty);
      // Une entrée relue porte le nom de son relecteur.
      if (entry.status == WolofStatus.reviewed) expect(entry.reviewer, isNotNull);
    }
  });

  test('aucune consigne de sécurité non relue n’est affichable en wolof', () {
    for (final entry in kWolofCatalogue) {
      if (entry.scope == WolofScope.safety) {
        expect(entry.displayableInWolof, isFalse, reason: 'consigne non relue affichée : ${entry.key}');
      }
    }
  });

  test('le rapport de langue est exact et annonce les relectures manquantes', () {
    final report = I18n.wolofReport();
    expect(report.total, kWolofCatalogue.length);
    expect(report.safetyPending, greaterThan(0));
    expect(report.safetyReady, isFalse);
  });

  test('aucun mot wolof n’est fabriqué pour la sécurité', () {
    final i18n = const I18n('wo');
    // La consigne de conduite revient en français tant qu'aucun locuteur natif
    // n'a relu la traduction : c'est le comportement voulu, pas un défaut.
    expect(i18n.label('drive.do_not_drive'), contains('déconseillé'));
    expect(i18n.label('safety.critical'), 'CRITIQUE');
  });
}
