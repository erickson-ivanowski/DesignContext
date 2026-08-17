# Research: Design Context Compiler (MVP)

Phase 0 output. Resolves the Technical Context unknowns with concrete decisions.

## R1. Runtime & language

- **Decision**: Node.js 20+ (LTS) with TypeScript 5.x, ES modules.
- **Rationale**: Best-in-class MCP support (`@modelcontextprotocol/sdk` is TypeScript-native), cross-platform, simple distribution (single npm package/CLI), strong JSON/SQLite/filesystem ecosystem. Matches source document §7.
- **Alternatives considered**: Python (weaker MCP CLI distribution), Go/Rust (higher friction for rapid MCP iteration). Rejected for MVP velocity.

## R2. MCP integration

- **Decision**: Use `@modelcontextprotocol/sdk` to implement both the `FigmaMcpAdapter` (a *client* of the Figma MCP) and our own `mcp-server` (a *server* exposed to agents over stdio).
- **Rationale**: The Figma MCP is an external tool already available in the agent environment; we consume it as a client rather than reimplementing Figma access. Our server speaks stdio (the universal MCP transport) so any MCP-compatible agent (Claude Code, Codex, etc.) can connect.
- **Alternatives considered**: Direct Figma REST API (deferred — keeps us decoupled from Figma internals, §11); SSE/HTTP transport (added later if needed).

## R3. Local storage

- **Decision**: SQLite via `drizzle-orm` + `better-sqlite3` for metadata/indexes; filesystem for content blobs addressed by SHA-256 (`~/.designcontext/cache/`).
- **Rationale**: Offline-first, zero-config, cross-platform (better-sqlite3 ships prebuilt binaries for all targets). Metadata is small and queryable; design blobs are large and best left as content-addressable files. Matches §7.
- **Alternatives considered**: `node:sqlite` built-in (still experimental, API unstable across versions); PostgreSQL (explicitly out of scope for MVP); LevelDB/LMDB (fewer querying conveniences).

## R4. Hashing strategy

- **Decision**: `contentHash` = SHA-256 of canonical JSON after normalizing and stripping volatile/transient properties (timestamps, lastModified, absolute paths). `structuralHash` = SHA-256 over a canonical projection of `{type, children[], order, componentId, hierarchy}` only.
- **Rationale**: Enables "content changed" vs. "structure changed" distinction (§18) and deterministic cache keys `fileId:nodeId:contentHash`. Canonicalization (sorted object keys, stable arrays) guarantees determinism.
- **Alternatives considered**: naive `JSON.stringify` (key order non-deterministic), MD5 (collision concerns). Rejected.

## R5. CLI framework

- **Decision**: `commander` with subcommands: `init`, `connect`, `scan`, `status`, `diff`, `inspect`, `clear-cache`, `mcp`, plus P1 `snapshot`.
- **Rationale**: Mature, minimal, standard Node CLI choice. Matches §7/§42.
- **Alternatives considered**: `yargs`, `oclif`. Rejected — heavier than needed for a single-user local CLI.

## R6. Cross-platform paths & secrets

- **Decision**: Use Node `os.homedir()` + `path`/`path.join` for all paths (config root `~/.designcontext/`). Credentials via OS secret stores — `keytar` (macOS Keychain / Windows Credential Manager / Linux Secret Service) — never in `config.json` or any versioned file.
- **Rationale**: Satisfies §8/§50. `keytar` provides one abstraction across all three OSes.
- **Alternatives considered**: env vars only (not secret-store compliant); per-OS native bindings (more code).

## R7. Validation & logging

- **Decision**: `zod` for tool/CLI argument validation and for typing Design IR at runtime boundaries; `pino` for structured JSON logs (no secrets/tokens ever logged, §46).
- **Rationale**: `zod` gives compile-time + runtime contract enforcement for MCP tool schemas; `pino` is fast and structured by default.
- **Alternatives considered**: hand-rolled validation (error-prone), `winston` (heavier).

## R8. Testing

- **Decision**: Vitest for unit/integration; contract tests drive MCP tool I/O and CLI arg parsing; a mock `FigmaAdapter` returns fixtures so tests are hermetic (no live Figma).
- **Rationale**: Vitest is the modern default for TS/ESM, fast, and cross-platform. Contract tests map directly to the `contracts/` artifacts.
- **Alternatives considered**: Jest (slower ESM setup), node:test (fewer ergonomics).

## R9. Monorepo tooling

- **Decision**: npm workspaces (no extra toolchain) with shared TypeScript project references; one `package.json` per package.
- **Rationale**: Simplest possible monorepo (§54) without adding pnpm/turborepo complexity to the MVP.
- **Alternatives considered**: pnpm workspaces + turborepo (better for large teams; unnecessary here).
