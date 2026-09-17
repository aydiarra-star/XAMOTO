/**
 * XAMOTO — Export du socle de connaissances vers SQL (PostgreSQL).
 *
 * Le code TypeScript est la SEULE source de vérité de la base de connaissances :
 * sources, documents indexés par le RAG et définitions de codes défaut. Ce script
 * régénère `database/seed/001_knowledge.sql` à partir de ce code, pour qu'une
 * installation PostgreSQL ne puisse jamais dériver de ce que l'application sait
 * réellement.
 *
 * Exécution : npm run seed:sql
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { KNOWLEDGE_SOURCES } from '../diagnostic/src/knowledge/sources.js';
import { ALL_DTC_KNOWLEDGE } from '../diagnostic/src/knowledge/dtc.js';
import { RAG_DOCUMENTS } from '../ai/src/rag/corpus.js';

const VERSION = '1.0.0';
const UPDATED = '2026-01-01';

/** Échappe une valeur pour un littéral SQL. `null` reste `NULL`, jamais vide. */
function sql(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function json(value: unknown): string {
  return sql(JSON.stringify(value));
}

function header(): string {
  return `-- =============================================================================
--  XAMOTO — Base de connaissances (migration de données 001)
-- =============================================================================
--  Contenu : sources documentaires, documents indexés pour le RAG, et
--  définitions de codes défaut avec leur marqueur d'origine.
--
--  IMPORTANT (§10, §33, §47)
--    • Chaque ligne porte une source (source_id) : aucune donnée n'est
--      « flottante ». Une valeur sans source n'est pas publiée.
--    • Les codes défaut proviennent de référentiels publics (SAE J2012, EOBD,
--      OBD-II) et de retours terrain documentés. Aucun code n'est inventé :
--      un code absent est annoncé comme non documenté à l'utilisateur.
--    • Les plages et tolérances sont des PLAGES USUELLES, jamais des valeurs
--      constructeur officielles.
--
--  ⚠️ Fichier GÉNÉRÉ : ne pas modifier à la main. Il est produit par
--     \`npm run seed:sql\` à partir de diagnostic/src/knowledge et ai/src/rag.
-- =============================================================================

BEGIN;
`;
}

export function renderKnowledgeSql(): string {
  const parts: string[] = [header()];

  parts.push(`
-- Sources documentaires (attribution obligatoire)
-- ${KNOWLEDGE_SOURCES.length} ligne(s)
-- Table : knowledge_sources

INSERT INTO knowledge_sources (id, title, publisher, reliability, version, date, url, licence) VALUES`);

  parts.push(
    KNOWLEDGE_SOURCES.map(
      (source) =>
        `  (${sql(source.id)}, ${sql(source.title)}, ${sql(source.publisher)}, ${sql(source.reliability)}, ${sql(source.version)}, ${sql(source.date)}, ${sql(source.url)}, ${sql(source.licence)})`,
    ).join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n',
  );

  parts.push(`
-- Documents techniques indexés par la recherche RAG (BM25)
-- ${RAG_DOCUMENTS.length} ligne(s)
-- Table : knowledge_documents

INSERT INTO knowledge_documents (id, source_id, title_fr, title_en, content_fr, content_en, tags, relates_to, version, updated_at) VALUES`);

  parts.push(
    RAG_DOCUMENTS.map(
      (document) =>
        `  (${sql(document.id)}, ${sql(document.sourceId)}, ${sql(document.titleFr)}, ${sql(document.titleEn)}, ${sql(document.contentFr)}, ${sql(document.contentEn)}, ${json(document.tags)}, ${json(document.relatesTo ?? {})}, ${sql(document.version ?? VERSION)}, ${sql(document.updatedAt ?? UPDATED)})`,
    ).join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n',
  );

  parts.push(`
-- Définitions de codes défaut : signification, gravité, causes possibles, tests
-- ${ALL_DTC_KNOWLEDGE.length} ligne(s)
-- Table : dtc_codes

INSERT INTO dtc_codes (code, technical, simple_fr, simple_en, system, severity, can_drive_default, consequences, likely_causes, related_pids, related_tests, related_codes, source_id, version, updated_at) VALUES`);

  parts.push(
    ALL_DTC_KNOWLEDGE.map(
      (dtc) =>
        `  (${sql(dtc.code)}, ${sql(dtc.technical)}, ${sql(dtc.simpleFr)}, ${sql(dtc.simpleEn)}, ${sql(dtc.system)}, ${sql(dtc.severity)}, ${sql(dtc.canDriveDefault)}, ${json(dtc.consequences)}, ${json(dtc.likelyCauses)}, ${json(dtc.relatedPids)}, ${json(dtc.relatedTests)}, ${json(dtc.relatedCodes ?? [])}, ${sql(dtc.sourceId)}, ${sql(VERSION)}, ${sql(UPDATED)})`,
    ).join(',\n') + '\nON CONFLICT (code) DO NOTHING;\n',
  );

  parts.push('\nCOMMIT;\n');
  return parts.join('\n');
}

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../database/seed/001_knowledge.sql');

if (process.argv[1] && process.argv[1].endsWith('export-knowledge-sql.ts')) {
  const rendered = renderKnowledgeSql();
  writeFileSync(target, rendered, 'utf8');
  process.stdout.write(
    `✔ ${target}\n  sources      : ${KNOWLEDGE_SOURCES.length}\n  documents    : ${RAG_DOCUMENTS.length}\n  codes défaut : ${ALL_DTC_KNOWLEDGE.length}\n`,
  );
}
