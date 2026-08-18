<p align="center">
  <h1 align="center">DesignContext</h1>
  <p align="center">
    A local-first context compiler that sits between AI coding agents and the Figma MCP.<br/>
    It indexes a Figma design and answers agent queries with the <em>minimum sufficient context</em> — never the raw design dump.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/designcontext"><img src="https://img.shields.io/npm/v/designcontext" alt="npm version" /></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D22.5-brightgreen" alt="Node.js >= 22.5" /></a>
  <a href="#"><img src="https://img.shields.io/badge/typescript-5.x-blue" alt="TypeScript" /></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-lightgrey" alt="License MIT" /></a>
  <a href="#"><img src="https://img.shields.io/badge/status-MVP-orange" alt="Status MVP" /></a>
</p>

<p align="center">
  <a href="https://erickson-ivanowski.github.io/DesignContext/">📖 Full documentation</a>
</p>

---

## Why

Dumping an entire Figma file into an AI agent wastes tokens and produces worse results.
DesignContext indexes a user-selected scope, persists a normalized semantic representation
locally, and serves agents exactly what they need.

Primary metric: **≥ 70% token reduction** vs. raw design context.

> **Design source:** only **Figma** is supported today (via the Figma MCP). Support for other
> design tools is not implemented yet.

## Features

- **Metadata-first indexing** — discover the design structure cheaply, fetch full context on demand.
- **Minimum sufficient context** — progressive levels (0 summary → 4 raw) with a token budget.
- **Incremental scan** — content + structural hashing; re-index only what changed.
- **Diff** — `design_get_changes` reports exactly what changed since the previous version.
- **Local & private** — SQLite + content-addressable cache under `~/.designcontext/`; no telemetry.
- **MCP server** — `design_get_screen`, `design_get_structure`, `design_get_component`,
  `design_get_tokens`, `design_get_changes`, `design_find`, `design_inspect`.

## How it works

```
Figma MCP ──(stdio)──▶ FigmaMcpAdapter ──▶ Design IR ──▶ Design Graph ──▶ SQLite cache
                                                              │
                                                              ▼
AI agent ◀──(MCP over stdio)── design-context server ◀── Context Engine
```

1. `designcontext scan` connects to the Figma MCP and indexes the requested scope.
2. The result is normalized into a local Design IR, hashed, and cached.
3. Agents query the local index through the `design-context` MCP server.

## Requirements

- **Node.js ≥ 22.5** (uses the built-in `node:sqlite`)
- A **Figma** connection — one of:
  - an **already-configured Figma MCP** (auto-detected from `.mcp.json` / `~/.claude.json`), or
  - a **hosted Figma MCP URL**, or
  - a **Figma Personal Access Token** (fallback)
- Network access on the first `scan` (if `npx` needs to fetch `figma-developer-mcp`)

## Install

```bash
npm install -g designcontext
```

Confirm it worked:

```bash
designcontext --version
```

## Quick start

```bash
cd your-project
designcontext init
```

This creates a `.designcontext/` folder with the project's configuration.

### Connect to Figma

```bash
designcontext connect
```

`connect` prefers an **existing Figma MCP** — it auto-detects one already configured in your
agent (from `.mcp.json` or `~/.claude.json`) and reuses it, so in most cases no token is needed.

If you don't have one configured, or want to point somewhere specific:

```bash
designcontext connect --url https://host/mcp          # a hosted Figma MCP
designcontext connect --file <fileId> --token <key>   # fallback: spawn figma-developer-mcp with a token
```

Figma credentials are stored in the OS secure vault (Keychain on macOS, Credential Manager on
Windows) — never in project files.

### Index a screen

```bash
designcontext scan                    # index the document root
designcontext scan --node 123:456     # index a specific frame/component
designcontext status                  # see what got indexed
```

The first scan is a full scan; after that, `scan` only re-indexes what changed.

### Register with your AI agent

```bash
designcontext setup
```

