/**
 * XAMOTO — Accès base de données (SQLite embarqué, local-first §29).
 *
 * En production, la même logique s'applique à PostgreSQL / Supabase
 * (voir database/migrations/postgres/001_init.sql). Le dialecte est isolé ici :
 * les dépôts n'écrivent que du SQL standard.
 */
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';

export type Row = Record<string, unknown>;
export type Params = unknown[] | Row;

let database: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (!database) {
    database = new DatabaseSync(config.dbPath);
    database.exec(SCHEMA_SQL);
    applyMigrations(database);
  }
  return database;
}

/**
 * Colonnes ajoutées après la première mise en service.
 *
 * `CREATE TABLE IF NOT EXISTS` ne touche pas une table déjà créée : une base
 * existante garderait donc une colonne manquante et une écriture échouerait à
 * l'exécution — c'est exactement ce qui est arrivé à `repairs.odometer_km`, que
 * la route `/api/repairs` écrivait alors que la colonne n'existait pas.
 *
 * Chaque entrée est donc vérifiée puis ajoutée si besoin. Aucune donnée n'est
 * modifiée ni supprimée : ajouter une colonne nullable ne peut rien casser, et
 * une base déjà à jour ne fait que lire `table_info`.
 */
const MIGRATIONS: Array<{ table: string; column: string; definition: string }> = [
  { table: 'repairs', column: 'odometer_km', definition: 'INTEGER' },
];

function applyMigrations(handle: DatabaseSync): void {
  for (const migration of MIGRATIONS) {
    const columns = handle.prepare(`PRAGMA table_info(${migration.table})`).all() as Array<{ name?: string }>;
    if (columns.length === 0) continue; // table absente : le schéma la créera
    if (columns.some((column) => column.name === migration.column)) continue;
    handle.exec(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.definition}`);
  }
}

export function closeDb(): void {
  database?.close();
  database = null;
}

/**
 * `node:sqlite` attend les paramètres en arguments successifs (`stmt.all(a, b)`),
 * et non un tableau. Les valeurs `undefined` sont converties en `null` : SQLite
 * ne connaît pas `undefined`, et XAMOTO ne veut ni valeur inventée ni erreur
 * silencieuse.
 */
function spread(params: Params): unknown[] {
  const list = Array.isArray(params) ? params : [params];
  return list.map((value) => (value === undefined ? null : value));
}

/** Requête de lecture de plusieurs lignes. */
export function all<T = Row>(sql: string, params: Params = []): T[] {
  return db().prepare(sql).all(...(spread(params) as never[])) as unknown as T[];
}

/** Requête de lecture d'une ligne. */
export function get<T = Row>(sql: string, params: Params = []): T | undefined {
  return db().prepare(sql).get(...(spread(params) as never[])) as unknown as T | undefined;
}

/** Écriture (INSERT / UPDATE / DELETE). */
export function run(sql: string, params: Params = []): { changes: number; lastInsertRowid: number | bigint } {
  const result = db().prepare(sql).run(...(spread(params) as never[]));
  return { changes: Number(result.changes), lastInsertRowid: result.lastInsertRowid as number | bigint };
}

/** Transaction simple. */
export function transaction<T>(fn: () => T): T {
  const handle = db();
  handle.exec('BEGIN');
  try {
    const result = fn();
    handle.exec('COMMIT');
    return result;
  } catch (error) {
    handle.exec('ROLLBACK');
    throw error;
  }
}

export const now = (): string => new Date().toISOString();

let counter = 0;
/** Identifiant lisible et unique (§33 : chaque donnée est rattachable à une session). */
export function id(prefix: string): string {
  counter = (counter + 1) % 100000;
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${stamp}${counter.toString(36).padStart(2, '0')}${random}`;
}

/** Journal d'audit (§37). */
export function audit(action: string, entity: string, entityId: string | null, userId: string | null, metadata?: unknown, ip?: string): void {
  run('INSERT INTO audit_logs (id, user_id, action, entity, entity_id, metadata, ip, created_at) VALUES (?,?,?,?,?,?,?,?)', [
    id('audit'),
    userId,
    action,
    entity,
    entityId,
    metadata ? JSON.stringify(metadata) : null,
    ip ?? null,
    now(),
  ]);
}

export function jsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
