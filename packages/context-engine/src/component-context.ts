import type { DesignNode } from "@designcontext/core";

export interface ComponentContext {
  name: string;
  structure: TreeNode[];
  properties: Record<string, unknown>;
  tokens: DesignNode["tokens"];
  childComponents: string[];
  codeMapping: CodeMapping;
}

export interface TreeNode {
  id: string;
  name: string;
  type: string;
  children: TreeNode[];
}

export interface CodeMapping {
  component: string | null;
  source: string | null;
  props: string[];
}

function buildTree(
  nodes: Map<string, DesignNode>,
  root: DesignNode,
  depth: number,
): TreeNode {
  const children: TreeNode[] = [];
  if (depth > 0) {
    for (const childId of root.children) {
      const child = nodes.get(childId);
      if (child) children.push(buildTree(nodes, child, depth - 1));
    }
  }
  return { id: root.id, name: root.name, type: root.type, children };
}

/** Assemble the detailed context for a single component. */
export function assembleComponent(
  component: DesignNode,
  allNodes: DesignNode[],
): ComponentContext {
  const nodes = new Map(allNodes.map((n) => [n.id, n]));

  const childComponents = component.children
    .map((id) => nodes.get(id))
    .filter((n): n is DesignNode => !!n)
    .filter((n) => n.componentId != null || n.type === "COMPONENT" || n.type === "INSTANCE")
    .map((n) => n.name);

  return {
    name: component.name,
    structure: [buildTree(nodes, component, 3)],
    properties: component.properties,
    tokens: component.tokens,
    childComponents,
    codeMapping: {
      component: component.componentName,
      source: component.componentName
        ? `src/components/${toPascalCase(component.componentName)}`
        : null,
      props: Object.keys(component.properties),
    },
  };
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
