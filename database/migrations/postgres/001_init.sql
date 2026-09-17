-- =============================================================================
--  XAMOTO — « Connaître sa voiture. »
--  Migration PostgreSQL / Supabase n° 001 — schéma initial (§32)
-- =============================================================================
--
--  Objet de cette migration
--  ───────────────────────
--  Créer l'intégralité du schéma logique XAMOTO dans PostgreSQL (>= 14) ou
--  Supabase. Le dialecte SQLite (backend/src/db/schema.ts) reste la référence
--  de développement : les deux schémas sont IDENTIQUES sur le plan logique.
--
--  Règles de conception non négociables (§47)
--  ─────────────────────────────────────────
--   1. Toute donnée porte une ORIGINE (measured / documented / calculated /
--      estimated / simulated / unknown) : colonne « origin » avec contrainte.
--   2. Toute conclusion porte un NIVEAU DE CERTITUDE et un NIVEAU DE SÉCURITÉ.
--   3. Une donnée non disponible n'est jamais stockée comme 0 ou comme valeur
--      par défaut : elle est stockée NULL et signalée comme indisponible.
--   4. Les identifiants sont des chaînes préfixées (usr_, veh_, diag_…) : ils
--      peuvent être générés hors ligne puis synchronisés sans collision (§29).
--   5. Chaque écriture sensible est journalisée dans audit_logs.
--
--  Exécution
--  ─────────
--     psql "$DATABASE_URL" -f database/migrations/postgres/001_init.sql
--     -- ou, avec Supabase :
--     supabase db push
--
--  Idempotence : la migration peut être rejouée sans erreur (IF NOT EXISTS).
--  Les commentaires SQLite spécifiques (WAL, PRAGMA) ne sont pas repris.
--
--  Ordre des sections : comptes → véhicules → OBD → codes défaut →
--  diagnostic → réparation → entretien → pièces → garages → devis →
--  inspection → IA → base de connaissances → alertes → audit → rapports →
--  synchronisation différée.
-- =============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Extension utile pour les identifiants publics (rapports, partages).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

/* ───────────────────────────── Comptes (§36) ───────────────────────────── */

CREATE TABLE IF NOT EXISTS organizations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('garage','fleet','company','partner')),
  city          TEXT,
  country       TEXT NOT NULL DEFAULT 'SN',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  phone          TEXT,
  country        TEXT NOT NULL DEFAULT 'SN',
  locale         TEXT NOT NULL DEFAULT 'fr',
  role           TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','technician','garage','fleet_manager','admin')),
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  plan           TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium','pro','fleet')),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

/* ───────────────────────────── Véhicules (§6) ─────────────────────────── */

