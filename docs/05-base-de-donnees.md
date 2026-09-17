# Base de données

## 1. Deux dialectes, un seul schéma logique (§32)

| Usage | Support | Fichier |
| --- | --- | --- |
| Développement, démonstration, hors ligne | SQLite embarqué | `backend/src/db/schema.ts` |
| Production, multi-utilisateurs | PostgreSQL ≥ 14 / Supabase | `database/migrations/postgres/001_init.sql` |
| Base de connaissances | PostgreSQL | `database/seed/001_knowledge.sql` (fichier **généré** : `npm run seed:sql`) |
| Référentiels véhicules / garages / pièces | PostgreSQL | `database/seed/002_reference.sql` |

Les deux schémas sont **identiques sur le plan logique** : mêmes tables, mêmes
colonnes, mêmes contraintes. Le passage de l'un à l'autre ne demande aucune
transformation de données.

## 2. Tables (37)

**Comptes et accès**
`organizations`, `users`, `sessions`, `vehicle_shares`

**Véhicules**
`vehicles`, `vehicle_specs`, `vehicle_documents`, `vehicle_events`, `vehicle_passport`

**OBD**
`obd_devices`, `obd_sessions`, `obd_data`

**Codes défaut**
`dtc_codes` (base de connaissances), `dtc_events` (lectures sur véhicule)

**Diagnostic**
`diagnostic_sessions`, `diagnostic_findings`, `hypotheses`, `diagnostic_tests`,
`diagnostic_test_results`, `repairs`, `repairs_verification`

**Entretien**
`maintenance`

**Pièces**
`parts`, `part_compatibility`

**Garages et devis**
`garages`, `garage_services`, `quotes`

**Inspection avant achat**
`inspections`

**Assistant**
`ai_conversations`, `ai_messages`

**Base de connaissances**
`knowledge_sources`, `knowledge_documents`

**Exploitation**
`alerts`, `notifications`, `audit_logs`, `reports`, `sync_operations`

## 3. Règles de modélisation

### 3.1 L'origine d'une donnée est une colonne (§33)

Toute donnée de diagnostic porte un `origin` :

`measured` · `documented` · `calculated` · `estimated` · `simulated` · `unknown`

C'est ce champ qui permet à l'interface d'afficher une étiquette d'origine et au
moteur de pondérer une cause. Une donnée sans origine n'est pas publiable.

### 3.2 Une donnée absente est NULL, jamais zéro

Un PID non supporté ne produit pas de ligne avec `value = 0` : il produit
`value = NULL` et `supported = 0`, ou simplement l'absence de ligne, et le moteur
signale la donnée comme **NON DISPONIBLE**. Zéro est une valeur ; l'absence de
valeur n'en est pas une.

### 3.3 Identifiants préfixés, générables hors ligne

`usr_…`, `veh_…`, `scan_…`, `diag_…`, `dtest_…`, `tres_…`, `rver_…`, `insp_…`,
`quote_…`, `share_…`, `evt_…`, `doc_…`, `alert_…`, `conv_…`, `msg_…`, `rpt_…`,
`sync_…`.

Une donnée créée hors ligne peut donc être synchronisée sans collision (voir §29).

### 3.4 Journalisation systématique

`audit_logs` enregistre les actions sensibles : effacement de défauts, partage d'un
diagnostic à un garage, création ou révocation d'un partage de véhicule, seconde
opinion, génération de rapport, connexion. L'utilisateur peut savoir ce qui a été
transmis, à qui et quand.

### 3.5 Conclusion stockée avec sa version

`diagnostic_sessions` conserve `engine_version`, `rules_fired`, `certainty`, `safety`
et `can_i_drive`. Une conclusion ancienne reste explicable et recalculable.

## 4. Mise en œuvre

### SQLite (développement)

```bash
npm run seed                      # base de connaissances + référentiels + mode démo
npx tsx backend/src/db/seed-cli.ts --reset   # repartir d'une base vide
npx tsx backend/src/db/seed-cli.ts --no-demo # sans véhicules de démonstration
export XAMOTO_DB_PATH=./data/xamoto.sqlite
```

### Export SQL : une seule source de vérité

Le code TypeScript est la seule source de vérité du socle de connaissances
(`diagnostic/src/knowledge`, `ai/src/rag`). Le fichier
`database/seed/001_knowledge.sql` en est **généré** :

```bash
npm run seed:sql      # régénère l'export PostgreSQL
```

Un test (`diagnostic/test/seedSql.test.ts`) échoue si le fichier livré diffère de
ce que produit le code : une installation PostgreSQL ne peut donc pas apprendre
moins que l'application, ni autre chose.

### PostgreSQL / Supabase (production)

```bash
psql "$DATABASE_URL" -f database/migrations/postgres/001_init.sql
psql "$DATABASE_URL" -f database/seed/001_knowledge.sql
psql "$DATABASE_URL" -f database/seed/002_reference.sql
```

La migration est **idempotente** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) et sa
syntaxe est vérifiée par rapport à la grammaire PostgreSQL réelle.

## 5. Contenu amorcé par défaut

| Élément | Volume |
| --- | --- |
| Sources documentaires | 8 |
| Documents indexés (RAG) | 18 |
| Définitions de codes défaut | 37 |
| Fiches techniques véhicule | 12 |
| Garages | 5 |
| Pièces et compatibilités | 23 |
| Définitions d'entretien | 14 |
| Tests guidés | documentés, avec 2 tests de repli |

Le compte de démonstration (`demo@xamoto.app`) contient 3 véhicules et 3 scans
simulés, tous étiquetés MODE SIMULATION.

## 6. Sauvegarde et reprise

- SQLite : copie du fichier `data/xamoto.sqlite` (mode WAL).
- PostgreSQL : `pg_dump` standard ; les tables de diagnostic sont append-only en
  pratique (aucune donnée historique n'est réécrite, sauf recalcul explicite d'un
  diagnostic par un nouveau test).
