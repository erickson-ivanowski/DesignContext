import type {
  ContextEngine,
  ContextLevel,
  ContextResult,
  DesignNode,
  DiffResult,
} from "@designcontext/core";
import type { DesignGraph } from "@designcontext/core";
import type { DesignCache } from "@designcontext/cache";
import { estimateTokens } from "@designcontext/shared";
import { optimize } from "./optimizer";
import { assembleComponent, type ComponentContext } from "./component-context";
import { extractScopeTokens } from "./tokens";
import { assembleChanges } from "./changes";

const COMPONENT_TYPES = new Set(["COMPONENT", "INSTANCE", "COMPONENT_SET"]);

function isComponent(node: DesignNode): boolean {
  return node.componentId != null || COMPONENT_TYPES.has(node.type);
}

function collectDescendants(root: DesignNode, nodes: Map<string, DesignNode>): DesignNode[] {
  const result: DesignNode[] = [];
  const queue: DesignNode[] = [root];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    result.push(node);
    for (const childId of node.children) {
      const child = nodes.get(childId);
      if (child) queue.push(child);
    }
  }
  return result;
}

function summarizeLayout(root: DesignNode): Record<string, unknown> {
  const p = root.properties;
  const summary: Record<string, unknown> = {};
  const pick = (key: string) => {
    if (p[key] !== undefined) summary[key] = p[key];
  };
  pick("layoutMode");
  pick("direction");
  pick("itemSpacing");
  pick("padding");
  pick("width");
  pick("height");
  pick("constraints");
  return summary;
}

export class ContextEngineImpl implements ContextEngine {
  constructor(
    private readonly graph: DesignGraph,
    private readonly cache: DesignCache,
  ) {}

  private async resolveNode(idOrName: string): Promise<DesignNode> {
    const byId = await this.graph.getNode(idOrName);
    if (byId) return byId;
    const matches = await this.graph.search(idOrName);
    if (matches.length > 0) return matches[0];
    throw new Error(`No node found for "${idOrName}"`);
  }

  async getScreen(screenId: string): Promise<ContextResult> {
    const root = await this.resolveNode(screenId);
    const all = await this.graph.all();
    const nodes = new Map(all.map((n) => [n.id, n]));
    const descendants = collectDescendants(root, nodes);
    const childNames = root.children
      .map((id) => nodes.get(id)?.name)
      .filter((n): n is string => !!n);
    const components = descendants.filter(isComponent).map((n) => n.name);

    const content = {
      screen: root.name,
      viewport: root.bounds,
      sections: childNames,
      components,
      layoutSummary: summarizeLayout(root),
      availableChildren: childNames,
    };

    const optimized = optimize(content);
    return {
      nodeId: root.id,
      level: 0,
      content: optimized.content,
      tokenCount: optimized.tokenCount,
      references: optimized.references,
    };
  }

  async getComponent(componentId: string): Promise<ContextResult> {
    const component = await this.resolveNode(componentId);
    const all = await this.graph.all();
    const assembled: ComponentContext = assembleComponent(component, all);
    const optimized = optimize(assembled);
    return {
      nodeId: component.id,
      level: 2,
      content: optimized.content,
      tokenCount: optimized.tokenCount,
      references: optimized.references,
    };
  }

  async getTokens(scope?: string): Promise<ContextResult> {
    const all = await this.graph.all();
    let nodes = all;
    if (scope) {
      const root = await this.resolveNode(scope);
      const nodeMap = new Map(all.map((n) => [n.id, n]));
      nodes = collectDescendants(root, nodeMap);
    }
    const tokens = extractScopeTokens(nodes);
    return {
      nodeId: scope ?? "*",
      level: 2,
      content: { scope: scope ?? "project", ...tokens },
      tokenCount: estimateTokens(tokens),
    };
  }

  async getChanges(scopeId: string): Promise<DiffResult> {
    return assembleChanges(this.graph, this.cache, scopeId);
  }

  async getContext(nodeId: string, level: ContextLevel): Promise<ContextResult> {
    const node = await this.resolveNode(nodeId);
    const all = await this.graph.all();
    const nodes = new Map(all.map((n) => [n.id, n]));

    let content: unknown;
    switch (level) {
      case 0:
        content = {
          id: node.id,
          name: node.name,
          type: node.type,
          childCount: node.children.length,
        };
        break;
      case 1:
        content = {
          id: node.id,
          name: node.name,
          type: node.type,
          children: node.children.map((id) => {
            const c = nodes.get(id);
            return c ? { id: c.id, name: c.name, type: c.type } : { id };
          }),
        };
        break;
      case 2:
        content = { id: node.id, name: node.name, type: node.type, properties: node.properties, tokens: node.tokens };
        break;
      case 3:
        content = node.irJson ?? node;
        break;
      case 4:
        content = node.rawContext ?? node.irJson ?? node;
        break;
    }

    const optimized = optimize(content);
    return {
      nodeId: node.id,
      level,
      content: optimized.content,
      tokenCount: optimized.tokenCount,
      references: optimized.references,
    };
  }
}
