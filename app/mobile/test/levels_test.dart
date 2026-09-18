/// XAMOTO — Niveaux et phrases exigées, côté mobile.
///
/// Ces règles sont aussi importantes sur téléphone que sur serveur : la sécurité
/// ne s'adoucit jamais, un plafond ne peut que réduire, et une donnée absente
/// s'annonce avec la phrase exacte du §16.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:xamoto_mobile/core/data_origin.dart';
import 'package:xamoto_mobile/core/disclaimer.dart';
import 'package:xamoto_mobile/core/levels.dart';

void main() {
  group('niveaux (§10, §11)', () {
    test('le pire niveau de sécurité l’emporte, jamais une moyenne', () {
      expect(
        SafetyLevel.worst(<SafetyLevel>[SafetyLevel.normal, SafetyLevel.critical, SafetyLevel.attention]),
        SafetyLevel.critical,
      );
      expect(SafetyLevel.worst(<SafetyLevel>[]), SafetyLevel.normal);
    });

    test('un plafond ne peut que réduire la certitude', () {
      expect(CertaintyLevel.confirmed.cap(CertaintyLevel.possible), CertaintyLevel.possible);
      expect(CertaintyLevel.possible.cap(CertaintyLevel.confirmed), CertaintyLevel.possible);
    });

    test('un niveau inconnu devient NON DISPONIBLE, jamais CONFIRMÉ', () {
      expect(CertaintyLevel.parse('valeur_bizarre'), CertaintyLevel.unavailable);
      expect(CertaintyLevel.parse(null), CertaintyLevel.unavailable);
      expect(SafetyLevel.parse('inconnu'), SafetyLevel.normal);
    });
  });

  group('provenance (§33)', () {
    test('chaque origine est reconnue, et l’inconnue reste inconnue', () {
      expect(DataOrigin.parse('measured'), DataOrigin.measured);
      expect(DataOrigin.parse('simulated').isSimulated, isTrue);
      expect(DataOrigin.parse('autre'), DataOrigin.unknown);
    });
  });

  group('phrases exigées (§16)', () {
    test('les phrases sont exactes', () {
      expect(kInsufficientDataFr, 'Je ne dispose pas de cette donnée pour votre véhicule.');
      expect(kSeveralCausesFr, 'Plusieurs causes sont possibles.');
      expect(kTestRequiredFr, 'Ce test est nécessaire avant de conclure.');
    });

    test('la mention de simulation et l’avertissement existent dans les deux langues', () {
      expect(kSimulationFr.isNotEmpty && kSimulationEn.isNotEmpty, isTrue);
      expect(kNoGuaranteeFr.contains('garantie') || kNoGuaranteeFr.contains('ne remplace pas'), isTrue);
      expect(kNoGuaranteeEn.contains('guarantee'), isTrue);
    });
  });
}
