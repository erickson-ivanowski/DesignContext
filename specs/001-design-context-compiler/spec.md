# Feature Specification: Design Context Compiler

**Feature Branch**: `001-design-context-compiler`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "Design Context Compiler — a local, cross-platform tool that acts as an intelligent context layer between AI coding agents and Figma, dramatically reducing the token/context volume required to implement and modify interfaces."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Index a design and implement a screen (Priority: P1)

A designer or developer connects a Figma design to the tool and indexes it. An AI coding agent then asks the tool for a screen and receives a compact, structured summary (sections, components, tokens, existing code mappings) — enough to implement the screen visually without ever receiving the full raw design dump.

**Why this priority**: This is the core value proposition — reducing redundant context so agents can implement interfaces at a fraction of the token cost. Nothing else matters if this flow doesn't work.

**Independent Test**: A user connects a Figma file, indexes one screen, and an AI agent retrieves that screen's context and produces a working implementation of it. This can be validated in isolation (one screen, one agent) and delivers the primary value of the product.

**Acceptance Scenarios**:

1. **Given** a Figma design with a screen the user has selected and indexed, **When** the AI agent requests that screen, **Then** the tool returns a summary containing the screen name, its top-level sections, available components, relevant design tokens, and any existing code mappings — not the full raw design data.
2. **Given** the agent received the screen summary, **When** the agent requests details for one section (e.g., "Payment"), **Then** the tool returns detailed context only for that section, not the entire screen.
3. **Given** the tool is connected to a Figma design, **When** the agent asks for a screen that has not yet been indexed, **Then** the tool discovers the screen's structure via lightweight metadata first, then retrieves detailed context only for the relevant nodes.

---

### User Story 2 - Detect a small design change without reprocessing everything (Priority: P1)

A designer makes a small change in Figma (e.g., adjusts the padding of a single button) and re-indexes the design. The tool detects exactly which node changed and updates only that node, leaving the rest of the design untouched.

**Why this priority**: This is the second pillar of the product — incremental updates. Without it, every small change forces a full re-fetch, negating the token savings.

**Independent Test**: Index a screen, modify one button in Figma, re-index, and confirm the tool reports exactly one changed node and does not reprocess unchanged nodes.

**Acceptance Scenarios**:

1. **Given** a screen that was previously indexed, **When** the user re-indexes after changing only a button, **Then** the tool reports exactly one changed node.
2. **Given** a screen with many nodes, **When** only one node changed, **Then** unchanged nodes are served from local storage and are not re-fetched from Figma.
3. **Given** a change that alters only visual properties (e.g., width/height), **When** compared to a change that alters structure (e.g., adding/removing children), **Then** the tool distinguishes "content changed" from "structure changed".

---

### User Story 3 - Answer a focused question with only the relevant context (Priority: P2)

An AI agent asks a specific question — "what is the style of the primary button?" — and the tool returns only the button's context (dimensions, padding, radius, typography, states) without any unrelated screen or design data.

**Why this priority**: This demonstrates the "minimum sufficient context" principle in action for incremental, iterative workflows.

**Independent Test**: With a screen indexed, query the tool for a single component by name and confirm the response contains only that component's relevant details.

**Acceptance Scenarios**:

1. **Given** an indexed screen, **When** the agent requests a specific component (e.g., "PaymentForm" or "Button/Primary"), **Then** the tool returns that component's structure, relevant properties, tokens, child components, and code mapping only.
2. **Given** an indexed project, **When** the agent requests design tokens scoped to a component, **Then** the tool returns only the tokens used by that component, not all project tokens.
3. **Given** a query for a component by a natural-language description (e.g., "primary button"), **When** the tool matches candidate nodes, **Then** the tool returns matching nodes with type, location, component, and confidence — without automatically returning detailed content.

---

### User Story 4 - Report what changed since the last version (Priority: P2)

