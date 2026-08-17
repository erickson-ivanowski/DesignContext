import type { DesignNode, TokenSet } from "@designcontext/core";

/** Merge tokens from a set of nodes into a single scoped token set. */
export function extractScopeTokens(nodes: DesignNode[]): TokenSet {
  const color: Record<string, string> = {};
  const spacing: Record<string, number> = {};
  const radius: Record<string, number> = {};
  const typography: Record<string, unknown> = {};

  for (const node of nodes) {
    if (node.tokens.color) Object.assign(color, node.tokens.color);
    if (node.tokens.spacing) Object.assign(spacing, node.tokens.spacing);
    if (node.tokens.radius) Object.assign(radius, node.tokens.radius);
    if (node.tokens.typography) Object.assign(typography, node.tokens.typography);
  }

  const tokens: TokenSet = {};
  if (Object.keys(color).length) tokens.color = color;
  if (Object.keys(spacing).length) tokens.spacing = spacing;
  if (Object.keys(radius).length) tokens.radius = radius;
  if (Object.keys(typography).length) tokens.typography = typography;
  return tokens;
}
