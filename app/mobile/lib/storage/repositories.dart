/// XAMOTO — Dépôts locaux : lire et écrire sans réseau.
///
/// Chaque écriture locale stocke la charge utile JSON reçue du serveur, telle
/// quelle. Le mobile ne « recalcule » jamais une conclusion : il conserve ce que
/// le moteur a produit, et affiche l'heure de la dernière synchronisation.
library;

import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../api/models/diagnostic.dart';
import '../api/models/scan.dart';
import '../api/models/vehicle.dart';
import 'local_db.dart';
import 'sync_queue.dart';

class VehicleRepository {
  VehicleRepository(this._db);

  final LocalDatabase _db;

  Future<void> save(Vehicle vehicle, {required Map<String, Object?> payload}) async {
    await _db.db.insert(
      'vehicles',
      <String, Object?>{
        'id': vehicle.id,
        'brand': vehicle.brand,
        'model': vehicle.model,
        'year': vehicle.year,
        'plate': vehicle.plate,
        'odometer_km': vehicle.odometerKm,
        'payload': jsonEncode(payload),
        'synced_at': DateTime.now().toUtc().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Vehicle>> all() async {
    final rows = await _db.db.query('vehicles', orderBy: 'brand, model');
    return rows
        .map((row) => Vehicle.fromJson(jsonDecode(row['payload'] as String) as Map<String, dynamic>))
        .toList();
  }

  /// Dernière synchronisation de la fiche — affichée pour que l'utilisateur
  /// sache si le chiffre qu'il regarde date d'aujourd'hui ou de la semaine passée.
  Future<DateTime?> lastSyncedAt(String vehicleId) async {
    final rows = await _db.db.query('vehicles', columns: <String>['synced_at'], where: 'id = ?', whereArgs: <Object?>[vehicleId]);
    if (rows.isEmpty) return null;
    return DateTime.tryParse(rows.first['synced_at'] as String? ?? '');
  }

  Future<void> remove(String vehicleId) async {
    await _db.db.delete('vehicles', where: 'id = ?', whereArgs: <Object?>[vehicleId]);
  }
}

class ScanRepository {
  ScanRepository(this._db);

  final LocalDatabase _db;

  Future<void> save(ScanResult scan, {required String vehicleId}) async {
    await _db.db.insert(
      'scans',
      <String, Object?>{
        'id': scan.sessionId,
        'vehicle_id': vehicleId,
        'source': scan.source,
        'scenario': scan.scenario,
        'started_at': scan.startedAt?.toIso8601String() ?? DateTime.now().toUtc().toIso8601String(),
        'payload': jsonEncode(<String, Object?>{
          'sessionId': scan.sessionId,
          'source': scan.source,
          'scenario': scan.scenario,
          'protocol': scan.protocol,
          'milOn': scan.milOn,
          'startedAt': scan.startedAt?.toIso8601String(),
          'readings': scan.readings.map((r) => <String, Object?>{'key': r.key, 'value': r.value, 'supported': r.supported, 'unit': r.unit, 'origin': r.origin.name}).toList(),
          'dtcs': scan.dtcs.map((d) => <String, Object?>{'code': d.code, 'status': d.status}).toList(),
          'unsupportedPids': scan.unsupportedPids,
          'warnings': scan.warnings,
        }),
        'synced_at': DateTime.now().toUtc().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<ScanResult>> forVehicle(String vehicleId, {int limit = 20}) async {
    final rows = await _db.db.query('scans', where: 'vehicle_id = ?', whereArgs: <Object?>[vehicleId], orderBy: 'started_at DESC', limit: limit);
    return rows.map((row) => ScanResult.fromJson(jsonDecode(row['payload'] as String) as Map<String, dynamic>)).toList();
  }
}

class DiagnosticRepository {
  DiagnosticRepository(this._db);

  final LocalDatabase _db;

  Future<void> save(DiagnosticResult diagnostic, {String? scanId}) async {
    await _db.db.insert(
      'diagnostics',
      <String, Object?>{
        'id': diagnostic.id,
        'vehicle_id': diagnostic.vehicleId,
        'scan_id': scanId,
        'certainty': diagnostic.certainty.name,
        'safety': diagnostic.safety.name,
        'payload': jsonEncode(<String, Object?>{
          'id': diagnostic.id,
          'vehicleId': diagnostic.vehicleId,
          'mode': diagnostic.mode,
          'certainty': diagnostic.certainty.name,
          'safety': diagnostic.safety.name,
          'conclusionFr': diagnostic.conclusionFr,
          'conclusionEn': diagnostic.conclusionEn,
          'hypotheses': diagnostic.hypotheses
              .map((h) => <String, Object?>{
                    'causeKey': h.causeKey,
                    'labelFr': h.labelFr,
                    'labelEn': h.labelEn,
                    'score': h.score,
                    'certainty': h.certainty.name,
                    'reasoning': h.reasoning,
                    'parts': h.parts,
                    'confirmingTest': h.confirmingTest,
                  })
              .toList(),
          'findings': diagnostic.findings
              .map((f) => <String, Object?>{
                    'kind': f.kind,
                    'titleFr': f.titleFr,
                    'titleEn': f.titleEn,
                    'detailFr': f.detailFr,
                    'detailEn': f.detailEn,
                    'certainty': f.certainty.name,
                    'safety': f.safety.name,
                  })
              .toList(),
          if (diagnostic.canIDrive != null)
            'canIDrive': <String, Object?>{
              'level': diagnostic.canIDrive!.level,
              'headlineFr': diagnostic.canIDrive!.headlineFr,
              'headlineEn': diagnostic.canIDrive!.headlineEn,
              'whyFr': diagnostic.canIDrive!.whyFr,
              'whyEn': diagnostic.canIDrive!.whyEn,
              'toCheckFr': diagnostic.canIDrive!.toCheckFr,
              'toCheckEn': diagnostic.canIDrive!.toCheckEn,
              'avoidFr': diagnostic.canIDrive!.avoidFr,
              'avoidEn': diagnostic.canIDrive!.avoidEn,
              'certainty': diagnostic.canIDrive!.certainty.name,
              'disclaimerFr': diagnostic.canIDrive!.disclaimerFr,
              'disclaimerEn': diagnostic.canIDrive!.disclaimerEn,
              'missingData': diagnostic.canIDrive!.missingData,
            },
        }),
        'synced_at': DateTime.now().toUtc().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<DiagnosticResult?> latest(String vehicleId) async {
    final rows = await _db.db.query('diagnostics', where: 'vehicle_id = ?', whereArgs: <Object?>[vehicleId], orderBy: 'synced_at DESC', limit: 1);
    if (rows.isEmpty) return null;
    final payload = jsonDecode(rows.first['payload'] as String) as Map<String, dynamic>;
    return DiagnosticResult.fromJson(payload);
  }

  /// Résultat de test guidé : enregistré seulement si l'utilisateur a CONFIRMÉ
  /// ce qu'il a observé (§47-8) — un test non confirmé reste « proposé ».
  Future<void> saveTestResult({
    required String diagnosticId,
    required String testKey,
    required String outcome,
    required bool confirmed,
    String? note,
  }) async {
    await _db.db.insert(
      'test_results',
      <String, Object?>{
        'id': '$diagnosticId:$testKey',
        'diagnostic_id': diagnosticId,
        'test_key': testKey,
        'outcome': outcome,
        'note': note,
        'confirmed': confirmed ? 1 : 0,
        'created_at': DateTime.now().toUtc().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }
}

/// Dépôt de la file d'attente : ce qui reste à envoyer, et pourquoi.
class PendingRepository {
  PendingRepository(this._db);

  final LocalDatabase _db;

  Future<int> enqueue({
    required PendingKind kind,
    required String opKey,
    required String path,
    required Map<String, Object?> payload,
    String? vehicleId,
  }) async {
    // Une même observation n'est pas envoyée deux fois : on remplace l'attente
    // précédente plutôt que d'empiler des doublons.
    await _db.db.delete('pending_operations', where: 'op_key = ? AND status = ?', whereArgs: <Object?>[opKey, 'pending']);
    return _db.db.insert('pending_operations', <String, Object?>{
      'op_key': opKey,
      'vehicle_id': vehicleId,
      'payload': jsonEncode(<String, Object?>{'kind': kind.name, 'path': path, 'body': payload}),
      'created_at': DateTime.now().toUtc().toIso8601String(),
      'status': 'pending',
    });
  }

  Future<List<PendingOperation>> pending() async {
    final rows = await _db.db.query('pending_operations', where: 'status = ?', whereArgs: <Object?>['pending'], orderBy: 'created_at');
    return rows.map(_toOperation).toList();
  }

  Future<int> countPending() async {
    final rows = await _db.db.rawQuery('SELECT COUNT(*) AS n FROM pending_operations WHERE status = ?', <Object?>['pending']);
    return (rows.first['n'] as int?) ?? 0;
  }

  Future<void> markSent(int id) => _db.db.update('pending_operations', <String, Object?>{'status': 'sent'}, where: 'id = ?', whereArgs: <Object?>[id]);

  /// Un échec ne supprime jamais l'opération : elle est retentée plus tard,
  /// avec le nombre d'essais et la raison du dernier échec affichés en clair.
  Future<void> markFailed(int id, String error) => _db.db.rawUpdate(
        'UPDATE pending_operations SET attempts = attempts + 1, last_error = ? WHERE id = ?',
        <Object?>[error, id],
      );

  PendingOperation _toOperation(Map<String, Object?> row) {
    final decoded = jsonDecode(row['payload'] as String) as Map<String, dynamic>;
    final body = (decoded['body'] as Map<String, dynamic>? ?? <String, dynamic>{});
    return PendingOperation(
      id: row['id'] as int,
      kind: PendingKind.values.firstWhere(
        (kind) => kind.name == decoded['kind'],
        orElse: () => PendingKind.observation,
      ),
      opKey: row['op_key'] as String,
      path: decoded['path'] as String? ?? '',
      payload: body,
      createdAt: DateTime.tryParse(row['created_at'] as String? ?? '') ?? DateTime.now(),
      attempts: (row['attempts'] as int?) ?? 0,
      vehicleId: row['vehicle_id'] as String?,
      lastError: row['last_error'] as String?,
    );
  }
}
