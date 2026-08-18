import { z } from "zod";
import type { ContextEngine, DesignGraph } from "@designcontext/core";
import type { ContextResult } from "@designcontext/core";
import { graphKey } from "@designcontext/core";

// --- Input/output schemas (contracts/mcp-tools.md) ---

const fileField = z.string().optional().describe(
  "Alias or file id of the Figma file to query. Required once the project tracks more than one file — see design_list_files.",
);

export const getProjectInput = z.object({}).strict();
export const getProjectOutput = z.object({
  name: z.string(),
  framework: z.string(),
  screens: z.array(z.string()),
  components: z.array(z.string()),
  tokens: z.array(z.string()),
});

export const listFilesInput = z.object({}).strict();
export const listFilesOutput = z.array(
  z.object({
    alias: z.string(),
    fileId: z.string(),
    screens: z.number(),
    components: z.number(),
    hasConnection: z.boolean(),
  }),
);

export const getScreenInput = z.object({ screen: z.string(), file: fileField }).strict();
export const getScreenOutput = z.object({
  screen: z.string(),
  viewport: z.unknown().nullable(),
  sections: z.array(z.string()),
  components: z.array(z.string()),
  layoutSummary: z.unknown(),
  availableChildren: z.array(z.string()),
});

interface TreeNodeShape {
  id: string;
  name: string;
  type: string;
  children: TreeNodeShape[];
}

const treeNode: z.ZodType<TreeNodeShape> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    children: z.array(treeNode),
  }),
);
export const getStructureInput = z
  .object({ nodeId: z.string(), depth: z.number().int().min(0), file: fileField })
  .strict();
export const getStructureOutput = treeNode;

export const getComponentInput = z
  .object({ name: z.string().optional(), nodeId: z.string().optional(), file: fileField })
  .strict();
export const getComponentOutput = z.object({
  name: z.string(),
  structure: z.array(treeNode),
  properties: z.record(z.unknown()),
  tokens: z.unknown(),
  childComponents: z.array(z.string()),
  codeMapping: z.object({
    component: z.string().nullable(),
    source: z.string().nullable(),
    props: z.array(z.string()),
  }),
});

export const getTokensInput = z.object({ scope: z.string().optional(), file: fileField }).strict();
export const getTokensOutput = z.object({
  scope: z.string(),
  color: z.record(z.string()).optional(),
  spacing: z.record(z.number()).optional(),
  radius: z.record(z.number()).optional(),
  typography: z.record(z.unknown()).optional(),
});

export const getChangesInput = z
  .object({ screen: z.string(), since: z.string().optional(), file: fileField })
  .strict();
export const getChangesOutput = z.object({
  changed: z.array(
    z.object({
      nodeId: z.string(),
      name: z.string(),
      before: z.unknown(),
      after: z.unknown(),
      kind: z.enum(["content", "structural", "added", "removed"]),
    }),
  ),
  added: z.array(z.string()),
  removed: z.array(z.string()),
  unchanged: z.array(z.string()),
});

export const findInput = z.object({ query: z.string(), file: fileField }).strict();
export const findOutput = z.array(
  z.object({
    node: z.string(),
    type: z.string(),
    location: z.string(),
    component: z.string().nullable(),
    confidence: z.number(),
    file: z.string(),
  }),
);

export const inspectInput = z
  .object({
    nodeId: z.string(),
    level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    file: fileField,
  })
  .strict();
export const inspectOutput = z.unknown();

export const screenshotInput = z.object({ nodeId: z.string(), file: fileField }).strict();

export const importInput = z
  .object({
    file: z.string().describe("Alias or file id — must already be registered via `connect --import-only`."),
    scopeNodeId: z.string().describe("The node this raw data is rooted at."),
    rawData: z.string().describe("The agent's own Figma MCP tool's raw text output for scopeNodeId."),
  })
  .strict();
export const importOutput = z.object({
  discovered: z.number(),
  indexed: z.number(),
  changed: z.number(),
  cached: z.number(),
  warning: z.string().optional(),
});

// --- Handler context + tool definitions ---

export interface ProjectSummary {
  name: string;
  framework: string;
  screens: string[];
  components: string[];
  tokens: string[];
}

export interface FileSummary {
  alias: string;
  fileId: string;
  screens: number;
  components: number;
  hasConnection: boolean;
}

