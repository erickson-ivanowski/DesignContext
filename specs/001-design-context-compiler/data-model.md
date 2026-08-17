# Data Model: Design Context Compiler (MVP)

Entities derived from the feature spec (§ Key Entities) and the source document (§13, §16–18). P0 entities are modeled fully; P1 entities are listed but marked deferred.

## Entity: DesignNode

Represents a single design element (screen, section, frame, or component). Stored in SQLite with blobs (IR, raw context) in the filesystem cache.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Node id as reported by Figma (e.g., `123:456`) |
| `fileId` | string | Owning Figma file |
| `parentId` | string \| null | Parent node id |
| `name` | string | Human-readable node name |
| `type` | string | Figma type (FRAME, INSTANCE, TEXT, …) |
| `bounds` | {x,y,width,height} \| null | Position/size |
| `children` | string[] | Ordered child node ids |
| `componentId` | string \| null | Figma component id (if instance/component) |
| `componentName` | string \| null | Semantic component name |
| `properties` | json | Relevant normalized properties (fills, layout, typography…) |
| `contentHash` | string | SHA-256 of canonicalized content (no volatile fields) |
| `structuralHash` | string | SHA-256 of `{type, children, order, componentId, hierarchy}` |
| `irJson` | json (blob ref) | Design IR representation (filesystem) |
| `rawContext` | blob ref \| null | Level-4 raw design context (filesystem, on demand) |
| `lastSeenAt` | datetime | Last time node was observed/indexed |

**Relationships**:
- `DesignNode.parentId → DesignNode.id` (tree)
- `DesignNode.children[] → DesignNode.id` (ordered)
- `DesignNode` —(belongs to)— `Project` via `fileId`
- A `DesignNode` with a non-null `componentId` may map to a `Component` (P1).

**Validation rules** (from spec FR):
- `contentHash` MUST exclude timestamps and transient properties (FR-005).
- `structuralHash` MUST reflect type/children/order/component/hierarchy only (FR-006).
- Re-indexing MUST update only nodes whose hashes changed (FR-007).

## Entity: CacheEntry

Content-addressable cache record (concept key `fileId:nodeId:contentHash`, §16).

| Field | Type | Notes |
|-------|------|-------|
| `key` | string | `fileId:nodeId:contentHash` |
| `nodeId` | string | |
| `contentHash` | string | |
| `structuralHash` | string | |
| `designContext` | blob ref | Cached Design IR / context |
| `metadata` | json | Cached lightweight metadata |
| `timestamp` | datetime | Cache write time (NOT part of the hash) |

## Entity: Snapshot (Version)

A named point-in-time record enabling before/after diff (spec Key Entity; P1 for named snapshots, but "previous" comparison is P0).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `name` | string | e.g., `checkout-v1` |
| `scope` | string | file/node scope captured |
| `createdAt` | datetime | |

## Entity: DiffResult

Output of the diff engine comparing two versions of a scope (P0).

| Field | Type | Notes |
|-------|------|-------|
| `scope` | string | node/file being compared |
| `changed` | ChangeRecord[] | `{nodeId, name, before, after, kind: content|structural}` |
| `added` | string[] | Node ids/names |
| `removed` | string[] | Node ids/names |
| `unchanged` | string[] | Node ids/names (summary only) |

## Entity: Project

Local project configuration (versioned in `project/.designcontext/`).

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | |
| `figmaFileId` | string \| null | |
| `rootNodes` | string[] | Indexed scope roots |
| `framework` | string | e.g., `react` |
| `language` | string | e.g., `typescript` |
| `sourceDirectory` | string | |
| `componentDirectory` | string | |

## Entity: DesignToken (P1 — deferred)

Normalized style values (color, spacing, typography, radius, shadow, sizing, border). Not implemented in MVP.

## Entity: Component (P1 — deferred)

Mapping between a Figma component and an existing code component (`figmaComponent`, `codeComponent`, `source`, `props`). Not implemented in MVP.

## State transitions

`DesignNode` indexing lifecycle:

```text
unknown → discovered (metadata) → indexed (hashes+IR cached) → changed (hash mismatch) → indexed
                                        ↑_____________________________|
                          (unchanged: stays "indexed", freshness refreshed only)
```

- `changed` is detected when an incoming node's `contentHash`/`structuralHash` differs from the stored value; it is then re-indexed.
- A node present in a prior snapshot but absent now transitions to `removed` (recorded in `DiffResult`, not deleted).
