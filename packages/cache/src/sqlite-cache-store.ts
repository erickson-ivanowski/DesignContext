import type { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import type { DesignNode } from "@designcontext/core";
import { graphKey } from "@designcontext/core";
import type { DesignCache, SavingsTotals, Snapshot } from "./types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS blobs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshots (
  scope_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS savings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  tokens_without INTEGER NOT NULL DEFAULT 0,
  tokens_with INTEGER NOT NULL DEFAULT 0,
  calls INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  cache_misses INTEGER NOT NULL DEFAULT 0
);
`;

const INDEX_SCHEMA = `
CREATE INDEX IF NOT EXISTS idx_nodes_file_id ON nodes(file_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_file_id ON snapshots(file_id);
`;

/**
 * Adds the `file_id` column to `table` if it isn't already present. Needed
 * because `CREATE TABLE IF NOT EXISTS` is a silent no-op against a
 * pre-existing (pre-multi-file) table, so a table created before `file_id`
 * existed would otherwise never gain the column, and the subsequent
 * `CREATE INDEX ... (file_id)` would fail with "no such column: file_id".
 */
function ensureFileIdColumn(db: DatabaseSync, table: "nodes" | "snapshots"): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const hasFileId = columns.some((col) => col.name === "file_id");
  if (!hasFileId) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN file_id TEXT`);
  }
}

/**
 * One-time backfill for databases created before the `file_id` column (and the
 * composite `graphKey(fileId, nodeId)` primary key format) existed: every
 * pre-existing row belonged to the single file a project could track back then,
 * so it's safe to stamp them all with the "default" alias's file id. The
 * primary key columns (`nodes.id`, `snapshots.scope_id`) must also be rewritten
 * to that same composite form — `upsertNode`/`saveSnapshot` always write and
 * upsert against the composite key, so leaving legacy rows keyed by their bare
 * id would make them permanently orphaned duplicates the next time that
 * node/scope is re-indexed. Guarded by a `meta` row so it only ever runs once.
 */
