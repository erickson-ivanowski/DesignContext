# Tasks: Design Context Compiler

**Input**: Design documents from `/specs/001-design-context-compiler/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included. Driven by the plan's testing strategy (research.md R8) and the source document's mandatory "Phase 12: Tests". Contract tests cover MCP tool + CLI schemas; integration tests cover the two key success-criteria flows (index→get_screen, second-scan reuses cache); unit tests cover hashing/IR/diff/token-estimation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monorepo (npm workspaces) per plan.md §Project Structure: `packages/<name>/src/*.ts` and `tests/{unit,integration,contract}/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and monorepo structure

- [X] T001 Create npm workspaces monorepo root: `package.json` (workspaces), `tsconfig.base.json`, `.gitignore` (exclude `database.sqlite`, `cache/`, `screenshots/`, `credentials/`), and empty `packages/{shared,core,figma-adapter,cache,design-graph,design-ir,diff-engine,context-engine,mcp-server,cli}` directories
- [X] T002 [P] Create per-package `package.json` and `tsconfig.json` stubs for each package under `packages/*/`
- [X] T003 [P] Configure root `tsconfig.json` with project references and add `eslint`/`prettier` config at repo root
- [X] T004 [P] Configure `vitest.config.ts` and create `tests/{unit,integration,contract}/` directory skeleton

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] Implement canonical JSON serializer + SHA-256 hashing (`contentHash`, `structuralHash`) in `packages/shared/src/hashing.ts`
- [X] T006 [P] Implement token estimation in `packages/shared/src/token-estimation.ts`
- [X] T007 [P] Implement cross-platform paths (`~/.designcontext` root + cache subdirs via `os.homedir()`/`path`) in `packages/shared/src/paths.ts`
- [X] T008 [P] Implement structured logger (pino, never log secrets/tokens) in `packages/shared/src/logger.ts`
- [X] T009 [P] Define domain types (`DesignNode`, Design IR types, `DiffResult`, `ContextResult`, `ContextLevel`) in `packages/core/src/types.ts`
- [X] T010 [P] Define core interfaces (`DesignSource`, `CacheStore`, `DesignGraph`, `ContextEngine`) in `packages/core/src/interfaces.ts`
- [X] T011 Define Drizzle schema (`design_nodes`, `cache_entries`, `projects`, `snapshots`) in `packages/cache/src/schema.ts`
- [X] T012 Implement SQLite connection + migration bootstrap in `packages/cache/src/db.ts`
- [X] T013 Implement `CacheStore` (SQLite metadata + content-addressable filesystem blobs keyed `fileId:nodeId:contentHash`) in `packages/cache/src/cache-store.ts`
- [X] T014 Implement project config load/save (`project/.designcontext/project.json`) in `packages/cache/src/project-config.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Index a design and implement a screen (Priority: P1) 🎯 MVP

**Goal**: Connect a Figma design, index a user-selected scope via metadata-first discovery, and let an agent retrieve a screen summary through the MCP server.

**Independent Test**: With a mock `FigmaAdapter` returning fixture metadata/context, run `designcontext scan --node <id>` and confirm `design_get_screen` returns a summary (sections, components, tokens, code mappings) — not the raw design dump — and the agent can act on it. (spec.md US1 acceptance scenarios)

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T015 [P] [US1] Contract test for `design_get_screen`/`design_get_structure` input/output schemas in `tests/contract/mcp-tools.test.ts`
- [X] T016 [P] [US1] Integration test for index → `get_screen` round trip using a mock adapter in `tests/integration/us1.test.ts`

### Implementation for User Story 1