export interface FileConnectionState {
  /** A figmaMcp-or-token connection method is configured for this file. */
  hasConnection: boolean;
  /** Nodes currently indexed for this file, across all scopes. */
  indexedNodes: number;
}

export interface ToolContext {
  engine: ContextEngine & {
    getContext(nodeId: string, level: 0 | 1 | 2 | 3 | 4, fileId?: string): Promise<ContextResult>;
  };
  graph: DesignGraph;
  getProject: () => Promise<ProjectSummary>;
  listFiles: () => Promise<FileSummary[]>;
  /** Resolve an alias or raw file id to a Figma file id. Throws when unresolvable or ambiguous (input omitted, >1 file configured). */
  resolveFileId: (aliasOrId: string | undefined) => Promise<string>;
  getFileConnectionState: (fileId: string) => Promise<FileConnectionState>;
  getScreenshot?: (nodeId: string, fileId: string) => Promise<Buffer>;
  /** Index data an agent already fetched via its own Figma MCP access, in place of a live connection this process holds. */
  importFigmaData?: (
    fileId: string,
    scopeNodeId: string,
    rawData: string,
  ) => Promise<{ discovered: number; indexed: number; changed: number; cached: number }>;
}

/**
 * Every content-serving tool resolves a fileId, then looks up a node. If the file has
 * never been indexed, that lookup fails with a generic "no node found" — useless to an
 * agent trying to help the user. Check first and fail with exactly what's missing and
 * the command to fix it, so the agent can walk the user through setup instead of guessing.
 */
async function assertFileReady(ctx: ToolContext, fileId: string, aliasOrId: string): Promise<void> {
  const state = await ctx.getFileConnectionState(fileId);
  if (state.indexedNodes > 0) return;

  if (!state.hasConnection) {
    throw new Error(
      `No Figma connection is configured for "${aliasOrId}" and it has never been scanned. ` +
        "Ask the user to generate a token at https://figma.com/settings → Personal Access Tokens, then run: " +
        `designcontext connect --file <url> --token <token>, then designcontext scan --file ${aliasOrId}`,
    );
  }
  throw new Error(
    `"${aliasOrId}" is connected but has never been scanned. Run: designcontext scan --file ${aliasOrId}`,
  );
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
  outputSchema: z.ZodType<unknown>;
  handler: (input: unknown) => Promise<unknown>;
}

