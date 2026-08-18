import os from "node:os";
import path from "node:path";
import type { AgentTarget } from "./types";
import { readJson, writeJson, mergeMcpServer } from "./json-helpers";
import { resolveMcpInvocation } from "./invocation";

function configDir(): string {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "Claude");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude");
  }
  return path.join(os.homedir(), ".config", "Claude");
}

export const claudeDesktop: AgentTarget = {
  id: "claude-desktop",
  label: "Claude Desktop",
  configPaths() {
    return [path.join(configDir(), "claude_desktop_config.json")];
  },
  async install(configPath) {
    const data = readJson(configPath);
    const merged = mergeMcpServer(data, "mcpServers", "design-context", { ...resolveMcpInvocation() });
    writeJson(configPath, merged);
  },
};