- [X] T017 [US1] Implement `FigmaAdapter` interface + `FigmaMcpAdapter` (metadata-first `getMetadata`/`getDesignContext` client of the Figma MCP) in `packages/figma-adapter/src/figma-adapter.ts`
- [X] T018 [US1] Implement raw Figma → Design IR normalization in `packages/design-ir/src/normalize.ts`
- [X] T019 [US1] Implement context-level projection (0 summary → 4 raw) in `packages/design-ir/src/context-levels.ts`
- [X] T020 [US1] Implement `DesignGraph` (node store, `getNode`, `getChildren`, `upsert`) in `packages/design-graph/src/design-graph.ts`
- [X] T021 [US1] Implement full-scan indexer orchestration (metadata → IR → graph → cache) in `packages/core/src/indexer.ts`
- [X] T022 [US1] Implement `ContextEngine.getScreen` (summary assembly + token estimation) in `packages/context-engine/src/context-engine.ts`
- [X] T023 [US1] Implement Context Optimizer (minimum-sufficient context, budget, references) in `packages/context-engine/src/optimizer.ts`
- [X] T024 [US1] Implement MCP server bootstrap + `design_get_project`, `design_get_screen`, `design_get_structure` tools in `packages/mcp-server/src/server.ts`
- [X] T025 [US1] Implement Commander CLI bootstrap with `init`, `connect`, `scan`, `mcp` commands in `packages/cli/src/cli.ts`
- [X] T026 [US1] Implement `connect` command (store credentials in OS keychain via `keytar`, never in versioned files) in `packages/cli/src/connect.ts`
- [X] T027 [US1] Implement `scan` command (full scan, `--node` scope, report discovered/cached counts) + generate agent MCP config (`mcpServers.design-context`) in `packages/cli/src/scan.ts` and `packages/cli/src/agent-config.ts`

**Checkpoint**: User Story 1 fully functional — connect → scan → `design_get_screen` works end to end

---

## Phase 4: User Story 2 - Detect a small design change without reprocessing everything (Priority: P1)

**Goal**: Re-indexing after a one-node change reports exactly the changed node and leaves unchanged nodes served from cache.

**Independent Test**: Index a screen, mutate one button in the mock adapter, re-scan, and confirm only one node is reported changed and unchanged nodes are not re-fetched. (spec.md US2 acceptance scenarios)

### Tests for User Story 2

- [X] T028 [P] [US2] Integration test for incremental scan detecting a single changed node in `tests/integration/us2.test.ts`

### Implementation for User Story 2

- [X] T029 [US2] Implement incremental scan (compare hashes, re-index only changed nodes) in `packages/core/src/incremental-scan.ts`
- [X] T030 [US2] Implement per-node cache invalidation by `contentHash`/`structuralHash` (do not invalidate whole project) in `packages/cache/src/invalidation.ts`
- [X] T031 [US2] Extend `scan` command with incremental mode + discovered/cached/changed reporting in `packages/cli/src/scan.ts`
- [X] T032 [US2] Implement `status` command (screens/components/tokens indexed, cache size, cached/changed node counts) in `packages/cli/src/status.ts`

**Checkpoint**: US1 + US2 both work; incremental change detection verified

---

## Phase 5: User Story 3 - Answer a focused question with only the relevant context (Priority: P2)

**Goal**: An agent can request a single component (or its tokens) by name and receive only that component's context.

**Independent Test**: Query `design_get_component("Payment")` / `design_get_tokens({scope})` and confirm the response contains only that component's structure/properties/tokens/code mapping. (spec.md US3)

### Tests for User Story 3

- [X] T033 [P] [US3] Contract test for `design_get_component`/`design_get_tokens` schemas in `tests/contract/mcp-tools.test.ts`

### Implementation for User Story 3

- [X] T034 [US3] Implement name-based node search in `packages/design-graph/src/search.ts`
- [X] T035 [US3] Implement `ContextEngine.getComponent` (structure + properties + tokens + child components + code mapping) in `packages/context-engine/src/component-context.ts`
- [X] T036 [US3] Implement scoped token extraction (`getTokens`) in `packages/context-engine/src/tokens.ts`
- [X] T037 [US3] Implement `design_get_component`, `design_get_tokens`, `design_find`, `design_inspect` tools in `packages/mcp-server/src/tools.ts`

**Checkpoint**: Focused component/token queries return only the requested context

---

## Phase 6: User Story 4 - Report what changed since the last version (Priority: P2)

**Goal**: An agent asks "what changed in Checkout?" and receives only the diff (changed/added/removed with before/after values).

**Independent Test**: After a property change, `design_get_changes("Checkout")` returns only the delta, enabling drift correction without the full screen. (spec.md US4)

### Tests for User Story 4

- [X] T038 [P] [US4] Contract test for `design_get_changes` schema in `tests/contract/mcp-tools.test.ts`

### Implementation for User Story 4

- [X] T039 [US4] Implement `DiffResult` computation (changed with before/after, added, removed, unchanged) in `packages/diff-engine/src/diff.ts`
- [X] T040 [US4] Implement `ContextEngine.getChanges` (readable diff assembly) in `packages/context-engine/src/changes.ts`
- [X] T041 [US4] Implement `design_get_changes` tool in `packages/mcp-server/src/tools.ts`
- [X] T042 [US4] Implement `diff` CLI command in `packages/cli/src/diff.ts`

