# Quickstart: Design Context Compiler (MVP)

Target experience: **Install → Connect → Done.** The designer should never need to understand hashes, SQLite, IR, or caching (§45).

## 1. Install

```bash
npm install -g designcontext
```

## 2. Init a project

```bash
cd my-app
designcontext init
```

Creates `my-app/.designcontext/` (project.json, mappings.json, rules.md) — safe to commit.

## 3. Connect Figma

```bash
designcontext connect
```

Stores the Figma MCP connection and credentials in the OS secret store (never in git).

## 4. Scan (index) a scope

```bash
designcontext scan            # index project root nodes
designcontext scan --node 123:456   # index a single frame/component
```

First run is a full scan; later runs are incremental.

## 5. Configure the agent

`designcontext init`/`connect` emits the MCP config automatically (conceptually):

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

No manual file editing in the main flow.

## 6. Use the agent normally

```text
User: "Implemente a tela Checkout do Figma."
Claude → design_get_screen("Checkout")
Claude → design_get_component("Payment")
```

```text
User: "O botão está diferente do Figma. Corrija."
Claude → design_get_changes("Checkout")
```

## Verification (maps to spec success criteria)

- `designcontext status` shows indexed screens/components/tokens, cache size, changed nodes.
- `designcontext diff` shows only changes after a re-scan.
- Token estimation is reported on every context fetch.

## Notes

- `~/.designcontext/` is global (not versioned) and potentially sensitive; add `database.sqlite`, `cache/`, `screenshots/`, `credentials/` to `.gitignore`.
- Works offline except for Figma communication; no telemetry by default.
