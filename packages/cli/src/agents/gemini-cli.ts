import os from "node:os";
import path from "node:path";
import type { AgentTarget } from "./types";
import { readJson, writeJson, mergeMcpServer } from "./json-helpers";

export const geminiCli: AgentTarget = {
  id: "gemini-cli",
  label: "Gemini CLI",
  configPaths() {
    return [path.join(os.homedir(), ".gemini", "settings.json")];
  },
  async install(configPath) {
    const data = readJson(configPath);
    const merged = mergeMcpServer(data, "mcpServers", "design-context", {
      command: "designcontext",
      args: ["mcp"],
    });
    writeJson(configPath, merged);
  },
};
