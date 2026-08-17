import fs from "node:fs";
import path from "node:path";

export interface AgentMcpConfig {
  mcpServers: Record<string, { command: string; args: string[] }>;
}

/** Generate the agent MCP config so agents can connect to the design-context server. */
export function generateAgentConfig(): AgentMcpConfig {
  return {
    mcpServers: {
      "design-context": {
        command: "designcontext",
        args: ["mcp"],
      },
    },
  };
}

/** Persist the agent MCP config to a JSON file. */
export function writeAgentConfig(dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(generateAgentConfig(), null, 2), "utf-8");
}
