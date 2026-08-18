import os from "node:os";
import path from "node:path";
import type { AgentTarget } from "./types";
import { readJson, writeJson } from "./json-helpers";

/** User-level `~/.claude.json`. Respects CLAUDE_CONFIG_DIR like Claude Code itself. */
function configPath(): string {
  const dir = process.env.CLAUDE_CONFIG_DIR ?? os.homedir();
  return path.join(dir, ".claude.json");
}

export const claudeCode: AgentTarget = {
  id: "claude-code",
  label: "Claude Code",
  configPaths() {
    return [configPath()];
  },
  async install(target) {
    const data = readJson(target);
    const servers =
      data.mcpServers && typeof data.mcpServers === "object"
        ? (data.mcpServers as Record<string, unknown>)
        : {};
    const merged = {
      ...data,
      mcpServers: {
        ...servers,
        "design-context": {
          type: "stdio",
          command: "designcontext",
          args: ["mcp"],
        },
      },
    };
    writeJson(target, merged);
  },
};
