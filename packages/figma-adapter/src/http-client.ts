import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { McpFigmaClient } from "./mcp-client";

/**
 * A `FigmaMcpClient` that connects to an already-running/hosted Figma MCP
 * server over Streamable HTTP — no token handling required by the user.
 */
export class HttpFigmaClient extends McpFigmaClient {
  constructor(private readonly url: string) {
    super();
  }

  protected createTransport(): Transport {
    return new StreamableHTTPClientTransport(new URL(this.url));
  }
}
