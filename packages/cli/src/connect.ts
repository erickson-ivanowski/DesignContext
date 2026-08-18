import type { FigmaFileConfig } from "@designcontext/core";
import { loadProjectConfig, saveProjectConfig } from "@designcontext/cache";
import { createLogger } from "@designcontext/shared";
import { storeSecret } from "./secrets";
import { discoverFigmaMcp } from "./figma-discovery";
import { resolveFigmaAdapter } from "./runtime";
import { resolveFileArg, slugify } from "./figma-url";

const logger = createLogger("designcontext:connect");

export interface ConnectOptions {
  token?: string;
  /** A pasted Figma URL (Share → Copy link) or a bare file key. */
  file?: string;
  alias?: string;
  url?: string;
  /** Register this file with no Figma connection of its own — an AI agent will feed it data via `design_import` instead of designcontext connecting to Figma itself. */
  importOnly?: boolean;
}

export class ConnectError extends Error {}

/**
 * Configure a Figma file connection. Credentials are stored in the OS secret
 * store — never in versioned files. Connection preference, per file:
 *   1. `--url`        → reuse a hosted Figma MCP over HTTP (no token)
 *   2. `--token`      → spawn `figma-developer-mcp` with a stored key
 *   3. (auto)         → discover an already-configured Figma MCP and reuse it
 *
 * Throws `ConnectError` (rather than silently "succeeding") when no `--file`
 * is given, or when no connection method could be resolved at all.
 */
export async function connect(
  projectRoot: string,
  opts: ConnectOptions = {},
): Promise<FigmaFileConfig> {
  if (!opts.file) {
    throw new ConnectError(
      "No Figma file given. Paste a Figma URL: designcontext connect --file <url> [--token <token>]",
    );
  }

  const config = loadProjectConfig(projectRoot);
  const { fileId, nodeId } = resolveFileArg(opts.file);

  if (opts.token) {
    await storeSecret("figma-token", opts.token);
    logger.info("Figma token stored in OS secret store");
  }

  const existing = config.figmaFiles.find((f) => f.fileId === fileId);

  let figmaMcpUrl: string | undefined = existing?.figmaMcpUrl;
  let figmaMcpCommand: string | undefined = existing?.figmaMcpCommand;
  let figmaMcpArgs: string[] | undefined = existing?.figmaMcpArgs;
  let figmaMcpEnv: Record<string, string> | undefined = existing?.figmaMcpEnv;

  if (opts.url) {
    figmaMcpUrl = opts.url;
    figmaMcpCommand = undefined;
    figmaMcpArgs = undefined;
    figmaMcpEnv = undefined;
    logger.info({ url: opts.url }, "using remote Figma MCP server");
  } else if (!opts.token && !figmaMcpUrl) {
    const discovered = discoverFigmaMcp(projectRoot);
    if (discovered?.url) {
      figmaMcpUrl = discovered.url;
      logger.info({ source: discovered.source }, "reusing remote Figma MCP server");
    } else if (discovered?.command) {
      figmaMcpCommand = discovered.command;
      figmaMcpArgs = discovered.args ?? [];
      figmaMcpEnv = discovered.env ?? {};
      logger.info({ source: discovered.source }, "reusing existing Figma MCP config");
    }
  }

  const hasConnection = Boolean(
    figmaMcpUrl || figmaMcpCommand || figmaMcpEnv !== undefined || opts.token,
  );
  if (!hasConnection && !opts.importOnly) {
    throw new ConnectError(
      "No Figma MCP found and no --token/--url given.\n" +
        "Generate a token at https://figma.com/settings → Personal Access Tokens, then run:\n" +
        `  designcontext connect --file ${opts.file} --token <token>\n` +
        "Or, if you'd rather have your AI agent fetch this file's data itself (no token needed):\n" +
        `  designcontext connect --file ${opts.file} --import-only`,
    );
  }

  const draftFileConfig: FigmaFileConfig = {
    fileId,
    alias: existing?.alias ?? opts.alias ?? fileId,
    rootNodes: nodeId
      ? Array.from(new Set([...(existing?.rootNodes ?? []), nodeId]))
      : existing?.rootNodes ?? [],
    figmaMcpUrl,
    figmaMcpCommand,
    figmaMcpArgs,
    figmaMcpEnv,
    importOnly: opts.importOnly ?? existing?.importOnly,
    addedAt: existing?.addedAt ?? new Date().toISOString(),
  };

  let alias = opts.alias ?? existing?.alias;
  if (!alias && !opts.importOnly) {
    alias = await fetchDefaultAlias(draftFileConfig, projectRoot, nodeId);
  }
  alias = dedupeAlias(alias ?? fileId, config.figmaFiles, fileId);

  const fileConfig: FigmaFileConfig = { ...draftFileConfig, alias };

  if (existing) {
    config.figmaFiles = config.figmaFiles.map((f) => (f.fileId === fileId ? fileConfig : f));
  } else {
    config.figmaFiles.push(fileConfig);
  }

  saveProjectConfig(projectRoot, config);
  logger.info({ fileId, alias }, "Figma file connected");
  return fileConfig;
}

/** Best-effort fetch of the Figma file's real name to use as the default alias. Falls back to the file id. */
async function fetchDefaultAlias(
  fileConfig: FigmaFileConfig,
  projectRoot: string,
  nodeId: string | null,
): Promise<string> {
  const requestedNodeId = nodeId ?? "0:0";
  let adapter: Awaited<ReturnType<typeof resolveFigmaAdapter>> | undefined;
  try {
    adapter = await resolveFigmaAdapter(fileConfig, projectRoot);
    const meta = await adapter.getMetadata(requestedNodeId);
    // A broken/unauthenticated connection can return a metadata-shaped payload
    // whose "name" is really just the node id echoed back (see FigmaMcpAdapter's
    // fallback in figma-adapter.ts) rather than throwing — treat that as "no name".
    if (meta.name && meta.name !== requestedNodeId && meta.name !== meta.nodeId) {
      return slugify(meta.name);
    }
  } catch {
    // Connection not ready yet (e.g. token was just stored but MCP needs a fresh process) — fall back below.
  } finally {
    try {
      await adapter?.close?.();
    } catch {
      // Best-effort cleanup; a close failure must not affect the resolved alias.
    }
  }
  return fileConfig.fileId;
}

/** Ensure an alias is unique within the project, suffixing with -2, -3, ... on collision. */
function dedupeAlias(alias: string, files: FigmaFileConfig[], fileId: string): string {
  const taken = new Set(files.filter((f) => f.fileId !== fileId).map((f) => f.alias));
  if (!taken.has(alias)) return alias;
  let n = 2;
  while (taken.has(`${alias}-${n}`)) n++;
  return `${alias}-${n}`;
}
