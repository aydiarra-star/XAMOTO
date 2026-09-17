/**
 * XAMOTO — Cohérence du socle de connaissances avec l'export SQL (§5, §33).
 *
 * `database/seed/001_knowledge.sql` est un fichier GÉNÉRÉ à partir du code
 * (`npm run seed:sql`). Ce test échoue si les deux divergent : une installation
 * PostgreSQL ne doit jamais apprendre moins que ce que l'application sait — ni
 * autre chose.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_DTC_KNOWLEDGE, KNOWLEDGE_SOURCES } from '@xamoto/diagnostic';
import { RAG_DOCUMENTS } from '@xamoto/ai';
import { renderKnowledgeSql } from '../../scripts/export-knowledge-sql.js';
import { PARTS } from '../../backend/src/db/seed-data.js';

const target = resolve(__dirname, '../../database/seed/001_knowledge.sql');
const reference = resolve(__dirname, '../../database/seed/002_reference.sql');

describe('export SQL de la base de connaissances', () => {
  it('le fichier livré est exactement celui que produit le code', () => {
    const expected = renderKnowledgeSql();
    const actual = readFileSync(target, 'utf8');
    expect(actual).toBe(expected);
  });

  it('les trois socles sont exportés', () => {
    const sql = renderKnowledgeSql();
    expect(sql).toContain(`-- ${KNOWLEDGE_SOURCES.length} ligne(s)`);
    expect(sql).toContain(`-- ${RAG_DOCUMENTS.length} ligne(s)`);
    expect(sql).toContain(`-- ${ALL_DTC_KNOWLEDGE.length} ligne(s)`);
    // Aucune ligne d'insertion vide : une valeur manquante devient NULL, jamais ''.
    expect(sql.split('\n').filter((line) => line.includes("''")).length).toBe(0);
  });

  it('le graphe de pièces livré couvre toutes les pièces citées par la base', () => {
    // Les pièces créées par le code étaient absentes de l'export PostgreSQL :
    // une pièce proposée par le diagnostic doit exister dans le référentiel.
    const sql = readFileSync(reference, 'utf8');
    const missing = PARTS.map((part) => part.partKey).filter((key) => !sql.includes(`'${key}'`));
    expect(missing, `pièces absentes de 002_reference.sql : ${missing.join(', ')}`).toHaveLength(0);
  });

  it('chaque document exporté porte sa source', () => {
    const sql = renderKnowledgeSql();
    for (const source of KNOWLEDGE_SOURCES) {
      expect(sql, `source absente de l’export : ${source.id}`).toContain(`'${source.id}'`);
    }
    for (const document of RAG_DOCUMENTS) {
      expect(sql, `document absent de l’export : ${document.id}`).toContain(`'${document.id}'`);
      expect(sql, `document sans source : ${document.id}`).toContain(`'${document.sourceId}'`);
    }
  });
});
