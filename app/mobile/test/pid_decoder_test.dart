/// XAMOTO — Vérifications de la couche OBD locale (à exécuter avec `flutter test`).
///
/// Ces tests portent sur les fonctions PURES : aucune liaison, aucun appareil.
/// Ils reprennent, côté Dart, les règles déjà prouvées côté serveur : un octet de
/// remplissage n'est pas une valeur, un code défaut se décode selon la norme.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:xamoto_mobile/obd/dtc_reader.dart';
import 'package:xamoto_mobile/obd/elm327.dart';
import 'package:xamoto_mobile/obd/pid_decoder.dart';

void main() {
  group('décodage des PID (SAE J1979)', () {
    test('le régime moteur se décode selon la formule normalisée', () {
      // 41 0C 1A F8 → ((0x1A × 256) + 0xF8) / 4 = 1726 tr/min
      final reading = decodeMode01('engine_rpm', '41 0C 1A F8');
      expect(reading.supported, isTrue);
      expect(reading.value, closeTo(1726, 0.01));
      expect(reading.unit, 'tr/min');
    });

    test('la température de liquide est décalée de 40 °C', () {
      expect(decodeMode01('coolant_temp', '41 05 7B').value, closeTo(83, 0.01));
    });

    test('un remplissage 0x00 n’est jamais une valeur', () {
      final reading = decodeMode01('coolant_temp', '41 05 00');
      expect(reading.supported, isFalse);
      expect(reading.value, isNull);
    });

    test('un remplissage 0xFF n’est jamais une valeur', () {
      final reading = decodeMode01('engine_rpm', '41 0C FF FF');
      expect(reading.supported, isFalse);
      expect(reading.value, isNull);
    });

    test('une réponse d’un autre PID est refusée', () {
      // Le véhicule répond pour 0x05 alors qu'on demandait 0x0C.
      expect(decodeMode01('engine_rpm', '41 05 7B').supported, isFalse);
    });

    test('un PID sans formule connue n’est pas deviné', () {
      expect(PidCatalog.decode('pression_pneus', <int>[10, 20]), isNull);
    });

    test('les masques de PID supportés sont lus bit à bit', () {
      // 41 00 BE 3F A8 13 → les PID 01, 02, 03, 04, 05, 06, 07… selon les bits.
      final supported = supportedPidNumbers('41 00 BE 3F A8 13');
      expect(supported.contains(0x0C), isTrue);
      expect(supported.contains(0x01), isTrue);
      expect(supported.contains(0x20), isFalse);
    });
  });

  group('codes défaut (SAE J2012)', () {
    test('une paire d’octets devient un code normalisé', () {
      expect(decodeDtcPair(0x01, 0x33), 'P0133');
      expect(decodeDtcPair(0x04, 0x20), 'P0420');
      expect(decodeDtcPair(0x00, 0x35), 'P0035');
    });

    test('les familles P, C, B et U sont distinguées', () {
      expect(decodeDtcPair(0x43, 0x00)?.startsWith('C'), isTrue); // 01 43 → C
      expect(dtcFamilyFr('C0035'), contains('Châssis'));
      expect(dtcFamilyFr('U0100'), contains('Réseau'));
      expect(dtcFamilyFr('B1234'), contains('Carrosserie'));
    });

    test('un remplissage ne produit pas de code', () {
      expect(decodeDtcPair(0x00, 0x00), isNull);
      expect(decodeDtcPair(0xFF, 0xFF), isNull);
    });

    test('la réponse annonce son nombre de codes', () {
      final codes = decodeDtcResponse('43 02 01 33 04 20', status: 'active');
      expect(codes.map((dtc) => dtc.code).toList(), <String>['P0133', 'P0420']);
      expect(codes.every((dtc) => dtc.status == 'active'), isTrue);
    });

    test('un nombre annoncé supérieur aux données ne fabrique rien', () {
      expect(decodeDtcResponse('43 05 01 33', status: 'active').length, 1);
    });

    test('une validation stricte refuse un code inventé', () {
      expect(isValidDtc('P0420'), isTrue);
      expect(isValidDtc('X9999'), isFalse);
      expect(isValidDtc('P429'), isFalse);
    });
  });

  group('réponses ELM327', () {
    test('l’écho et l’invite sont retirés', () {
      expect(cleanResponse('010C\r41 0C 1A F8\r>', sentCommand: '010C'), '41 0C 1A F8');
    });

    test('une réponse multi-lignes est assemblée', () {
      expect(cleanResponse('43 02\r01 33 04 20\r>'), '43 02 01 33 04 20');
    });

    test('une absence de donnée est reconnue comme telle', () {
      expect(isNoData('NO DATA'), isTrue);
      expect(isNoData('UNABLE TO CONNECT'), isTrue);
      expect(isNoData('BUS INIT: ERROR'), isTrue);
      expect(isNoData('41 0C 1A F8'), isFalse);
    });
  });
}
