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
  getScreenshot?: (nodeId: string, fileId: string) => Promise<Buffer>;
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
        return ctx.getScreenshot!(nodeId, fileId);
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
