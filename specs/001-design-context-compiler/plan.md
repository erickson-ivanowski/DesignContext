# Implementation Plan: Design Context Compiler

**Branch**: `001-design-context-compiler` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-design-context-compiler/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build the MVP of **DesignContext**, a local-first, cross-platform context compiler that sits between AI coding agents and the Figma MCP. It indexes a user-selected scope of a Figma design, persists a normalized semantic representation locally, and answers agent queries (`get_screen`, `get_structure`, `get_component`, `get_changes`) with the *minimum sufficient context* instead of the raw design dump. Incremental indexing (content + structural hashing) and a diff engine enable small changes to be detected without reprocessing the whole design. The primary metric is token reduction (≥70% vs. raw design context).

**MVP (P0) scope**: CLI, Figma MCP adapter, metadata-first discovery, local SQLite + filesystem cache, content/structural hashing, Design Graph, Design IR, incremental indexing, basic diff, MCP server (`get_screen`, `get_structure`, `get_component`, `get_changes`), token estimation, and agent (Claude) MCP configuration. Component Registry, Token Registry, screenshots, semantic diff, search, and snapshots are **P1 — out of scope for this plan**.

## Technical Context

**Language/Version**: Node.js 20+ (LTS) + TypeScript 5.x (ESM)

**Primary Dependencies**: `@modelcontextprotocol/sdk` (MCP server/client), `drizzle-orm` + `better-sqlite3` (local SQLite), `commander` (CLI), `zod` (schema validation for tool contracts), `pino` (structured logging)

**Storage**: SQLite for metadata/indexes + filesystem for content blobs (content-addressable by SHA-256 hash) under `~/.designcontext/`

**Testing**: Vitest (unit + integration); MCP tool contract tests; a mock `FigmaAdapter` for hermetic tests

**Target Platform**: macOS (Apple Silicon + Intel), Windows x64, Linux x64 — fully offline except Figma communication

**Project Type**: Multi-package CLI + MCP server (npm workspaces monorepo)

**Performance Goals**: cache hit <100ms; local context lookup <200ms; semantic search <500ms (P1); incremental scan proportional to changed nodes

**Constraints**: No bash/zsh/Unix-path/tmp assumptions (use Node `os`/`path` APIs); no remote telemetry by default; credentials via OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service), never in versioned config; `~/.designcontext/` treated as sensitive

**Scale/Scope**: single local user, one active project at a time; hundreds-to-thousands of design nodes per project; SQLite is the only DB (no PostgreSQL)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is still the placeholder template — no ratified principles or governance rules exist yet. Therefore there are **no explicit gates** to enforce at this stage.

Standing defaults applied from the source-of-truth document (Design Context Compiler §58, §60, §67):

- **Correctness > clean architecture > performance** — prioritize a working MVP over speculative abstractions.
- **Minimum sufficient context** — never "more context = better"; the agent can always request more.
- **No speculative P2 abstractions** — do not build Component/Token registries, snapshots, or visual diff now.
- **Incremental delivery** — each phase produces runnable software.

No violations; no complexity justifications required.

## Project Structure

### Documentation (this feature)

```text
specs/001-design-context-compiler/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (MCP tools, CLI, core interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created here)
```

### Source Code (repository root)

Monorepo using npm workspaces, mirroring the architecture boundaries from the source document (§54). Packages for P0 are built now; P1 packages are stubbed only where a shared type contract is needed.

```text
packages/
├── shared/            # hashing (SHA-256 canonical JSON), token estimation, cross-platform paths, logging, config load
├── core/              # domain types (DesignNode, IR, DiffResult) + core interfaces (DesignSource, CacheStore, DesignGraph, ContextEngine)
├── figma-adapter/     # FigmaAdapter interface + FigmaMcpAdapter (client of the Figma MCP)
├── cache/             # SQLite (Drizzle) + filesystem content-addressable store; CacheStore impl
├── design-graph/      # DesignGraph impl: node store + tree/graph queries + basic search (name-based)
├── design-ir/         # Figma raw -> Design IR normalization/transformation
├── diff-engine/       # content/structural hash diff; basic changed/added/removed output
├── context-engine/    # Context Optimizer: progressive levels, budget, token estimation, minimum-sufficient assembly
├── mcp-server/        # MCP server exposing design_get_* / design_find / design_inspect tools
└── cli/               # Commander CLI: init, connect, scan, status, diff, inspect, clear-cache, mcp

tests/
├── unit/              # hashing, token estimation, IR normalization, diff
├── integration/       # cache <-> graph <-> context-engine round-trips (SQLite temp db)
└── contract/          # MCP tool input/output contracts, CLI arg contracts
```

**Structure Decision**: npm workspaces monorepo with one package per architecture boundary. This keeps the `figma-adapter`, `cache`, `design-graph`, `design-ir`, `diff-engine`, `context-engine`, `mcp-server`, and `cli` concerns decoupled (as required by §54 "Não criar um monólito") while `shared` and `core` hold only types/contracts and cross-cutting utilities. P1 packages (`component-registry`, `token-registry`) are intentionally deferred.

## Complexity Tracking

> No Constitution violations; no entries required.