**Checkpoint**: Change/diff queries return only the delta

---

## Phase 7: User Story 5 - Reuse previously indexed context across sessions (Priority: P3)

**Goal**: Context persists across restarts; a second scan of an unchanged design reuses cached data and makes far fewer remote calls.

**Independent Test**: Index, restart, re-index, and confirm the vast majority of data is reused and remote fetch count drops by an order of magnitude. (spec.md US5)

### Tests for User Story 5

- [X] T043 [P] [US5] Integration test for second-scan cache reuse (fewer Figma calls) in `tests/integration/us5.test.ts`

### Implementation for User Story 5

- [X] T044 [US5] Verify/enable cache persistence across sessions (reload index on startup) in `packages/cache/src/cache-store.ts`
- [X] T045 [US5] Implement local metrics (cache hits/misses, Figma calls, token reduction) in `packages/core/src/metrics.ts`
- [X] T046 [US5] Implement `inspect` and `clear-cache` CLI commands in `packages/cli/src/inspect.ts` and `packages/cli/src/clear-cache.ts`

**Checkpoint**: Persistence + metrics validate token reduction (the product's core metric)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening and validation across all stories

- [X] T047 [P] Add unit tests for hashing, token estimation, IR normalization, and diff in `tests/unit/`
- [X] T048 [P] Walk through `quickstart.md` end-to-end and fix any gaps
- [X] T049 [P] Add README + package docs
- [X] T050 Security review: confirm no secrets/tokens in logs or versioned config; `.gitignore` covers `database.sqlite`, `cache/`, `screenshots/`, `credentials/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–7)**: All depend on Foundational completion; US2/US4 build on US1's index/cache pipeline
- **Polish (Phase 8)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: Start after Foundational — no other story deps (index pipeline + get_screen)
- **US2 (P1)**: Depends on US1 (extends indexer/cache with incremental + invalidation)
- **US3 (P2)**: Depends on US1 (graph + context engine exist)
- **US4 (P2)**: Depends on US1 + US2 (diff needs hashes + cached versions)
- **US5 (P3)**: Depends on US1 + US2 (persistence/metrics over the cache)

### Within Each User Story

- Tests (contract/integration) written and FAIL before implementation
- Foundational types/interfaces before implementations
- Adapter/IR/graph before indexer; indexer before context engine; context engine before MCP tools
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup [P] tasks run in parallel
- All Foundational [P] tasks (T005–T010) run in parallel; cache tasks (T011–T014) sequential within cache
- Within US1: T015/T016 (tests), T017/T018/T019/T020 (independent packages) can run in parallel; T021–T024 are sequential downstream
- US3 and US4 can proceed in parallel once US1/US2 land (different files)
- All Polish [P] tasks run in parallel

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Contract test for design_get_screen/design_get_structure in tests/contract/mcp-tools.test.ts"
Task: "Integration test for index → get_screen in tests/integration/us1.test.ts"

# Independent package implementations together:
Task: "Implement FigmaAdapter + FigmaMcpAdapter in packages/figma-adapter/src/figma-adapter.ts"
Task: "Implement IR normalization in packages/design-ir/src/normalize.ts"
Task: "Implement context levels in packages/design-ir/src/context-levels.ts"
Task: "Implement DesignGraph in packages/design-graph/src/design-graph.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: connect → scan → `design_get_screen` end-to-end with the mock adapter
5. Deploy/demo if ready (this satisfies spec.md success criteria SC-001/SC-002 and MVP Case 1)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → test independently → MVP (index + get_screen)
3. US2 → test independently → incremental change detection (spec Case 2/SC-003/SC-004)
4. US3 → focused component/token queries (spec Case 3/SC-005)
5. US4 → diff queries (spec Case 4/SC-006)
6. US5 → persistence + metrics (SC-001 validation, spec Case 5)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (index pipeline + get_screen)
   - After US1/US2 land, Developer B: US3 (component/token queries), Developer C: US4 (diff)
3. US5 and Polish run last

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
- P1 scope only in this plan (Component Registry, Token Registry, screenshots, semantic diff, search, snapshots, visual diff are deferred)
