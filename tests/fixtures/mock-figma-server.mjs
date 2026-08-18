import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Emulates `figma-developer-mcp`'s current API: get_figma_data returns a whole subtree
// in one call, as a custom compact YAML-like text format (not JSON) — see
// packages/figma-adapter/src/parse-figma-data.ts for the real format this mirrors.
const FIGMA_DATA_RESPONSE = `NAME: "Checkout"

GLOBAL_VARS:
fill_submit:
  - '#0080FF'

ELEMENTS:

COMPONENTS:
c:submit:
  id: c:submit
  key: submit-component-key
  name: Submit

COMPONENT_SETS:

NODES:
[FRAME] "Checkout" #0:1 layout={"mode":"column","sizing":{},"dimensions":{"width":375,"height":812}} componentProperties={"layoutMode":"VERTICAL"}
  [FRAME] "Payment" #0:2 layout={"mode":"row","sizing":{},"dimensions":{"width":343,"height":200}} componentProperties={"layoutMode":"HORIZONTAL"}
  [COMPONENT] "Submit" #0:3 componentId=c:submit fills=fill_submit componentProperties={"label":"Pay now"}
`;

const server = new Server({ name: "mock-figma", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_figma_data",
      description: "figma data",
      inputSchema: {
        type: "object",
        properties: { fileKey: { type: "string" }, nodeId: { type: "string" }, depth: { type: "number" } },
      },
    },
    {
      name: "download_figma_images",
      description: "images",
      inputSchema: { type: "object", properties: {} },
    },
    // Legacy tool, kept so FigmaMcpAdapter.getScreenshot's fallback path stays exercised.
    { name: "get_screenshot", description: "screenshot", inputSchema: { type: "object", properties: { nodeId: { type: "string" } } } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  if (name === "get_figma_data") {
    return { content: [{ type: "text", text: FIGMA_DATA_RESPONSE }] };
  }
  if (name === "get_screenshot") {
    return { content: [{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }] };
  }
  return { content: [{ type: "text", text: "{}" }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
