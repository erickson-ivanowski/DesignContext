# Contract: CLI Commands

Binary: `designcontext`. All paths cross-platform (Node `path`/`os.homedir()`); never bash/Unix-specific. Exit code 0 on success, non-zero on error; human-readable output to stdout, errors to stderr.

## init

```text
designcontext init
```
Creates `project/.designcontext/` (project.json, mappings.json, rules.md) with sensible defaults. Idempotent (no overwrite of existing config).

## connect

```text
designcontext connect
```
Configures the Figma MCP connection. Stores credentials in the OS secret store (Keychain / Credential Manager / Secret Service), never in versioned files.

## scan

```text
designcontext scan [--node <nodeId>] [--incremental]
```
Indexes the project scope (or a single node). First run = full scan of the requested scope; later runs = incremental (only changed nodes). Reports discovered/cached/changed node counts.

## status

```text
designcontext status
```
Prints project name, screens/components/tokens indexed, cache size, last scan time, cached nodes, changed nodes.

## diff

```text
designcontext diff [screen]
```
Prints changed/added/removed vs. the previous scan.

## inspect

```text
designcontext inspect [--node <nodeId>] [--level 0-4]
```
Prints context for a node at a given level.

## clear-cache

```text
designcontext clear-cache
```
Removes cached blobs and index data (keeps project config).

## mcp

```text
designcontext mcp
```
Starts the MCP server over stdio (long-running).

## snapshot (P1)

```text
designcontext snapshot create <name>
designcontext snapshot list
designcontext diff <a> <b>
```
Deferred to P1.
