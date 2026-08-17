// Stub for the `node:sqlite` builtin used only by the test environment, where
// the SQLite-backed store is not exercised (integration tests use the
// in-memory cache). Keeps Vite from failing to resolve the newer builtin.
export class DatabaseSync {
  constructor(_filename: string) {
    throw new Error("node:sqlite is stubbed in tests; use InMemoryCacheStore");
  }
}
