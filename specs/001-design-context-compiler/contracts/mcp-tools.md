# Contract: MCP Tools

Server name: `design-context`. Transport: stdio (universal MCP). Each tool is invoked with a JSON `input` object and returns MCP tool results (text and, where noted, image content). All inputs validated with zod; unknown/extra behavior must not fetch the entire file (metadata-first, §12).

Return-style below is illustrative; actual responses honor the context budget (target ~5000, max ~12000 tokens) and the "minimum sufficient context" principle.

## design_get_project

- **Purpose**: Project summary only (never full detailed project).
- **Input**: `{}`
- **Output**: `{ name, framework, screens: string[], components: string[], tokens: string[] }`

## design_get_screen

- **Purpose**: Screen summary + hierarchy + components + layout summary + available children.
- **Input**: `{ screen: string }`
- **Output**: `{ screen, viewport, sections: string[], components: string[], layoutSummary, availableChildren: string[] }`

## design_get_structure

- **Purpose**: Tree up to requested depth only.
- **Input**: `{ nodeId: string, depth: number }`
- **Output**: nested tree of `{ id, name, type, children[] }` truncated at `depth`.

## design_get_component

- **Purpose**: Detailed context for one component.
- **Input**: `{ name: string }` (or `{ nodeId: string }`)
- **Output**: `{ name, structure, properties, tokens, childComponents, codeMapping }`

## design_get_tokens

- **Purpose**: Tokens used by a scope; never all project tokens unless requested.
- **Input**: `{ scope?: string }`
- **Output**: `{ scope, color?, spacing?, radius?, typography? }`

## design_get_changes

- **Purpose**: Only the diff since a prior version.
- **Input**: `{ screen: string, since: "previous" | string }`
- **Output**: `{ changed: [{ nodeId, name, before, after }], added: string[], removed: string[], unchanged: string[] }`

## design_get_screenshot (P1)

- **Purpose**: Visual artifact, separate from textual context; on demand only.
- **Input**: `{ nodeId: string }`
- **Output**: image content (PNG).

## design_find (P1)

- **Purpose**: Semantic search; returns matches without detailed content.
- **Input**: `{ query: string }`
- **Output**: `[{ node, type, location, component, confidence }]`

## design_inspect

- **Purpose**: Progressive deepening; the tool that lets the agent climb context levels.
- **Input**: `{ nodeId: string, level: 0|1|2|3|4 }`
- **Output**: context at the requested level (0 summary … 4 raw).
