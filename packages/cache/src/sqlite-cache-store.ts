import type { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import type { DesignNode } from "@designcontext/core";
import type { DesignCache, Snapshot } from "./types";

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
`;

/** Open (creating if needed) the SQLite database backing a SqliteCacheStore. */
export async function openDb(dbFilePath: string): Promise<DatabaseSync> {
  // Dynamic import: `node:sqlite` emits an ExperimentalWarning at load time.
  // Loading it lazily (only when a caller actually opens a DB) lets the CLI's
  // entrypoint respawn with --disable-warning before this ever executes.
  const { DatabaseSync } = await import("node:sqlite");
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
  const db = new DatabaseSync(dbFilePath);
  db.exec(SCHEMA);
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

  async clear(): Promise<void> {
    this.db.exec("DELETE FROM blobs; DELETE FROM nodes; DELETE FROM snapshots;");
  }

  async listNodes(): Promise<DesignNode[]> {
    const rows = this.db.prepare("SELECT data FROM nodes").all() as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as DesignNode);
  }

  async upsertNode(node: DesignNode): Promise<void> {
    this.db
      .prepare("INSERT INTO nodes (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data")
      .run(node.id, JSON.stringify(node));
  }

  async saveSnapshot(
    scopeId: string,
    kind: string,
    data: Record<string, DesignNode>,
  ): Promise<void> {
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO snapshots (scope_id, kind, data, created_at) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(scope_id) DO UPDATE SET kind = excluded.kind, data = excluded.data, created_at = excluded.created_at",
      )
      .run(scopeId, kind, JSON.stringify(data), createdAt);
  }

  async getLatestSnapshot(scopeId: string): Promise<Snapshot | null> {
    const row = this.db
      .prepare("SELECT scope_id, kind, data, created_at FROM snapshots WHERE scope_id = ?")
      .get(scopeId) as { scope_id: string; kind: string; data: string; created_at: string } | undefined;
    if (!row) return null;
    return {
      scopeId: row.scope_id,
      kind: row.kind,
      data: JSON.parse(row.data) as Record<string, DesignNode>,
      createdAt: row.created_at,
    };
  }
}
