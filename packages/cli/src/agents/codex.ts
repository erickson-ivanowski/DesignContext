import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { parse, stringify } from "smol-toml";
import type { AgentTarget } from "./types";

export const codex: AgentTarget = {
  id: "codex",
  label: "OpenAI Codex",
  configPaths() {
    return [path.join(os.homedir(), ".codex", "config.toml")];
  },
  async install(configPath) {
    const raw = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf-8").trim() : "";
    const data = raw ? (parse(raw) as Record<string, unknown>) : {};
    const servers =
      data.mcp_servers && typeof data.mcp_servers === "object"
        ? (data.mcp_servers as Record<string, unknown>)
        : {};
    const merged = {
      ...data,
      mcp_servers: {
        ...servers,
        "design-context": {
          command: "designcontext",
          args: ["mcp"],
        },
      },
    };
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, stringify(merged) + "\n");
  },
};
