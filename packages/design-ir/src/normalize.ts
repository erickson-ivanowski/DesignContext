import type {
  Bounds,
  DesignIR,
  FigmaDesignContext,
  TokenSet,
} from "@designcontext/core";

function firstDefined(...values: unknown[]): unknown {
  return values.find((v) => v !== undefined && v !== null);
}

function extractBounds(raw: FigmaDesignContext): Bounds | null {
  const abs = raw.absoluteBoundingBox as
    | { x: number; y: number; width: number; height: number }
    | undefined;
  const rel = raw.bounds as Bounds | undefined;
  // `get_figma_data`'s ParsedFigmaNode shape: dimensions (and sometimes location) live
  // under `layout`, not top-level — no x/y is provided at all, default to origin.
  const layout = raw.layout as
    | { dimensions?: { width?: number; height?: number }; locationRelativeToParent?: { x?: number; y?: number } }
    | undefined;
  const fromLayout: Bounds | undefined = layout?.dimensions
    ? {
        x: layout.locationRelativeToParent?.x ?? 0,
        y: layout.locationRelativeToParent?.y ?? 0,
        width: layout.dimensions.width ?? 0,
        height: layout.dimensions.height ?? 0,
      }
    : undefined;
  const box = (abs ?? rel ?? fromLayout) as Bounds | undefined;
  if (!box || typeof box.width !== "number") return null;
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

function extractChildren(raw: FigmaDesignContext): string[] {
  const children = raw.children as unknown;
  if (Array.isArray(children)) {
    return children.map((c) => {
      if (typeof c === "string") return c;
      if (c && typeof c === "object") {
        return (c as { id?: string }).id ?? (c as { nodeId?: string }).nodeId ?? "";
      }
      return "";
    }).filter(Boolean);
  }
  return [];
}

function extractProperties(raw: FigmaDesignContext): Record<string, unknown> {
  const properties = firstDefined(raw.properties, raw.props, raw.componentProperties, {});
  if (properties && typeof properties === "object") {
    return { ...(properties as Record<string, unknown>) };
  }
  return {};
}

/** Normalize the relevant style values into a TokenSet. */
export function extractTokens(raw: FigmaDesignContext): TokenSet {
  const fills = raw.fills as unknown;
  const color = firstDefined(raw.color, raw.fill, undefined);
  const tokens: TokenSet = {};
  if (color && typeof color === "object") {
    const c = color as Record<string, unknown>;
    tokens.color = {
      r: String(c.r ?? c.red ?? 0),
      g: String(c.g ?? c.green ?? 0),
      b: String(c.b ?? c.blue ?? 0),
      a: String(c.a ?? c.alpha ?? 1),
    };
  } else if (Array.isArray(fills) && fills.length > 0 && typeof fills[0] === "object") {
    const f = fills[0] as Record<string, unknown>;
    const fc = f.color as Record<string, unknown> | undefined;
    if (fc) {
      tokens.color = {
        r: String(fc.r ?? 0),
        g: String(fc.g ?? 0),
        b: String(fc.b ?? 0),
        a: String(fc.a ?? 1),
      };
    }
  } else {
    // `get_figma_data`'s resolved fills: a hex string, or an array of hex strings
    // (GLOBAL_VARS color entries are `['#RRGGBB']`-shaped).
    const hex = typeof fills === "string" ? fills : Array.isArray(fills) ? fills[0] : undefined;
    if (typeof hex === "string") {
      tokens.color = { hex };
    }
  }
  const typography = firstDefined(raw.typography, raw.style, undefined);
  if (typography && typeof typography === "object") {
    tokens.typography = { ...(typography as Record<string, unknown>) };
  }
  return tokens;
}

/**
 * Normalize raw Figma context into Design IR. Defensive against the varied
 * shapes returned by the Figma MCP; never throws on missing fields.
 */
export function normalize(
  nodeId: string,
  raw: FigmaDesignContext,
  _fileId: string,
): DesignIR {
  const name = String(firstDefined(raw.name, raw.nodeName, nodeId));
  const type = String(firstDefined(raw.type, "FRAME"));
  return {
    id: nodeId,
    name,
    type,
    bounds: extractBounds(raw),
    children: extractChildren(raw),
    componentId: (firstDefined(raw.componentId, null) as string | null) ?? null,
    componentName: (firstDefined(raw.componentName, null) as string | null) ?? null,
    properties: extractProperties(raw),
    tokens: extractTokens(raw),
  };
}
