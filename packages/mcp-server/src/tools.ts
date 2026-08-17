import { z } from "zod";
import type { ContextEngine, DesignGraph } from "@designcontext/core";
import type { ContextResult } from "@designcontext/core";

// --- Input/output schemas (contracts/mcp-tools.md) ---

export const getProjectInput = z.object({}).strict();
export const getProjectOutput = z.object({
  name: z.string(),
  framework: z.string(),
  screens: z.array(z.string()),
  components: z.array(z.string()),
  tokens: z.array(z.string()),
});

export const getScreenInput = z.object({ screen: z.string() }).strict();
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
  .object({ nodeId: z.string(), depth: z.number().int().min(0) })
  .strict();
export const getStructureOutput = treeNode;

export const getComponentInput = z
  .object({ name: z.string().optional(), nodeId: z.string().optional() })
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

export const getTokensInput = z.object({ scope: z.string().optional() }).strict();
export const getTokensOutput = z.object({
  scope: z.string(),
  color: z.record(z.string()).optional(),
  spacing: z.record(z.number()).optional(),
  radius: z.record(z.number()).optional(),
  typography: z.record(z.unknown()).optional(),
});

export const getChangesInput = z
  .object({ screen: z.string(), since: z.string().optional() })
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

export const findInput = z.object({ query: z.string() }).strict();
export const findOutput = z.array(
  z.object({
    node: z.string(),
    type: z.string(),
    location: z.string(),
    component: z.string().nullable(),
    confidence: z.number(),
  }),
);

export const inspectInput = z
  .object({
    nodeId: z.string(),
    level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  })
  .strict();
export const inspectOutput = z.unknown();

export const screenshotInput = z.object({ nodeId: z.string() }).strict();

// --- Handler context + tool definitions ---

export interface ProjectSummary {
  name: string;
  framework: string;
  screens: string[];
  components: string[];
  tokens: string[];
}

export interface ToolContext {
  engine: ContextEngine & {
    getContext(nodeId: string, level: 0 | 1 | 2 | 3 | 4): Promise<ContextResult>;
  };
  graph: DesignGraph;
  getProject: () => Promise<ProjectSummary>;
  getScreenshot?: (nodeId: string) => Promise<Buffer>;
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
      description: "Project summary only (never full detailed project).",
      inputSchema: getProjectInput,
      outputSchema: getProjectOutput,
      handler: async () => ctx.getProject(),
    },
    {
      name: "design_get_screen",
      description:
        "Screen summary + hierarchy + components + layout summary + available children.",
      inputSchema: getScreenInput,
      outputSchema: getScreenOutput,
      handler: async (input) => {
        const { screen } = input as { screen: string };
        const result = await ctx.engine.getScreen(screen);
        return result.content;
      },
    },
    {
      name: "design_get_structure",
      description: "Tree up to the requested depth only.",
      inputSchema: getStructureInput,
      outputSchema: getStructureOutput,
      handler: async (input) => {
        const { nodeId, depth } = input as { nodeId: string; depth: number };
        return buildStructure(ctx.graph, nodeId, depth);
      },
    },
    {
      name: "design_get_component",
      description: "Detailed context for one component.",
      inputSchema: getComponentInput,
      outputSchema: getComponentOutput,
      handler: async (input) => {
        const { name, nodeId } = input as { name?: string; nodeId?: string };
        const id = nodeId ?? name!;
        const result = await ctx.engine.getComponent(id);
        return result.content;
      },
    },
    {
      name: "design_get_tokens",
      description: "Tokens used by a scope; never all project tokens unless requested.",
      inputSchema: getTokensInput,
      outputSchema: getTokensOutput,
      handler: async (input) => {
        const { scope } = input as { scope?: string };
        const result = await ctx.engine.getTokens(scope);
        return result.content;
      },
    },
    {
      name: "design_get_changes",
      description: "Only the diff since a prior version.",
      inputSchema: getChangesInput,
      outputSchema: getChangesOutput,
      handler: async (input) => {
        const { screen } = input as { screen: string };
        return ctx.engine.getChanges(screen);
      },
    },
    {
      name: "design_find",
      description: "Name-based search; returns matches without detailed content.",
      inputSchema: findInput,
      outputSchema: findOutput,
      handler: async (input) => {
        const { query } = input as { query: string };
        const matches = await ctx.graph.search(query);
        return matches.map((n) => ({
          node: n.id,
          type: n.type,
          location: n.parentId ?? "root",
          component: n.componentName,
          confidence: 1,
        }));
      },
    },
    {
      name: "design_inspect",
      description: "Progressive deepening; climb context levels 0-4.",
      inputSchema: inspectInput,
      outputSchema: inspectOutput,
      handler: async (input) => {
        const { nodeId, level } = input as { nodeId: string; level: 0 | 1 | 2 | 3 | 4 };
        const result = await ctx.engine.getContext(nodeId, level);
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
        const { nodeId } = input as { nodeId: string };
        return ctx.getScreenshot!(nodeId);
      },
    });
  }

  return tools;
}

async function buildStructure(
  graph: DesignGraph,
  nodeId: string,
  depth: number,
): Promise<{ id: string; name: string; type: string; children: unknown[] }> {
  const node = await graph.getNode(nodeId);
  if (!node) {
    throw new Error(`No node found for "${nodeId}"`);
  }
  const children: unknown[] = [];
  if (depth > 0) {
    const kids = await graph.getChildren(nodeId);
    for (const kid of kids) {
      children.push(await buildStructure(graph, kid.id, depth - 1));
    }
  }
  return { id: node.id, name: node.name, type: node.type, children };
}
