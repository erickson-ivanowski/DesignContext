export interface ParsedFigmaUrl {
  fileId: string;
  nodeId: string | null;
}

/**
 * Parse a pasted Figma URL (e.g. from Share → Copy link) into a file key and
 * optional node id. Figma URLs look like:
 *   https://www.figma.com/design/<fileKey>/<name>?node-id=155-1282&...
 *   https://www.figma.com/file/<fileKey>/<name>?node-id=155-1282&...
 * The `node-id` query param uses a dash (`155-1282`); Figma node ids use a
 * colon (`155:1282`) everywhere else in this codebase, so it's normalized here.
 */
export function parseFigmaUrl(input: string): ParsedFigmaUrl | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!/(^|\.)figma\.com$/.test(url.hostname)) return null;

  const match = url.pathname.match(/\/(?:design|file|proto)\/([^/]+)/);
  if (!match) return null;
  const fileId = match[1];

  const rawNodeId = url.searchParams.get("node-id");
  const nodeId = rawNodeId ? rawNodeId.replace(/-/g, ":") : null;

  return { fileId, nodeId };
}

/**
 * Resolve a `--file` CLI argument that may be a pasted Figma URL or a bare
 * file key (back-compat / scripting). Bare file keys have no node id.
 */
export function resolveFileArg(input: string): ParsedFigmaUrl {
  const parsed = parseFigmaUrl(input);
  if (parsed) return parsed;
  return { fileId: input, nodeId: null };
}

/** Turn an arbitrary string (typically a Figma file name) into a CLI/alias-friendly slug. */
export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "file";
}