Registers the DesignContext MCP server with your agent's config in one step. Supports **Claude
Desktop, Claude Code, Gemini CLI, OpenAI Codex, and opencode** — pick one interactively, or skip
the prompt with `--agent claude-code,gemini-cli`. See [Agent integration](#agent-integration) to
configure it by hand instead.

## CLI

| Command | Description |
| --- | --- |
| `designcontext init [name]` | Create `.designcontext/` project config. |
| `designcontext connect` | Configure the Figma connection (`--url`, `--file`, `--token`; auto-reuses an existing Figma MCP). |
| `designcontext scan` | Index the scope (`--node <id>`, `--incremental`). |
| `designcontext status` | Show indexed screens/components/tokens and cache size. |
| `designcontext diff [screen]` | Show only what changed since the last scan. |
| `designcontext inspect --node <id> [--level 0-4]` | Print a node's context at a level. |
| `designcontext clear-cache` | Clear the local cache (keeps project config). |
| `designcontext setup` | Register the MCP server with an agent (`--agent <ids>` to skip the prompt). |

## Agent integration

DesignContext runs as an **MCP server** over stdio. `designcontext setup` does this for you (see
above); to configure it by hand, add this to your agent's MCP config:

```json
{
  "mcpServers": {
    "design-context": {
      "command": "designcontext",
      "args": ["mcp"]
    }
  }
}
```

This gives the agent tools to query the design directly: `design_get_screen`,
`design_get_structure`, `design_get_component`, `design_get_tokens`, `design_get_changes`,
`design_find`, `design_inspect`.

## Project structure

npm workspaces monorepo, one package per architecture boundary:

```
packages/
├── shared/           hashing, token estimation, paths, logging
├── core/             domain types, core interfaces, indexer, metrics
├── figma-adapter/    FigmaAdapter + FigmaMcpAdapter (client of the Figma MCP)
├── cache/            SQLite + content-addressable cache, project config, invalidation
├── design-graph/     node store + name-based search
├── design-ir/        Figma raw → Design IR normalization, context levels
├── diff-engine/      content/structural diff
├── context-engine/   Context Optimizer, component/token/changes assembly
├── mcp-server/       MCP server (design_get_* / design_find / design_inspect)
└── cli/              Commander CLI (init, connect, scan, status, diff, inspect, clear-cache, setup, mcp)
```

Full end-user documentation: **[erickson-ivanowski.github.io/DesignContext](https://erickson-ivanowski.github.io/DesignContext/)**
(also available in this repo at [`docs/index.html`](docs/index.html), in Portuguese, English, and Spanish).

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest (unit + integration + contract)
npm run build       # esbuild bundle -> dist/cli.mjs
```

## Testing

- `tests/unit/` — hashing, token estimation, IR normalization, diff
- `tests/integration/` — index → `get_screen` (US1), incremental change detection (US2),
  cache reuse across sessions (US5), Figma MCP over stdio
- `tests/contract/` — MCP tool input/output schemas

Tests are hermetic: a `MockFigmaAdapter` and a mock Figma MCP server spawned over stdio
(`tests/fixtures/mock-figma-server.mjs`) replace the live Figma MCP, and an in-memory
cache replaces SQLite.

## Storage & security

- Metadata/indexes in SQLite (`~/.designcontext/database.sqlite`); blobs content-addressable by SHA-256.
- `~/.designcontext/` is global, not versioned, and treated as sensitive (gitignored).
- Credentials go to the OS keychain via `keytar` when available — never into versioned files.
- Structured logs redact secrets/tokens.

## Implementation notes

- **SQLite driver**: the plan called for `drizzle-orm` + `better-sqlite3`. Since
  `better-sqlite3` is a native module that can't compile without a C++ toolchain, the
  storage layer uses Node's built-in `node:sqlite`. The schema and `CacheStore` contract
  are unchanged.
- **Figma connection**: a client of the Figma MCP via `@modelcontextprotocol/sdk`. Three modes,
  in order of preference: (1) reuse an existing Figma MCP (auto-detected from `.mcp.json` /
  `~/.claude.json`), (2) a hosted Figma MCP over streamable HTTP (`--url`), or (3) spawn
  `figma-developer-mcp` over stdio with a stored token. `StdioClientTransport` and
  `StreamableHTTPClientTransport` are both supported.

## License

MIT