An AI agent asks "what changed in Checkout?" and the tool returns only the diff — a human- and agent-readable description of changed, added, and removed nodes with before/after values — rather than the full screen.

**Why this priority**: This closes the loop for iterative development, letting agents correct drift between design and code with minimal context.

**Independent Test**: Index a screen, change a property, and query for changes; confirm the tool returns only the delta (changed/added/removed) in a readable format.

**Acceptance Scenarios**:

1. **Given** a screen indexed at two different points in time, **When** the agent requests changes for that screen, **Then** the tool returns only changed, added, and removed nodes.
2. **Given** a change to a component's properties, **When** the diff is produced, **Then** before/after values are shown (e.g., "width 120 → 140") in a form an agent can act on directly.

---

### User Story 5 - Reuse previously indexed context across sessions (Priority: P3)

A user indexes a design on Monday and returns on Tuesday. The tool recognizes the design is already indexed and reuses the cached context instead of re-fetching and reprocessing everything from Figma.

**Why this priority**: Persistence delivers compounding savings over time and is required for the incremental workflows above, but is a supporting capability rather than a standalone deliverable.

**Independent Test**: Index a design, close the session, reopen it, and re-index; confirm the tool reuses the vast majority of previously indexed data and makes far fewer remote calls.

**Acceptance Scenarios**:

1. **Given** a previously indexed design, **When** the user returns in a later session, **Then** the tool reports the design is already indexed and does not reprocess everything.
2. **Given** a re-index of an unchanged design, **When** measured, **Then** the number of remote fetches drops to a small fraction of the first index (e.g., from hundreds of calls to a handful).
3. **Given** local storage was cleared or corrupted, **When** the user re-indexes, **Then** the tool performs a full scan and rebuilds its index without error.

---

### Edge Cases

- What happens when a node no longer exists in Figma (deleted by the designer)? The tool should report it as removed rather than erroring.
- What happens when the Figma connection is unavailable or returns an error during indexing? The tool should surface a clear error and retain any previously cached data.
- What happens when the design contains duplicate component names or repeated instances of the same component? The tool should disambiguate by node identity and not confuse instances.
- What happens when a user requests more context than the configured budget allows? The tool should return the minimal sufficient context and indicate that more detail is available on request, rather than silently truncating.
- What happens when the design file is very large and only a single node is requested? The tool should avoid fetching the entire file and instead retrieve only the requested scope.
- What happens on a platform where the operating-system credential store is unavailable? Credentials must never be written to versioned configuration files.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to connect a Figma design as the source of truth for a project without storing credentials in versioned configuration files.
- **FR-002**: System MUST index a user-selected scope (a file, page, frame, component, or specific node) rather than requiring the entire design file to be indexed.
- **FR-003**: System MUST discover a design's structure using lightweight metadata before fetching detailed content for any node.
- **FR-004**: System MUST persist indexed design context locally so it survives restarts and agent sessions.
- **FR-005**: System MUST compute a deterministic fingerprint for each node's content (excluding timestamps and transient properties) to detect whether content has changed.
- **FR-006**: System MUST compute a separate fingerprint representing a node's structure (type, children, ordering, and hierarchy) to distinguish content changes from structural changes.
- **FR-007**: System MUST support incremental indexing so that re-indexing updates only nodes whose fingerprint changed, leaving unchanged nodes untouched.
- **FR-008**: System MUST provide a query that returns a screen summary (sections, components, tokens, code mappings) without returning the full raw design data.
- **FR-009**: System MUST provide a query that returns the structure tree of a node, limited to a requested depth.
- **FR-010**: System MUST provide a query that returns detailed context for a single component (structure, relevant properties, tokens, child components, code mapping).
- **FR-011**: System MUST provide a query that returns design tokens, optionally scoped to a specific component so that only used tokens are returned.
- **FR-012**: System MUST provide a query that returns only the changes (changed, added, removed nodes) for a given scope since a prior version.
- **FR-013**: System MUST provide a mechanism for the agent to progressively request deeper context levels (summary → structure → tokens → implementation detail → raw data).
- **FR-014**: System MUST return the minimum sufficient context for a request and allow the agent to explicitly request more detail, rather than returning the maximum available context.
- **FR-015**: System MUST estimate the token size of context before returning it to the agent, and report the reduction achieved versus the raw design context.
- **FR-016**: System MUST maintain mappings between Figma components and existing code components so agents can reuse existing implementations instead of recreating them.
- **FR-017**: System MUST operate fully offline except for the necessary communication with Figma, with no remote telemetry by default.
- **FR-018**: System MUST run on macOS (Apple Silicon and Intel), Windows (x64), and Linux (x64) using filesystem paths resolved through cross-platform mechanisms.
- **FR-019**: System MUST log structured operational information (connection established, nodes discovered, nodes cached, nodes changed) without logging secrets, tokens, or credentials.
- **FR-020**: System MUST be installable and configurable through a command-line interface with sensible defaults so a designer can go from install to connected with minimal manual configuration.

