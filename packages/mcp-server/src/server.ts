import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { z } from "zod";
import { createToolDefinitions, type ToolContext } from "./tools";

function toShape(schema: z.ZodType<unknown>): z.ZodRawShape {
  const anySchema = schema as unknown as { shape?: z.ZodRawShape };
  if (anySchema.shape) return anySchema.shape;
  return {};
}

/**
 * Bootstrap the design-context MCP server over stdio. Exposes the
 * design_get_* / design_find / design_inspect tools.
 */
export async function startServer(ctx: ToolContext): Promise<McpServer> {
  const server = new McpServer({ name: "design-context", version: "0.1.0" });

  for (const tool of createToolDefinitions(ctx)) {
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: toShape(tool.inputSchema),
      },
      async (rawInput) => {
        const input = tool.inputSchema.parse(rawInput);
        const result = await tool.handler(input as never);
        const text =
          typeof result === "string" || Buffer.isBuffer(result)
            ? (typeof result === "string" ? result : result.toString("base64"))
            : JSON.stringify(result, null, 2);
        return { content: [{ type: "text", text }] };
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

export * from "./tools";