function backfillLegacyFileId(db: DatabaseSync): void {
  const marker = db
    .prepare("SELECT value FROM meta WHERE key = 'file_id_backfilled'")
    .get() as { value: string } | undefined;
  if (marker) return;

  db.exec("BEGIN");
  try {
    // Legacy `nodes.data`/`snapshots.data` are JSON blobs whose own `DesignNode.fileId`
    // field predates this migration too — rewriting the SQL columns/primary keys alone
    // would leave that embedded fileId stale (e.g. still "" or whatever the legacy
    // single-file project's old id was), producing a wrong composite graphKey the next
    // time a caller reads the row back and re-keys it. Patch the JSON in application
    // code rather than SQL, then rewrite the row (SQL JSON functions aren't available
    // in node:sqlite).
    const legacyNodes = db
      .prepare("SELECT id, data FROM nodes WHERE file_id IS NULL")
      .all() as Array<{ id: string; data: string }>;
    for (const row of legacyNodes) {
      const node = JSON.parse(row.data) as Record<string, unknown>;
      node.fileId = "default";
      db.prepare("UPDATE nodes SET id = ?, file_id = 'default', data = ? WHERE id = ?").run(
        `default:${row.id}`,
        JSON.stringify(node),
        row.id,
      );
    }

    const legacySnapshots = db
      .prepare("SELECT scope_id, data FROM snapshots WHERE file_id IS NULL")
      .all() as Array<{ scope_id: string; data: string }>;
    for (const row of legacySnapshots) {
      const data = JSON.parse(row.data) as Record<string, Record<string, unknown>>;
      for (const node of Object.values(data)) {
        if (node && typeof node === "object") node.fileId = "default";
      }
      db.prepare(
        "UPDATE snapshots SET scope_id = ?, file_id = 'default', data = ? WHERE scope_id = ?",
      ).run(`default:${row.scope_id}`, JSON.stringify(data), row.scope_id);
    }

    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('file_id_backfilled', 'true') " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run();
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** Open (creating if needed) the SQLite database backing a SqliteCacheStore. */
export async function openDb(dbFilePath: string): Promise<DatabaseSync> {
  // Dynamic import: `node:sqlite` emits an ExperimentalWarning at load time.
  // Loading it lazily (only when a caller actually opens a DB) lets the CLI's
  // entrypoint respawn with --disable-warning before this ever executes.
  const { DatabaseSync } = await import("node:sqlite");
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
  const db = new DatabaseSync(dbFilePath);
  db.exec(SCHEMA);
  ensureFileIdColumn(db, "nodes");
  ensureFileIdColumn(db, "snapshots");
  db.exec(INDEX_SCHEMA);
  backfillLegacyFileId(db);
  return db;
}

/** SQLite-backed DesignCache. Persists across CLI invocations (~/.designcontext/database.sqlite). */
export class SqliteCacheStore implements DesignCache {
  constructor(private readonly db: DatabaseSync) {}

  async get(key: string): Promise<unknown | null> {
    const row = this.db
      .prepare("SELECT value FROM blobs WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : null;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.db
      .prepare("INSERT INTO blobs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, JSON.stringify(value));
  }

  async invalidate(key: string): Promise<void> {
    this.db.prepare("DELETE FROM blobs WHERE key = ?").run(key);
  }

  async clear(fileId?: string): Promise<void> {
    if (fileId) {
      this.db.prepare("DELETE FROM nodes WHERE file_id = ?").run(fileId);
      this.db.prepare("DELETE FROM snapshots WHERE file_id = ?").run(fileId);
      return;
    }
    this.db.exec("DELETE FROM blobs; DELETE FROM nodes; DELETE FROM snapshots;");
  }

  async listNodes(fileId?: string): Promise<DesignNode[]> {
    const rows = (
      fileId
        ? this.db.prepare("SELECT data FROM nodes WHERE file_id = ?").all(fileId)
        : this.db.prepare("SELECT data FROM nodes").all()
    ) as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as DesignNode);
  }

  async upsertNode(node: DesignNode): Promise<void> {
    const compositeId = graphKey(node.fileId, node.id);
    this.db
      .prepare(
        "INSERT INTO nodes (id, file_id, data) VALUES (?, ?, ?) " +
          "ON CONFLICT(id) DO UPDATE SET file_id = excluded.file_id, data = excluded.data",
      )
      .run(compositeId, node.fileId, JSON.stringify(node));
  }

  async saveSnapshot(
    scopeKey: string,
    kind: string,
    data: Record<string, DesignNode>,
  ): Promise<void> {
    const createdAt = new Date().toISOString();
    const fileId = scopeKey.includes(":") ? scopeKey.split(":")[0] : null;
    this.db
      .prepare(
        "INSERT INTO snapshots (scope_id, file_id, kind, data, created_at) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT(scope_id) DO UPDATE SET file_id = excluded.file_id, kind = excluded.kind, data = excluded.data, created_at = excluded.created_at",
      )
      .run(scopeKey, fileId, kind, JSON.stringify(data), createdAt);
  }

  async getLatestSnapshot(scopeKey: string): Promise<Snapshot | null> {
    const row = this.db
      .prepare("SELECT scope_id, kind, data, created_at FROM snapshots WHERE scope_id = ?")
      .get(scopeKey) as { scope_id: string; kind: string; data: string; created_at: string } | undefined;
    if (!row) return null;
    return {
      scopeId: row.scope_id,
      kind: row.kind,
      data: JSON.parse(row.data) as Record<string, DesignNode>,
      createdAt: row.created_at,
    };
  }

  async recordSavings(fullTokens: number, optimizedTokens: number): Promise<void> {
    this.db
      .prepare(
        "INSERT INTO savings (id, tokens_without, tokens_with, calls) VALUES (1, ?, ?, 1) " +
          "ON CONFLICT(id) DO UPDATE SET tokens_without = tokens_without + excluded.tokens_without, " +
          "tokens_with = tokens_with + excluded.tokens_with, calls = calls + 1",
      )
      .run(fullTokens, optimizedTokens);
  }

  async recordScanActivity(hit: boolean): Promise<void> {
    const column = hit ? "cache_hits" : "cache_misses";
    this.db
      .prepare(
        `INSERT INTO savings (id, ${column}) VALUES (1, 1) ` +
          `ON CONFLICT(id) DO UPDATE SET ${column} = ${column} + 1`,
      )
      .run();
  }

  async getSavings(): Promise<SavingsTotals> {
    const row = this.db
      .prepare("SELECT tokens_without, tokens_with, calls, cache_hits, cache_misses FROM savings WHERE id = 1")
      .get() as
      | { tokens_without: number; tokens_with: number; calls: number; cache_hits: number; cache_misses: number }
      | undefined;
    if (!row) {
      return { tokensWithoutContext: 0, tokensWithContext: 0, calls: 0, cacheHits: 0, cacheMisses: 0 };
    }
    return {
      tokensWithoutContext: row.tokens_without,
      tokensWithContext: row.tokens_with,
      calls: row.calls,
      cacheHits: row.cache_hits,
      cacheMisses: row.cache_misses,
    };
  }
}
