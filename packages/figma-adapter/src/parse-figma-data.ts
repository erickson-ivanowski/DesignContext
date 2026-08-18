import * as yaml from "js-yaml";

export interface ParsedFigmaNode {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
  children: string[];
  layout?: Record<string, unknown>;
  fills?: unknown;
  strokes?: unknown;
  componentId?: string;
  componentProperties?: Record<string, unknown>;
  text?: string;
  borderRadius?: string;
}

export interface ParsedComponent {
  id: string;
  name: string;
  componentSetId?: string;
}

export interface ParsedFigmaData {
  name: string;
  nodes: Map<string, ParsedFigmaNode>;
  components: Map<string, ParsedComponent>;
}

type SectionName = "NAME" | "GLOBAL_VARS" | "ELEMENTS" | "COMPONENTS" | "COMPONENT_SETS" | "NODES";
const SECTION_HEADERS: SectionName[] = ["NAME", "GLOBAL_VARS", "ELEMENTS", "COMPONENTS", "COMPONENT_SETS", "NODES"];

/** Split the response into its labeled sections, keyed by header name, body text only. */
function splitSections(text: string): Partial<Record<SectionName, string>> {
  const lines = text.split("\n");
  const sections: Partial<Record<SectionName, string>> = {};
  let current: SectionName | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (current) sections[current] = buf.join("\n");
    buf = [];
  };

  for (const line of lines) {
    const header = SECTION_HEADERS.find((h) => line === `${h}:` || line.startsWith(`${h}: `));
    if (header) {
      flush();
      current = header;
      // "NAME:" carries its value inline (e.g. `NAME: "Foo"`), everything else is a block header.
      const inline = line.slice(header.length + 1).trim();
      buf = inline ? [inline] : [];
      continue;
    }
    if (current) buf.push(line);
  }
  flush();
  return sections;
}

/** Resolve a raw ELEMENTS/NODES field value: a plain string that matches a GLOBAL_VARS key
 * is a reference — substitute it. Anything else (inline object, hex string/array, etc.) passes through. */
function resolveGlobalVar(value: unknown, globalVars: Record<string, unknown>): unknown {
  if (typeof value === "string" && Object.prototype.hasOwnProperty.call(globalVars, value)) {
    return globalVars[value];
  }
  return value;
}

const RESOLVABLE_KEYS = ["layout", "fills", "strokes"] as const;

function resolveElement(
  raw: Record<string, unknown>,
  globalVars: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = { ...raw };
  for (const key of RESOLVABLE_KEYS) {
    if (key in resolved) resolved[key] = resolveGlobalVar(resolved[key], globalVars);
  }
  return resolved;
}

/** Parse a single `key=value` attribute from a NODES line's trailing attribute list. Value is
 * JSON when it looks like one (`{...}`/`[...]`), otherwise a bare comma-list or plain string. */
function parseAttrValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  if (trimmed.includes(",")) {
    return trimmed.split(",").map((s) => s.trim());
  }
  return trimmed;
}

/** Split a NODES attribute tail into `key=value` pairs, respecting `{...}`/`[...]` spans that may contain spaces. */
function splitAttrs(tail: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  let i = 0;
  while (i < tail.length) {
    while (i < tail.length && tail[i] === " ") i++;
    const eq = tail.indexOf("=", i);
    if (eq === -1) break;
    const key = tail.slice(i, eq);
    let j = eq + 1;
    if (tail[j] === "{" || tail[j] === "[") {
      const open = tail[j];
      const close = open === "{" ? "}" : "]";
      let depth = 0;
      let inString = false;
      for (; j < tail.length; j++) {
        const c = tail[j];
        if (c === '"' && tail[j - 1] !== "\\") inString = !inString;
        if (inString) continue;
        if (c === open) depth++;
        else if (c === close) {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
      }
    } else {
      const next = tail.indexOf(" ", j);
      j = next === -1 ? tail.length : next;
      // A comma-list value (e.g. `strokeDashes=6,6`) has no spaces — j already lands correctly.
    }
    const value = tail.slice(eq + 1, j);
    pairs.push([key, value]);
    i = j;
  }
  return pairs;
}

const NODE_LINE_RE = /^(\s*)\[([A-Z_]+)\]\s+"((?:[^"\\]|\\.)*)"\s+#(\S+)(.*)$/;

/** Parse the NODES section's indent-coded tree into flat ParsedFigmaNode entries. */
function parseNodesSection(
  body: string,
  elements: Map<string, Record<string, unknown>>,
  globalVars: Record<string, unknown>,
): Map<string, ParsedFigmaNode> {
  const nodes = new Map<string, ParsedFigmaNode>();
  const stack: Array<{ indent: number; id: string }> = [];

  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    const match = line.match(NODE_LINE_RE);
    if (!match) continue;
    const [, indentStr, type, name, id, tail] = match;
    const indent = indentStr.length;

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parentId = stack.length > 0 ? stack[stack.length - 1].id : null;

    let fields: Record<string, unknown> = {};
    const templateMatch = tail.match(/template=(\S+)/);
    if (templateMatch) {
      const el = elements.get(templateMatch[1]);
      if (el) fields = { ...el };
    } else {
      const rest = tail.replace(/^\s*/, "");
      for (const [key, rawValue] of splitAttrs(rest)) {
        fields[key] = resolveGlobalVar(parseAttrValue(rawValue), globalVars);
      }
    }

    const node: ParsedFigmaNode = {
      id,
      type,
      name: name.replace(/\\"/g, '"'),
      parentId,
      children: [],
      layout: fields.layout as Record<string, unknown> | undefined,
      fills: fields.fills,
      strokes: fields.strokes,
      componentId: fields.componentId as string | undefined,
      componentProperties: fields.componentProperties as Record<string, unknown> | undefined,
      text: fields.text as string | undefined,
      borderRadius: fields.borderRadius as string | undefined,
    };
    nodes.set(id, node);
    if (parentId) nodes.get(parentId)?.children.push(id);
    stack.push({ indent, id });
  }

  return nodes;
}

/** Parse a `get_figma_data` tool response (a custom compact YAML-like text format, not JSON). */
export function parseFigmaDataResponse(text: string): ParsedFigmaData {
  const sections = splitSections(text);

  const nameLine = (sections.NAME ?? "").trim();
  const name = nameLine.replace(/^"(.*)"$/, "$1");

  const globalVars = (sections.GLOBAL_VARS ? (yaml.load(sections.GLOBAL_VARS) as Record<string, unknown>) : {}) ?? {};

  const rawElements = (sections.ELEMENTS ? (yaml.load(sections.ELEMENTS) as Record<string, unknown>) : {}) ?? {};
  const elements = new Map<string, Record<string, unknown>>();
  for (const [key, value] of Object.entries(rawElements)) {
    elements.set(key, resolveElement(value as Record<string, unknown>, globalVars));
  }

  const rawComponents =
    (sections.COMPONENTS ? (yaml.load(sections.COMPONENTS) as Record<string, unknown>) : {}) ?? {};
  const components = new Map<string, ParsedComponent>();
  for (const [id, value] of Object.entries(rawComponents)) {
    const c = value as Record<string, unknown>;
    components.set(id, {
      id,
      name: String(c.name ?? id),
      componentSetId: c.componentSetId as string | undefined,
    });
  }

  const nodes = sections.NODES ? parseNodesSection(sections.NODES, elements, globalVars) : new Map();

  return { name, nodes, components };
}