export function createToolDefinitions(ctx: ToolContext): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    {
      name: "design_get_project",
      description: "Project summary only (never full detailed project). Aggregates across all tracked files.",
      inputSchema: getProjectInput,
      outputSchema: getProjectOutput,
      handler: async () => ctx.getProject(),
    },
    {
      name: "design_list_files",
      description: "List the Figma files this project tracks — call this first when unsure which `file` to pass to other tools.",
      inputSchema: listFilesInput,
      outputSchema: listFilesOutput,
      handler: async () => ctx.listFiles(),
    },
    {
      name: "design_get_screen",
      description:
        "Screen summary + hierarchy + components + layout summary + available children.",
      inputSchema: getScreenInput,
      outputSchema: getScreenOutput,
      handler: async (input) => {
        const { screen, file } = input as { screen: string; file?: string };
        const fileId = await ctx.resolveFileId(file);
        await assertFileReady(ctx, fileId, file ?? fileId);
        const result = await ctx.engine.getScreen(screen, fileId);
        return result.content;
      },
    },
    {
      name: "design_get_structure",
      description: "Tree up to the requested depth only.",
      inputSchema: getStructureInput,
      outputSchema: getStructureOutput,
      handler: async (input) => {
        const { nodeId, depth, file } = input as { nodeId: string; depth: number; file?: string };
        const fileId = await ctx.resolveFileId(file);
        await assertFileReady(ctx, fileId, file ?? fileId);
        return buildStructure(ctx.graph, fileId, nodeId, depth);
      },
    },
    {
      name: "design_get_component",
      description: "Detailed context for one component.",
      inputSchema: getComponentInput,
      outputSchema: getComponentOutput,
      handler: async (input) => {
        const { name, nodeId, file } = input as { name?: string; nodeId?: string; file?: string };
        const fileId = await ctx.resolveFileId(file);
        await assertFileReady(ctx, fileId, file ?? fileId);
        const id = nodeId ?? name!;
        const result = await ctx.engine.getComponent(id, fileId);
        return result.content;
      },
    },
    {
      name: "design_get_tokens",
      description: "Tokens used by a scope; never all project tokens unless requested.",
      inputSchema: getTokensInput,
      outputSchema: getTokensOutput,
      handler: async (input) => {
        const { scope, file } = input as { scope?: string; file?: string };
        const fileId = await ctx.resolveFileId(file);
        await assertFileReady(ctx, fileId, file ?? fileId);
        const result = await ctx.engine.getTokens(scope, fileId);
        return result.content;
      },
    },
    {
      name: "design_get_changes",
      description: "Only the diff since a prior version.",
      inputSchema: getChangesInput,
      outputSchema: getChangesOutput,
      handler: async (input) => {
        const { screen, file } = input as { screen: string; file?: string };
        const fileId = await ctx.resolveFileId(file);
        await assertFileReady(ctx, fileId, file ?? fileId);
        return ctx.engine.getChanges(screen, fileId);
      },
    },
    {
      name: "design_find",
      description: "Name-based search; returns matches without detailed content. Searches all files when `file` is omitted.",
      inputSchema: findInput,
      outputSchema: findOutput,
      handler: async (input) => {
        const { query, file } = input as { query: string; file?: string };
        const fileId = file ? await ctx.resolveFileId(file) : undefined;
        const matches = await ctx.graph.search(query, fileId);
        const files = await ctx.listFiles();
        const aliasByFileId = new Map(files.map((f) => [f.fileId, f.alias]));
        return matches.map((n) => ({
          node: n.id,
          type: n.type,
          location: n.parentId ?? "root",
          component: n.componentName,
          confidence: 1,
          file: aliasByFileId.get(n.fileId) ?? n.fileId,
        }));
      },
    },
    {
      name: "design_inspect",
      description: "Progressive deepening; climb context levels 0-4.",
      inputSchema: inspectInput,
      outputSchema: inspectOutput,
      handler: async (input) => {
        const { nodeId, level, file } = input as { nodeId: string; level: 0 | 1 | 2 | 3 | 4; file?: string };
        const fileId = await ctx.resolveFileId(file);
        await assertFileReady(ctx, fileId, file ?? fileId);
        const result = await ctx.engine.getContext(nodeId, level, fileId);
        return result.content;
      },
    },
  ];

  if (ctx.getScreenshot) {
    tools.push({
      name: "design_get_screenshot",
      description: "Visual artifact, separate from textual context; on demand only (P1).",
      inputSchema: screenshotInput,
      outputSchema: z.unknown(),
      handler: async (input) => {
        const { nodeId, file } = input as { nodeId: string; file?: string };
        const fileId = await ctx.resolveFileId(file);
        await assertFileReady(ctx, fileId, file ?? fileId);
        return ctx.getScreenshot!(nodeId, fileId);
      },
    });
  }

  if (ctx.importFigmaData) {
    tools.push({
      name: "design_import",
      description:
        "Call this when design_get_screen/etc. report a file has no connection configured and the user " +
        "doesn't want to generate a Figma token. Fetch the node's raw design data via your own Figma MCP " +
        "tool (e.g. get_figma_data), then pass its exact raw text output here to index it.",
      inputSchema: importInput,
      outputSchema: importOutput,
      handler: async (input) => {
        const { file, scopeNodeId, rawData } = input as {
          file: string;
          scopeNodeId: string;
          rawData: string;
        };
        const fileId = await ctx.resolveFileId(file);
        const report = await ctx.importFigmaData!(fileId, scopeNodeId, rawData);
        if (report.discovered === 0) {
          return {
            ...report,
            warning:
              "0 nodes parsed from rawData — its format may not match figma-developer-mcp's " +
              "get_figma_data output. Consider suggesting the user generate a Figma token instead.",
          };
        }
        return report;
      },
    });
  }

  return tools;
}

async function buildStructure(
  graph: DesignGraph,
  fileId: string,
  nodeId: string,
  depth: number,
): Promise<{ id: string; name: string; type: string; children: unknown[] }> {
  const compositeId = graphKey(fileId, nodeId);
  const node = await graph.getNode(compositeId);
  if (!node) {
    throw new Error(`No node found for "${nodeId}"`);
  }
  const children: unknown[] = [];
  if (depth > 0) {
    const kids = await graph.getChildren(compositeId);
    for (const kid of kids) {
      children.push(await buildStructure(graph, fileId, kid.id, depth - 1));
    }
  }
  return { id: node.id, name: node.name, type: node.type, children };
}
