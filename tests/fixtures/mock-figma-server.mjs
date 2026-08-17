import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const nodes = {
  "0:1": { name: "Checkout", type: "FRAME", children: ["0:2", "0:3"], componentId: null, lastModified: "v1" },
  "0:2": { name: "Payment", type: "FRAME", children: [], componentId: null, lastModified: "v1" },
  "0:3": { name: "Submit", type: "COMPONENT", children: [], componentId: "c:submit", lastModified: "v1" },
};

const contexts = {
  "0:1": {
    name: "Checkout",
    type: "FRAME",
    bounds: { x: 0, y: 0, width: 375, height: 812 },
    children: [{ id: "0:2", name: "Payment" }, { id: "0:3", name: "Submit" }],
    properties: { layoutMode: "VERTICAL" },
  },
  "0:2": {
    name: "Payment",
    type: "FRAME",
    bounds: { x: 16, y: 16, width: 343, height: 200 },
    children: [],
    properties: { layoutMode: "HORIZONTAL" },
  },
  "0:3": {
    name: "Submit",
    type: "COMPONENT",
    componentId: "c:submit",
    componentName: "Submit",
    children: [],
    properties: { label: "Pay now" },
    color: { r: 0, g: 0.5, b: 1, a: 1 },
  },
};

const server = new Server({ name: "mock-figma", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "get_metadata", description: "metadata", inputSchema: { type: "object", properties: { nodeId: { type: "string" } } } },
    { name: "get_design_context", description: "context", inputSchema: { type: "object", properties: { nodeId: { type: "string" } } } },
    { name: "get_screenshot", description: "screenshot", inputSchema: { type: "object", properties: { nodeId: { type: "string" } } } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const nodeId = String(args?.nodeId ?? "");
  if (name === "get_metadata") {
    const data = nodes[nodeId] ?? { name: nodeId, type: "FRAME", children: [] };
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
  if (name === "get_design_context") {
    const data = contexts[nodeId] ?? { name: nodeId, type: "FRAME", children: [], properties: {} };
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
  if (name === "get_screenshot") {
    return { content: [{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }] };
  }
  return { content: [{ type: "text", text: "{}" }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
