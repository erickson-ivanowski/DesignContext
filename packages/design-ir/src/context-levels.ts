import type { ContextLevel, DesignIR } from "@designcontext/core";

/**
 * Project a single Design IR node to a progressive context level.
 * 0 summary → 4 raw (IR is used as the raw proxy when raw context is absent).
 */
export function project(ir: DesignIR, level: ContextLevel): unknown {
  switch (level) {
    case 0:
      return {
        id: ir.id,
        name: ir.name,
        type: ir.type,
        childCount: ir.children.length,
        componentId: ir.componentId,
        tokenSummary: summarizeTokens(ir.tokens),
      };
    case 1:
      return {
        id: ir.id,
        name: ir.name,
        type: ir.type,
        children: ir.children,
      };
    case 2:
      return {
        id: ir.id,
        name: ir.name,
        type: ir.type,
        properties: ir.properties,
        tokens: ir.tokens,
      };
    case 3:
      return ir;
    case 4:
      return { id: ir.id, raw: ir };
  }
}

function summarizeTokens(tokens: DesignIR["tokens"]): Record<string, number> {
  const summary: Record<string, number> = {};
  if (tokens.color) summary.color = Object.keys(tokens.color).length;
  if (tokens.spacing) summary.spacing = Object.keys(tokens.spacing).length;
  if (tokens.radius) summary.radius = Object.keys(tokens.radius).length;
  if (tokens.typography) summary.typography = Object.keys(tokens.typography).length;
  return summary;
}

export const CONTEXT_LEVEL_NAMES: Record<ContextLevel, string> = {
  0: "summary",
  1: "structure",
  2: "properties",
  3: "full-ir",
  4: "raw",
};
