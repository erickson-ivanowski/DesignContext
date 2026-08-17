import { loadProjectConfig, saveProjectConfig } from "@designcontext/cache";
import { createLogger } from "@designcontext/shared";
import { storeSecret } from "./secrets";
import { discoverFigmaMcp } from "./figma-discovery";

const logger = createLogger("designcontext:connect");

export interface ConnectOptions {
  token?: string;
  fileId?: string;
  url?: string;
}

/**
 * Configure the Figma connection. Credentials are stored in the OS secret
 * store — never in versioned files. Order of preference:
 *   1. `--url`        → reuse a hosted Figma MCP over HTTP (no token)
 *   2. `--token`      → spawn `figma-developer-mcp` with a stored key
 *   3. (auto)         → discover an already-configured Figma MCP and reuse it
 */
export async function connect(
  projectRoot: string,
  opts: ConnectOptions = {},
): Promise<void> {
  const config = loadProjectConfig(projectRoot);

  if (opts.token) {
    await storeSecret("figma-token", opts.token);
    logger.info("Figma token stored in OS secret store");
  }

  if (opts.fileId) {
    config.figmaFileId = opts.fileId;
  }

  if (opts.url) {
    config.figmaMcpUrl = opts.url;
    config.figmaMcpCommand = undefined;
    config.figmaMcpArgs = undefined;
    config.figmaMcpEnv = undefined;
    logger.info({ url: opts.url }, "using remote Figma MCP server");
  } else if (!opts.token && !config.figmaMcpUrl) {
    const discovered = discoverFigmaMcp(projectRoot);
    if (discovered?.url) {
      config.figmaMcpUrl = discovered.url;
      logger.info({ source: discovered.source }, "reusing remote Figma MCP server");
    } else if (discovered?.command) {
      config.figmaMcpCommand = discovered.command;
      config.figmaMcpArgs = discovered.args ?? [];
      config.figmaMcpEnv = discovered.env ?? {};
      logger.info({ source: discovered.source }, "reusing existing Figma MCP config");
    }
  }

  saveProjectConfig(projectRoot, config);
  logger.info({ fileId: config.figmaFileId }, "Figma connection configured");
}
