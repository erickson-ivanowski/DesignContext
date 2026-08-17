import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { FigmaMcpClient } from "./figma-adapter";

/**
 * Base `FigmaMcpClient` that manages the MCP `Client` lifecycle over a
 * pluggable transport (stdio or streamable HTTP). Connects lazily on the
 * first tool call and reuses the connection.
 */
export abstract class McpFigmaClient implements FigmaMcpClient {
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;

  protected abstract createTransport(): Transport;

  private ensureConnected(): Promise<Client> {
    if (this.client) return Promise.resolve(this.client);
    if (!this.connecting) {
      this.connecting = (async () => {
        const transport = this.createTransport();
        const client = new Client({ name: "designcontext", version: "0.1.0" });
        await client.connect(transport);
        this.client = client;
        return client;
      })();
    }
    return this.connecting;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: unknown[] }> {
    const client = await this.ensureConnected();
    const result = (await client.callTool({ name, arguments: args })) as unknown as {
      content?: unknown[];
    };
    return { content: result.content ?? [] };
  }

  async close(): Promise<void> {
    if (this.client) {
      const client = this.client;
      this.client = null;
      await client.close();
    }
  }
}