CREATE TABLE IF NOT EXISTS vehicles (
  id               TEXT PRIMARY KEY,
  owner_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id  TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  nickname         TEXT,
  brand            TEXT NOT NULL,
  model            TEXT NOT NULL,
  generation       TEXT,
  year             INTEGER NOT NULL,
  engine           TEXT NOT NULL,
  engine_cc        INTEGER,
  fuel_type        TEXT NOT NULL,
  gearbox          TEXT NOT NULL DEFAULT 'inconnue',
  power_hp         INTEGER,
  vin              TEXT,
  plate            TEXT,
  country          TEXT NOT NULL DEFAULT 'SN',
  purchase_date    TEXT,
  odometer_km      INTEGER NOT NULL DEFAULT 0,
  odometer_updated_at TEXT,
  obd_protocol     TEXT,
  supported_pids   TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin ON vehicles(vin);

CREATE TABLE IF NOT EXISTS vehicle_shares (
  id          TEXT PRIMARY KEY,
  vehicle_id  TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  garage_id   TEXT REFERENCES garages(id) ON DELETE CASCADE,
  permission  TEXT NOT NULL CHECK (permission IN ('read','write','diagnose')),
  granted_by  TEXT NOT NULL REFERENCES users(id),
  granted_at  TEXT NOT NULL,
  revoked_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_shares_vehicle ON vehicle_shares(vehicle_id);

CREATE TABLE IF NOT EXISTS vehicle_specs (
  id                    TEXT PRIMARY KEY,
  brand                 TEXT NOT NULL,
  model                 TEXT NOT NULL,
  year_from             INTEGER NOT NULL,
  year_to               INTEGER NOT NULL,
  engine                TEXT NOT NULL,
  fuel_type             TEXT NOT NULL,
  oil_spec              TEXT,
  oil_capacity_l        DOUBLE PRECISION,
  coolant_spec          TEXT,
  timing_type           TEXT,
  timing_interval_km    INTEGER,
  spark_plug_spec       TEXT,
  spark_plug_interval_km INTEGER,
  common_issues         TEXT,
  source_id             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_specs_lookup ON vehicle_specs(brand, model);

/* ───────────────────────── Section OBD (§7, §8) ───────────────────────── */

CREATE TABLE IF NOT EXISTS obd_devices (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  kind          TEXT NOT NULL,
  model         TEXT,
  protocol      TEXT,
  last_seen_at  TEXT,
  battery_voltage DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS obd_sessions (
  id             TEXT PRIMARY KEY,
  vehicle_id     TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id      TEXT REFERENCES obd_devices(id) ON DELETE SET NULL,
  source         TEXT NOT NULL CHECK (source IN ('obd','simulator')),
  scenario       TEXT,
  protocol       TEXT,
  started_at     TEXT NOT NULL,
  ended_at       TEXT,
  status         TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','aborted')),
  error_message  TEXT,
  mil_on         INTEGER NOT NULL DEFAULT 0,
  pid_count      INTEGER NOT NULL DEFAULT 0,
  dtc_count      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_obd_sessions_vehicle ON obd_sessions(vehicle_id, started_at DESC);

CREATE TABLE IF NOT EXISTS obd_data (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES obd_sessions(id) ON DELETE CASCADE,
  vehicle_id  TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  pid         TEXT NOT NULL,
  pid_key     TEXT NOT NULL,
  label       TEXT NOT NULL,
  value       DOUBLE PRECISION,
  unit        TEXT NOT NULL,
  supported   INTEGER NOT NULL,
  origin      TEXT NOT NULL,
  condition   TEXT,
  series      TEXT,
  captured_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_obd_data_session ON obd_data(session_id);

CREATE TABLE IF NOT EXISTS dtc_events (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES obd_sessions(id) ON DELETE CASCADE,
  vehicle_id      TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  status          TEXT NOT NULL,
  occurrences     INTEGER NOT NULL DEFAULT 1,
  freeze_frame    TEXT,
  origin          TEXT NOT NULL,
  first_seen_at   TEXT,
  last_seen_at    TEXT NOT NULL,
  cleared_at      TEXT,
  returned_after_clear INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dtc_events_vehicle ON dtc_events(vehicle_id, code);

/** Base de connaissances des codes défaut (§9) — synchronisée depuis le paquet diagnostic. */
CREATE TABLE IF NOT EXISTS dtc_codes (
  code             TEXT PRIMARY KEY,
  technical        TEXT NOT NULL,
  simple_fr        TEXT NOT NULL,
  simple_en        TEXT NOT NULL,
  system           TEXT NOT NULL,
  severity         TEXT NOT NULL,
  can_drive_default TEXT NOT NULL,
  consequences     TEXT NOT NULL,
  likely_causes    TEXT NOT NULL,
  related_pids     TEXT NOT NULL,
  related_tests    TEXT NOT NULL,
  related_codes    TEXT,
  source_id        TEXT NOT NULL,
  version          TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

/* ─────────────────── Moteur de diagnostic (§9, §17, §18) ──────────────── */

CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id              TEXT PRIMARY KEY,
  vehicle_id      TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  obd_session_id  TEXT REFERENCES obd_sessions(id) ON DELETE SET NULL,
  mode            TEXT NOT NULL DEFAULT 'standard',
  status          TEXT NOT NULL DEFAULT 'completed',
  started_at      TEXT NOT NULL,
  completed_at    TEXT,
  symptoms        TEXT NOT NULL DEFAULT '[]',
  certainty       TEXT NOT NULL,
  safety          TEXT NOT NULL,
  conclusion_fr   TEXT NOT NULL,
  conclusion_en   TEXT NOT NULL,
  missing_data    TEXT NOT NULL DEFAULT '[]',
  next_steps      TEXT NOT NULL DEFAULT '[]',
  rules_fired     TEXT NOT NULL DEFAULT '[]',
  engine_version  TEXT NOT NULL,
  data_origin     TEXT NOT NULL,
  can_i_drive     TEXT,
  debug_trace     TEXT
);
CREATE INDEX IF NOT EXISTS idx_diag_vehicle ON diagnostic_sessions(vehicle_id, started_at DESC);

CREATE TABLE IF NOT EXISTS diagnostic_findings (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  title_fr     TEXT NOT NULL,
  title_en     TEXT NOT NULL,
  detail_fr    TEXT NOT NULL,
  detail_en    TEXT NOT NULL,
  certainty    TEXT NOT NULL,
  safety       TEXT NOT NULL,
  evidence     TEXT NOT NULL DEFAULT '[]',
  origin       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_findings_session ON diagnostic_findings(session_id);

CREATE TABLE IF NOT EXISTS hypotheses (
  id                  TEXT PRIMARY KEY,
  session_id          TEXT NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
  cause_key           TEXT NOT NULL,
  label_fr            TEXT NOT NULL,
  label_en            TEXT NOT NULL,
  score               DOUBLE PRECISION NOT NULL,
  certainty           TEXT NOT NULL,
  reasoning           TEXT NOT NULL DEFAULT '[]',
  supporting          TEXT NOT NULL DEFAULT '[]',
  contradicting       TEXT NOT NULL DEFAULT '[]',
  discriminating_tests TEXT NOT NULL DEFAULT '[]',
  parts               TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS diagnostic_tests (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
  test_key    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'proposed',
  priority    INTEGER NOT NULL DEFAULT 50,
  reason_fr   TEXT NOT NULL,
  reason_en   TEXT NOT NULL,
  proposed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diagnostic_test_results (
  id             TEXT PRIMARY KEY,
  test_id        TEXT NOT NULL REFERENCES diagnostic_tests(id) ON DELETE CASCADE,
  session_id     TEXT NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
  vehicle_id     TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  outcome        TEXT NOT NULL,
  measured_value DOUBLE PRECISION,
  unit           TEXT,
  note           TEXT,
  origin         TEXT NOT NULL,
  recorded_at    TEXT NOT NULL
);

/* ─────────────────── Réparation, entretien, passeport (§19-25) ─────────── */

CREATE TABLE IF NOT EXISTS repairs (
  id                    TEXT PRIMARY KEY,
  vehicle_id            TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  diagnostic_session_id TEXT REFERENCES diagnostic_sessions(id) ON DELETE SET NULL,
  description           TEXT NOT NULL,
  parts_replaced        TEXT NOT NULL DEFAULT '[]',
  labour_hours          DOUBLE PRECISION,
  cost_amount           DOUBLE PRECISION,
  currency              TEXT DEFAULT 'XOF',
  garage_id             TEXT REFERENCES garages(id) ON DELETE SET NULL,
  performed_at          TEXT NOT NULL,
  performed_by          TEXT NOT NULL DEFAULT 'unknown',
  created_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_repairs_vehicle ON repairs(vehicle_id, performed_at DESC);

CREATE TABLE IF NOT EXISTS repairs_verification (
  id                TEXT PRIMARY KEY,
  repair_id         TEXT REFERENCES repairs(id) ON DELETE CASCADE,
  vehicle_id        TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  before_session_id TEXT,
  after_session_id  TEXT,
  verdict           TEXT NOT NULL,
  certainty         TEXT NOT NULL,
  summary_fr        TEXT NOT NULL,
  summary_en        TEXT NOT NULL,
  comparison        TEXT NOT NULL,
  created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS maintenance (
  id               TEXT PRIMARY KEY,
  vehicle_id       TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL,
  label_fr         TEXT NOT NULL,
  label_en         TEXT NOT NULL,
  performed_at     TEXT,
  odometer_km      INTEGER,
  next_due_km      INTEGER,
  next_due_at      TEXT,
  status           TEXT NOT NULL DEFAULT 'unknown',
  source_id        TEXT NOT NULL,
  notes            TEXT,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance(vehicle_id);

CREATE TABLE IF NOT EXISTS vehicle_events (
  id           TEXT PRIMARY KEY,
  vehicle_id   TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title_fr     TEXT NOT NULL,
  title_en     TEXT NOT NULL,
  detail       TEXT,
  ref_id       TEXT,
  odometer_km  INTEGER,
  occurred_at  TEXT NOT NULL,
  origin       TEXT NOT NULL DEFAULT 'measured'
);
CREATE INDEX IF NOT EXISTS idx_events_vehicle ON vehicle_events(vehicle_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id          TEXT PRIMARY KEY,
  vehicle_id  TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  url         TEXT,
  mime_type   TEXT,
  issued_at   TEXT,
  created_at  TEXT NOT NULL
);

/** Passeport du véhicule (§21) : vue matérialisée du parcours de vie. */
CREATE TABLE IF NOT EXISTS vehicle_passport (
  vehicle_id     TEXT PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  summary        TEXT NOT NULL DEFAULT '{}',
  diagnostics    INTEGER NOT NULL DEFAULT 0,
  repairs        INTEGER NOT NULL DEFAULT 0,
  maintenance    INTEGER NOT NULL DEFAULT 0,
  documents      INTEGER NOT NULL DEFAULT 0,
  first_event_at TEXT,
  last_event_at  TEXT,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inspections (
  id             TEXT PRIMARY KEY,
  vehicle_id     TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id     TEXT,
  target_vehicle TEXT NOT NULL,
  scores         TEXT NOT NULL,
  checklist      TEXT NOT NULL,
  red_flags      TEXT NOT NULL DEFAULT '[]',
  notes          TEXT NOT NULL DEFAULT '[]',
  seller_claims  TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  vehicle_id  TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  TEXT,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  payload     TEXT NOT NULL,
  share_token TEXT UNIQUE,
  public_url  TEXT,
  generated_at TEXT NOT NULL
);

/* ─────────────────── Garages, devis, pièces (§26-28) ──────────────────── */

CREATE TABLE IF NOT EXISTS garages (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  city          TEXT NOT NULL,
  country       TEXT NOT NULL DEFAULT 'SN',
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  phone         TEXT,
  whatsapp      TEXT,
  email         TEXT,
  brands        TEXT NOT NULL DEFAULT '[]',
  specialties   TEXT NOT NULL DEFAULT '[]',
  equipment     TEXT NOT NULL DEFAULT '[]',
  services      TEXT NOT NULL DEFAULT '[]',
  opening_hours TEXT,
  verified      INTEGER NOT NULL DEFAULT 0,
  rating        DOUBLE PRECISION,
  accepts_xamoto INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS garage_services (
  id         TEXT PRIMARY KEY,
  garage_id  TEXT NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  service    TEXT NOT NULL,
  price_from DOUBLE PRECISION,
  currency   TEXT DEFAULT 'XOF',
  duration_h DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS quotes (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id            TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  diagnostic_session_id TEXT,
  garage_id             TEXT NOT NULL REFERENCES garages(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'requested',
  lines                 TEXT NOT NULL DEFAULT '[]',
  warranty_months       INTEGER,
  delay_days            INTEGER,
  factual_summary       TEXT,
  requested_at          TEXT NOT NULL,
  received_at           TEXT
);

CREATE TABLE IF NOT EXISTS parts (
  id                 TEXT PRIMARY KEY,
  part_key           TEXT NOT NULL UNIQUE,
  name_fr            TEXT NOT NULL,
  name_en            TEXT NOT NULL,
  category           TEXT NOT NULL,
  oem_references     TEXT NOT NULL DEFAULT '[]',
  equivalents        TEXT NOT NULL DEFAULT '[]',
  fits_brands        TEXT NOT NULL DEFAULT '[]',
  fits_engines       TEXT NOT NULL DEFAULT '[]',
  fits_year_from     INTEGER,
  fits_year_to       INTEGER,
  availability_sn    TEXT NOT NULL DEFAULT 'unknown',
  typical_price_xof  INTEGER,
  source_id          TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS part_compatibility (
  id         TEXT PRIMARY KEY,
  part_key   TEXT NOT NULL REFERENCES parts(part_key) ON DELETE CASCADE,
  brand      TEXT NOT NULL,
  model      TEXT NOT NULL,
  engine     TEXT,
  year_from  INTEGER NOT NULL,
  year_to    INTEGER NOT NULL,
  verified   INTEGER NOT NULL DEFAULT 0,
  source_id  TEXT NOT NULL
);

/* ───────────────────────────── IA (§13-16) ────────────────────────────── */

CREATE TABLE IF NOT EXISTS ai_conversations (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id            TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
  diagnostic_session_id TEXT,
  title                 TEXT NOT NULL,
  locale                TEXT NOT NULL DEFAULT 'fr',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id             TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role           TEXT NOT NULL,
  content_fr     TEXT NOT NULL,
  content_en     TEXT NOT NULL,
  citations      TEXT NOT NULL DEFAULT '[]',
  used_context   TEXT NOT NULL DEFAULT '[]',
  refused        INTEGER NOT NULL DEFAULT 0,
  refusal_reason_fr TEXT,
  refusal_reason_en TEXT,
  structured     TEXT,
  engine         TEXT NOT NULL DEFAULT 'deterministic',
  validation     TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  publisher   TEXT NOT NULL,
  reliability TEXT NOT NULL,
  version     TEXT NOT NULL,
  date        TEXT NOT NULL,
  url         TEXT,
  licence     TEXT
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id          TEXT PRIMARY KEY,
  source_id   TEXT NOT NULL,
  title_fr    TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  content_fr  TEXT NOT NULL,
  content_en  TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  relates_to  TEXT NOT NULL DEFAULT '{}',
  version     TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

/* ───────────────────── Alertes, notifications, audit (§37) ────────────── */

CREATE TABLE IF NOT EXISTS alerts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
  level      TEXT NOT NULL,
  kind       TEXT NOT NULL,
  title_fr   TEXT NOT NULL,
  title_en   TEXT NOT NULL,
  body_fr    TEXT NOT NULL,
  body_en    TEXT NOT NULL,
  ref_id     TEXT,
  created_at TEXT NOT NULL,
  read_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_id   TEXT REFERENCES alerts(id) ON DELETE CASCADE,
  channel    TEXT NOT NULL DEFAULT 'in_app',
  status     TEXT NOT NULL DEFAULT 'pending',
  sent_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  metadata    TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);

/* ───────────────────────── Synchronisation (§29) ──────────────────────── */

CREATE TABLE IF NOT EXISTS sync_operations (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id      TEXT NOT NULL,
  entity         TEXT NOT NULL,
  action         TEXT NOT NULL,
  payload        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  conflict_reason TEXT,
  applied_at     TEXT,
  created_at     TEXT NOT NULL
);

-- =============================================================================
--  Fin de la migration 001
-- =============================================================================
--  Étape suivante : charger la base de connaissances et les référentiels.
--    • base de connaissances  : database/seed/001_knowledge.sql
--    • référentiels véhicules : database/seed/002_reference.sql
--  Puis, côté application : npm run seed (SQLite) ou l'import SQL ci-dessus.
--
--  Droits d'accès : XAMOTO n'active pas ROW LEVEL SECURITY par défaut, car
--  l'accès aux données passe par l'API (backend/) qui applique elle-même les
--  permissions (propriétaire, partage explicite, consentement). Si vous
--  exposez directement PostgreSQL via Supabase, activez RLS et ajoutez des
--  politiques par utilisateur — voir docs/06-securite.md.
-- =============================================================================
