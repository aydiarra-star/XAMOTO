/// XAMOTO — Base locale (SQLite) : le mobile fonctionne d'abord hors ligne (§32).
///
/// Principe : l'application écrit TOUJOURS en local d'abord, puis synchronise.
/// Elle n'attend pas le réseau pour afficher quelque chose d'utile, et elle ne
/// perd jamais une observation de l'utilisateur.
///
/// Deux règles de conception liées au produit :
///   1. tout ce qui vient du serveur est conservé avec l'horodatage de sa
///      dernière synchronisation — ainsi, une donnée peut être affichée « datée »
///      plutôt que fausse ;
///   2. une opération en attente est décrite en clair (`pending`, `tool`,
///      `attempts`) : l'utilisateur voit ce qui n'est pas encore parti.
library;

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

const int kLocalSchemaVersion = 1;

/// Ouvriers d'ouverture de la base locale.
class LocalDatabase {
  LocalDatabase._(this.db);

  final Database db;

  static Future<LocalDatabase> open({String? path}) async {
    final databasePath = path ?? p.join(await getDatabasesPath(), 'xamoto_local.db');
    final db = await openDatabase(
      databasePath,
      version: kLocalSchemaVersion,
      onCreate: _createSchema,
      onUpgrade: _upgradeSchema,
    );
    return LocalDatabase._(db);
  }

  static Future<void> _createSchema(Database db, int version) async {
    await db.execute('''
      CREATE TABLE vehicles (
        id TEXT PRIMARY KEY,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        year INTEGER NOT NULL,
        plate TEXT,
        odometer_km INTEGER,
        payload TEXT NOT NULL,      -- réponse JSON du serveur, conservée telle quelle
        synced_at TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE scans (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        source TEXT NOT NULL,        -- 'obd' ou 'simulator' : jamais confondus
        scenario TEXT,
        started_at TEXT NOT NULL,
        payload TEXT NOT NULL,
        synced_at TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE diagnostics (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        scan_id TEXT,
        certainty TEXT NOT NULL,
        safety TEXT NOT NULL,
        payload TEXT NOT NULL,
        synced_at TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE pending_operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op_key TEXT NOT NULL,        -- identifiant logique, unique si `dedupe`
        vehicle_id TEXT,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
      )
    ''');

    await db.execute('''
      CREATE TABLE test_results (
        id TEXT PRIMARY KEY,
        diagnostic_id TEXT NOT NULL,
        test_key TEXT NOT NULL,
        outcome TEXT NOT NULL,
        note TEXT,
        confirmed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        synced_at TEXT
      )
    ''');

    await db.execute('CREATE INDEX idx_scans_vehicle ON scans(vehicle_id, started_at DESC)');
    await db.execute('CREATE INDEX idx_pending_status ON pending_operations(status, created_at)');
  }

  static Future<void> _upgradeSchema(Database db, int from, int to) async {
    // Les migrations AJOUTENT, elles ne suppriment jamais : une donnée de
    // l'utilisateur qui disparaît après une mise à jour est inacceptable.
    for (var version = from + 1; version <= to; version++) {
      switch (version) {
        default:
          break;
      }
    }
  }

  Future<void> close() => db.close();
}
