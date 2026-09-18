/// XAMOTO — Session ELM327 (Wi-Fi ou Bluetooth).
///
/// Reprend, côté téléphone, exactement les règles du serveur (§7, §8) :
///   • l'écho est retiré, l'invite `>` est le seul repère de fin de réponse ;
///   • `NO DATA` / `UNABLE TO CONNECT` / `BUS INIT: ERROR` sont des RÉPONSES,
///     pas des valeurs : elles signifient « je ne sais pas », jamais « 0 » ;
///   • aucune commande n'est inventée pour « faire parler » l'adaptateur.
library;

import 'transport.dart';

/// Réponses normalisées de l'adaptateur.
abstract final class ElmResponses {
  static const String noData = 'NO DATA';
  static const String unableToConnect = 'UNABLE TO CONNECT';
  static const String busError = 'BUS INIT: ERROR';
  static const String ok = 'OK';
  static const String questionMarks = '?';
}

class ElmError implements Exception {
  ElmError(this.messageFr, {this.raw});

  final String messageFr;
  final String? raw;

  @override
  String toString() => 'ElmError: $messageFr${raw == null ? '' : ' ($raw)'}';
}

/// Nettoyage d'une réponse brute : écho, invite, espaces, bruit de liaison.
///
/// Fonction pure, donc testable sans matériel (voir `test/elm327_test.dart`).
String cleanResponse(String raw, {String? sentCommand}) {
  final lines = <String>[];
  for (final line in raw.replaceAll('\r', '\n').split('\n')) {
    final trimmed = line.trim();
    if (trimmed.isEmpty) continue;
    if (trimmed == '>') continue;
    if (trimmed.toUpperCase().startsWith('SEARCHING')) continue;
    // L'écho de la commande envoyée n'est pas une donnée.
    if (sentCommand != null && trimmed.toUpperCase() == sentCommand.toUpperCase().replaceAll(' ', '')) continue;
    lines.add(trimmed);
  }
  // Les réponses multi-lignes (mode 03) sont concaténées avec une espace.
  return lines.join(' ').replaceAll(RegExp(r'\s+'), ' ').trim();
}

/// Une réponse indique-t-elle une absence de donnée (et non une valeur) ?
bool isNoData(String cleaned) {
  final upper = cleaned.toUpperCase();
  return upper.isEmpty ||
      upper.contains(ElmResponses.noData) ||
      upper.contains(ElmResponses.unableToConnect) ||
      upper.contains(ElmResponses.busError) ||
      upper.contains(ElmResponses.questionMarks);
}

class Elm327Session {
  Elm327Session(this.transport);

  final ObdTransport transport;
  String? _protocol;
  bool _initialized = false;

  String? get protocol => _protocol;
  bool get isInitialized => _initialized;

  /// Séquence d'initialisation standard. Aucun réglage exotique : XAMOTO veut
  /// parler à l'adaptateur, pas le configurer finement.
  Future<void> initialize() async {
    if (_initialized) return;
    await transport.connect();
    for (final command in <String>['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATSP0']) {
      try {
        await _command(command);
      } on ElmError {
        // `ATZ` peut être coupé par le redémarrage de l'adaptateur : ce n'est pas
        // une raison d'abandonner, mais une autre commande en échec l'est.
        if (command != 'ATZ') {
          throw ElmError('L’adaptateur ne répond pas à la commande $command. Vérifiez l’alimentation et la liaison.');
        }
      }
    }
    _protocol = await detectProtocol();
    _initialized = true;
  }

  /// Identifie le protocole négocié (il est affiché dans le rapport).
  Future<String?> detectProtocol() async {
    try {
      final response = await _command('ATDPN');
      final cleaned = response.replaceAll('A', '');
      switch (cleaned) {
        case '1':
        case '2':
          return 'ISO 9141-2 / KWP2000';
        case '3':
        case '4':
        case '5':
          return 'ISO 14230 (KWP)';
        case '6':
          return 'ISO 15765-4 (CAN 11/500)';
        case '7':
          return 'ISO 15765-4 (CAN 29/500)';
        case '8':
          return 'ISO 15765-4 (CAN 11/250)';
        case '9':
          return 'ISO 15765-4 (CAN 29/250)';
        default:
          return null;
      }
    } on ElmError {
      return null;
    }
  }

  /// Lit un PID (mode 01).
  ///
  /// Un PID non supporté renvoie une chaîne vide : l'appelant en déduit
  /// `supported: false`. On ne remplace JAMAIS par une valeur par défaut.
  Future<String> readPid(String obdPid) async {
    final response = await _command('01$obdPid', tolerateErrors: true);
    return isNoData(response) ? '' : response;
  }

  /// Codes défaut confirmés (03), en attente (07), permanents (0A).
  Future<String> readDtcs({String mode = '03'}) async {
    final response = await _command(mode, tolerateErrors: true);
    return isNoData(response) ? '' : response;
  }

  /// Efface les codes défaut (mode 04) et remet à zéro les moniteurs.
  ///
  /// XAMOTO demande TOUJOURS une confirmation explicite avant d'appeler ceci :
  /// effacer un code efface aussi la preuve du défaut (§12, §22).
  Future<bool> clearDtcs() async {
    final response = await _command('04');
    return response.toUpperCase().contains(ElmResponses.ok);
  }

  /// État du voyant moteur (mode 01 PID 01).
  Future<String> readMilStatus() => readPid('01');

  /// Blocs `0100 / 0120 / 0140 / 0160` : quels PID ce véhicule fournit vraiment.
  Future<List<String>> readSupportedPidBlocks() async {
    final blocks = <String>[];
    for (final pid in <String>['00', '20', '40', '60']) {
      final response = await readPid(pid);
      if (response.isEmpty) continue;
      blocks.add(response);
      // Un bloc nul signifie « aucun PID au-delà » : inutile d'insister.
      if (response.replaceAll(' ', '').endsWith('00000000')) break;
    }
    return blocks;
  }

  Future<String> _command(String command, {bool tolerateErrors = false}) async {
    await transport.write('$command\r');
    try {
      final raw = await transport.readUntilPrompt();
      return cleanResponse(raw, sentCommand: command);
    } on ElmError {
      if (tolerateErrors) return ElmResponses.noData;
      rethrow;
    }
  }

  Future<void> disconnect() => transport.disconnect();
}
