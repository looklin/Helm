import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { TagDefinition, TagSnapshot, TagValue } from '@helm/shared';
import { getDefaultValueByType, parseTagValue, stringifyTagValue } from '@helm/shared';

interface CreateDatabaseOptions {
  filePath: string;
}

interface AuditLogInput {
  tagName: string;
  operator: string;
  source: string;
  previousValue: TagValue | null;
  nextValue: TagValue | null;
  result: 'success' | 'failed';
}

export function createDatabase(options: CreateDatabaseOptions) {
  mkdirSync(dirname(options.filePath), { recursive: true });

  const db = new Database(options.filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      name TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      data_type TEXT NOT NULL,
      writable INTEGER NOT NULL,
      description TEXT NOT NULL,
      unit TEXT,
      string_length INTEGER
    );

    CREATE TABLE IF NOT EXISTS tag_values_current (
      tag_name TEXT PRIMARY KEY REFERENCES tags(name) ON DELETE CASCADE,
      value_text TEXT,
      quality TEXT NOT NULL DEFAULT 'unknown',
      source TEXT NOT NULL DEFAULT 'db',
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_name TEXT NOT NULL,
      operator TEXT NOT NULL,
      source TEXT NOT NULL,
      previous_value TEXT,
      next_value TEXT,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const seedTagStatement = db.prepare(`
    INSERT INTO tags (name, address, data_type, writable, description, unit, string_length)
    VALUES (@name, @address, @dataType, @writable, @description, @unit, @stringLength)
    ON CONFLICT(name) DO UPDATE SET
      address = excluded.address,
      data_type = excluded.data_type,
      writable = excluded.writable,
      description = excluded.description,
      unit = excluded.unit,
      string_length = excluded.string_length;
  `);

  const seedValueStatement = db.prepare(`
    INSERT INTO tag_values_current (tag_name, value_text, quality, source, updated_at)
    VALUES (@tagName, @valueText, @quality, @source, @updatedAt)
    ON CONFLICT(tag_name) DO NOTHING;
  `);

  const listStatement = db.prepare(`
    SELECT
      t.name,
      t.address,
      t.data_type AS dataType,
      t.writable,
      t.description,
      t.unit,
      t.string_length AS stringLength,
      v.value_text AS valueText,
      v.quality,
      v.source,
      v.updated_at AS updatedAt
    FROM tags t
    LEFT JOIN tag_values_current v ON v.tag_name = t.name
    ORDER BY t.name ASC;
  `);

  const upsertStatement = db.prepare(`
    INSERT INTO tag_values_current (tag_name, value_text, quality, source, updated_at)
    VALUES (@tagName, @valueText, @quality, @source, @updatedAt)
    ON CONFLICT(tag_name) DO UPDATE SET
      value_text = excluded.value_text,
      quality = excluded.quality,
      source = excluded.source,
      updated_at = excluded.updated_at;
  `);

  const auditStatement = db.prepare(`
    INSERT INTO audit_logs (tag_name, operator, source, previous_value, next_value, result, created_at)
    VALUES (@tagName, @operator, @source, @previousValue, @nextValue, @result, @createdAt);
  `);

  return {
    seedTags(definitions: TagDefinition[]) {
      const now = new Date().toISOString();

      const transaction = db.transaction((items: TagDefinition[]) => {
        for (const item of items) {
          seedTagStatement.run({
            name: item.name,
            address: item.address,
            dataType: item.dataType,
            writable: item.writable ? 1 : 0,
            description: item.description,
            unit: item.unit ?? null,
            stringLength: item.stringLength ?? null,
          });

          seedValueStatement.run({
            tagName: item.name,
            valueText: stringifyTagValue(getDefaultValueByType(item.dataType)),
            quality: 'unknown',
            source: 'db',
            updatedAt: now,
          });
        }
      });

      transaction(definitions);
    },

    listTags(): TagSnapshot[] {
      const rows = listStatement.all() as Array<{
        name: string;
        address: string;
        dataType: TagDefinition['dataType'];
        writable: number;
        description: string;
        unit?: string | null;
        stringLength?: number | null;
        valueText?: string | null;
        quality?: TagSnapshot['quality'] | null;
        source?: TagSnapshot['source'] | null;
        updatedAt?: string | null;
      }>;

      return rows.map((row) => ({
        name: row.name,
        address: row.address,
        dataType: row.dataType,
        writable: row.writable === 1,
        description: row.description,
        unit: row.unit ?? undefined,
        stringLength: row.stringLength ?? undefined,
        value: parseTagValue(row.dataType, row.valueText ?? null),
        quality: row.quality ?? 'unknown',
        source: row.source ?? 'db',
        updatedAt: row.updatedAt ?? null,
      }));
    },

    upsertTagSnapshot(tag: TagSnapshot) {
      upsertStatement.run({
        tagName: tag.name,
        valueText: stringifyTagValue(tag.value),
        quality: tag.quality,
        source: tag.source,
        updatedAt: tag.updatedAt ?? new Date().toISOString(),
      });
    },

    recordAudit(input: AuditLogInput) {
      auditStatement.run({
        tagName: input.tagName,
        operator: input.operator,
        source: input.source,
        previousValue: stringifyTagValue(input.previousValue),
        nextValue: stringifyTagValue(input.nextValue),
        result: input.result,
        createdAt: new Date().toISOString(),
      });
    },

    getSummary() {
      const tagCountRow = db.prepare('SELECT COUNT(*) AS count FROM tags').get() as { count: number };
      const auditCountRow = db.prepare('SELECT COUNT(*) AS count FROM audit_logs').get() as { count: number };

      return {
        path: options.filePath,
        tagCount: tagCountRow.count,
        auditCount: auditCountRow.count,
      };
    },

    close() {
      db.close();
    },
  };
}
