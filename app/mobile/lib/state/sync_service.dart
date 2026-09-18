/// XAMOTO — Synchronisation avec le serveur (§32).
///
/// La synchronisation envoie ce que le téléphone a observé, récupère ce que le
/// serveur a calculé, et PRÉVIENT au lieu de trancher seule. Trois règles :
///
///   1. une observation de l'utilisateur n'est jamais perdue (elle reste en file
///      jusqu'à acceptation) ;
///   2. une conclusion du serveur n'est jamais écrasée par un état local : c'est
///      le moteur de règles qui fait foi ;
///   3. un désaccord qui touche les deux (résultat de test modifié des deux
///      côtés) est remonté comme conflit et affiché à l'utilisateur.
library;

import 'dart:convert';

import '../api/api_client.dart';
import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../storage/repositories.dart';
import '../storage/sync_queue.dart';

class SyncService {
  SyncService({required this.api, required this.pending});

  final ApiClient api;
  final PendingRepository pending;

  /// Envoie la file d'attente. Ne lève pas : le mode hors ligne est un état
  /// normal, pas une erreur.
  Future<SyncReport> flush({String? vehicleId}) async {
    final operations = await pending.pending();
    var sent = 0;
    var failed = 0;

    for (final operation in operations) {
      try {
        await api.post(operation.path, body: operation.payload);
        await pending.markSent(operation.id);
        sent++;
      } on ApiException catch (error) {
        if (error.isOffline) {
          // Réseau absent : on s'arrête là et on réessaiera. Rien n'est perdu.
          return SyncReport(sent: sent, failed: failed + (operations.length - sent - failed), pulled: 0, conflicts: const <String>[], offline: true);
        }
        await pending.markFailed(operation.id, error.message);
        failed++;
      }
    }

    final pull = await _pull(vehicleId: vehicleId);
    return SyncReport(sent: sent, failed: failed, pulled: pull.pulled, conflicts: pull.conflicts);
  }

  /// Récupère ce que le serveur a de plus récent. `vehicleId` n'est pas
  /// nécessaire : la route filtre par propriétaire et par date.
  Future<SyncReport> _pull({String? vehicleId}) async {
    try {
      // `GET /api/sync/pull?since=…` — la méthode fait partie du contrat : le
      // test de bout en bout compare le verbe utilisé ici aux routes du serveur.
      final response = await api.get(Api.syncPull, query: <String, String>{'since': '1970-01-01T00:00:00.000Z'});
      final vehicles = (response['vehicles'] as List<dynamic>? ?? const <dynamic>[]).length;
      final events = (response['events'] as List<dynamic>? ?? const <dynamic>[]).length;
      final conflicts = (response['conflicts'] as List<dynamic>? ?? const <dynamic>[])
          .map((item) => item is Map<String, dynamic> ? (item['opKey'] as String? ?? 'conflit') : '$item')
          .toList();
      return SyncReport(sent: 0, failed: 0, pulled: vehicles + events, conflicts: conflicts);
    } on ApiException {
      return const SyncReport(sent: 0, failed: 0, pulled: 0, conflicts: <String>[], offline: true);
    }
  }

  /// Envoie une opération immédiatement, ou la met en file si le réseau manque.
  Future<bool> sendOrQueue({
    required PendingKind kind,
    required String opKey,
    required String path,
    required Map<String, Object?> body,
    String? vehicleId,
  }) async {
    try {
      await api.post(path, body: body);
      return true;
    } on ApiException catch (error) {
      if (!error.isOffline) rethrow;
      await pending.enqueue(kind: kind, opKey: opKey, path: path, payload: body, vehicleId: vehicleId);
      return false;
    }
  }

  /// Résumé destiné à l'interface : « 3 opérations en attente », etc.
  Future<Map<String, Object?>> status() async {
    final count = await pending.countPending();
    final operations = await pending.pending();
    final now = DateTime.now();
    return <String, Object?>{
      'pending': count,
      'oldestMinutes': operations.isEmpty ? 0 : now.difference(operations.first.createdAt).inMinutes,
      'lastError': operations.isEmpty ? null : operations.first.lastError,
    };
  }

  static String describe(PendingOperation operation) =>
      '${operation.opKey} — ${operation.attempts} essai(s)${operation.lastError == null ? '' : ' — ${operation.lastError}'}';
}

/// Lecture d'un corps JSON : le mobile ne suppose jamais une forme, il la vérifie.
Map<String, dynamic> asJsonMap(String body) => jsonDecode(body) as Map<String, dynamic>;
