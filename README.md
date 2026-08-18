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
- **Multi-file** — track several Figma files in one project, each under its own alias, all
  queryable through one shared graph/cache and one MCP server.
- **MCP server** — `design_get_project`, `design_list_files`, `design_get_screen`,
  `design_get_structure`, `design_get_component`, `design_get_tokens`, `design_get_changes`,
  `design_find`, `design_inspect`.

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

Paste a Figma URL (Share → Copy link) — `connect` parses the file key (and node id, if the link
points at a specific frame) straight out of it:

```bash
designcontext connect --file "https://www.figma.com/design/aBc123XyZ/Checkout-Flow?node-id=155-1282"
```

`connect` prefers an **existing Figma MCP** — it auto-detects one already configured in your
agent (from `.mcp.json` or `~/.claude.json`) and reuses it, so in most cases no token is needed.
Since you didn't pass `--alias`, it makes one fresh call to fetch the Figma file's real name
("Checkout Flow") and slugifies it into the default alias (`checkout-flow`); pass `--alias` to
choose your own instead:

```bash
designcontext connect --file "https://www.figma.com/design/aBc123XyZ/Checkout-Flow" --alias checkout
```

If you don't have a Figma MCP configured, or want to point somewhere specific:

```bash
designcontext connect --file <url> --url https://host/mcp     # a hosted Figma MCP
designcontext connect --file <url> --token <key>              # fallback: spawn figma-developer-mcp with a token
```

Figma credentials are stored in the OS secure vault (Keychain on macOS, Credential Manager on
Windows) — never in project files.

If no `--file` is given, or no connection method can be resolved at all (no existing Figma MCP,
no `--url`, no `--token`), `connect` fails loudly instead of silently succeeding with an empty
config:

```
No Figma file given. Paste a Figma URL: designcontext connect --file <url> [--token <token>]
```

#### Connecting more than one file

A project can track multiple Figma files. Run `connect` again with a different URL — it appends
the new file (under its own alias) instead of replacing the one you already connected:

```bash
designcontext connect --file "https://www.figma.com/design/qRs456TuV/Cancelamento" --alias cancelamento
```

Both files now share the same local graph/cache and the same MCP server; every other command
that touches a specific file takes `--file <alias>` to pick between them.

### Index a screen

```bash
designcontext scan                    # 1 file configured: scans it. >1 file: scans ALL of them, one report line each
designcontext scan --file checkout    # scan only the "checkout" file
designcontext scan --node 123:456     # index a specific frame/component (requires --file once >1 file is connected)
designcontext status                  # see what got indexed, aggregate + per-file breakdown
```

The first scan of a file is a full scan; after that, `scan` only re-indexes what changed.

`status` also reports a running, never-reset total of how much the local cache has actually
saved: `tokensSaved` (full-content vs. optimized-summary token counts, and the reduction
percentage, across every `design_get_*` call served) and `figmaCallsSaved` (cache hit rate
during incremental scans — a hit means that node's data came from the local cache instead of
a Figma API call).

### Register with your AI agent

```bash
designcontext setup
```

Registers the DesignContext MCP server with your agent's config in one step. Supports **Claude
Desktop, Claude Code, Gemini CLI, OpenAI Codex, and opencode** — pick one interactively, or skip
the prompt with `--agent claude-code,gemini-cli`. See [Agent integration](#agent-integration) to
configure it by hand instead.

If `designcontext` wasn't installed globally (e.g. `npm install` without `-g`, or a restricted
environment where global installs aren't allowed), `setup` detects that and writes `npx -y
designcontext mcp` into the agent config instead of a bare `designcontext` command — so the agent
can still start it without you fixing your `PATH` first.

## CLI

| Command | Description |
| --- | --- |
| `designcontext init [name]` | Create `.designcontext/` project config. |
| `designcontext connect --file <url> [--alias <name>] [--token <token>] [--url <url>]` | Connect a Figma file — `--file` accepts a pasted Figma URL or a bare file key. Auto-reuses an existing Figma MCP; auto-fetches the file's name as the default alias when `--alias` is omitted. Run again with a different `--file` to connect an additional file to the same project. Throws a clear error instead of silently succeeding when no file or connection method is given. |
| `designcontext scan [--file <alias>]` | Index one file's scope, or every configured file (sequentially, one report line each) when `--file` is omitted. Accepts `--node <id>` (requires `--file` once the project tracks more than one file) and `--incremental`. |
| `designcontext status` | Show aggregate + per-file screens/components/tokens/cache breakdown. No `--file` flag — always reports on every connected file. |
| `designcontext diff [screen] --file <alias>` | Show only what changed since the last scan for one file. `--file` is required once the project tracks more than one file (errors listing the known aliases otherwise). |
| `designcontext inspect --node <id> [--level 0-4] --file <alias>` | Print a node's context at a level. `--file` is required once the project tracks more than one file. |
| `designcontext clear-cache [--file <alias>]` | Clear the local cache. `--file` is optional — omit it to clear everything. |
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

This gives the agent tools to query the design directly: `design_get_project`,
`design_list_files`, `design_get_screen`, `design_get_structure`, `design_get_component`,
`design_get_tokens`, `design_get_changes`, `design_find`, `design_inspect`.

Once a project tracks more than one Figma file, every tool except `design_get_project` accepts
an optional `file` input (an alias or raw file id) to pick which file to query, and it becomes
**required** as soon as more than one file is connected. `design_list_files` takes no input and
returns each connected file's alias, file id, screen count, and component count — call it first
when the agent isn't sure which alias to pass. `design_find` is the one exception: when `file` is
omitted it searches across *all* connected files, and each match's `file` field reports which
file (by alias) it came from.

If a file has no indexed data yet, tools return an actionable message instead of a bare "not
found" — telling the agent exactly whether the file needs a Figma connection (with the
`connect --token` command to run) or just a `scan`, so the agent can walk the user through
fixing it without them digging through docs.

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