### Key Entities *(include if feature involves data)*

- **Design Node**: A single element in the design (screen, section, frame, or component). Holds identity, name, type, position/size, parent-child relationships, a content fingerprint, and a structural fingerprint.
- **Component**: A reusable design element with an identity that can be mapped to an existing code component (source location and properties).
- **Design Token**: A normalized style value (color, spacing, typography, radius, shadow, sizing, border) extracted from the design and reusable across components.
- **Screen**: A top-level view in the design that the agent can implement; composed of sections and components.
- **Index Snapshot / Version**: A point-in-time record of indexed design state, enabling before/after comparison.
- **Change (Diff)**: The result of comparing two versions of a scope, describing changed, added, and removed nodes with before/after values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For the same implementation task, the tool reduces the context delivered to the agent by at least 70% compared to receiving the full raw design context, while the agent still produces a visually equivalent implementation.
- **SC-002**: A user can go from first install to a connected, indexed design in under 10 minutes without manual configuration file editing.
- **SC-003**: After a single-node design change, a re-index reports exactly the changed node(s) and does not reprocess unchanged nodes.
- **SC-004**: A re-index of an unchanged design reuses at least 90% of previously indexed data, reducing remote fetches by an order of magnitude (e.g., from hundreds of calls on first index to a handful on re-index).
- **SC-005**: A focused query (e.g., "what is the style of the primary button?") returns only the requested component's context, not unrelated screen or design data.
- **SC-006**: A change query ("what changed in Checkout?") returns only the delta, enabling an agent to correct drift without receiving the full screen.
- **SC-007**: The tool functions identically on macOS, Windows, and Linux for the same design and workflow.
- **SC-008**: No secrets, tokens, or credentials are ever stored in versioned configuration files or written to logs.

## Assumptions

- The initial user is a designer or developer who creates screens in Figma and uses an AI coding agent (such as Claude Code) that can call external tools.
- The source of truth for design data remains Figma; this tool does not modify, generate, or replace Figma designs.
- The initial version targets a single local user and a single project at a time; multi-user/team sharing is explicitly out of scope for the initial release.
- The Figma connection is provided by the user's existing Figma integration (a "Figma MCP" tool already available in the environment); the tool layers on top of it rather than implementing a direct Figma API client for the initial release.
- "Minimum sufficient context" is guided by a configurable target token budget with sensible defaults (e.g., ~5,000 target / ~12,000 max tokens), while keeping the principle that the agent can always request more.
- Screenshots and visual comparison (design vs. rendered code) are future capabilities and are not required for the initial release.
- The initial release scopes to the P0 capability set (connect, index, incremental index, cache with fingerprints, structure/component/change queries, token estimation, and agent configuration). Component/token registries, search, and snapshots are P1 and not required for the first release.
