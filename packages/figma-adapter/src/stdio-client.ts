import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { McpFigmaClient } from "./mcp-client";

export interface StdioFigmaOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * A `FigmaMcpClient` that talks to the Figma MCP server as a child process
 * over stdio (the transport used by `npx figma-developer-mcp --stdio`).
 */
export class StdioFigmaClient extends McpFigmaClient {
  constructor(private readonly options: StdioFigmaOptions) {
    super();
  }

  protected createTransport(): Transport {
    return new StdioClientTransport({
      command: this.options.command,
      args: this.options.args ?? [],
      env: this.options.env,
      cwd: this.options.cwd,
    });
  }
}
