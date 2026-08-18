import path from "node:path";
import type { AgentTarget } from "./types";
import { readJson, writeJson } from "./json-helpers";
import { resolveMcpInvocation } from "./invocation";

/** opencode reads project-level `opencode.json` from the current working directory. */
export const opencode: AgentTarget = {
  id: "opencode",
  label: "opencode",
  configPaths() {
    return [path.join(process.cwd(), "opencode.json")];
  },
  async install(configPath) {
    const { command, args } = resolveMcpInvocation();
    const data = readJson(configPath);
    const servers =
      data.mcp && typeof data.mcp === "object" ? (data.mcp as Record<string, unknown>) : {};
    const merged = {
      ...data,
      mcp: {
        ...servers,
        "design-context": {
          type: "local",
          command: [command, ...args],
          enabled: true,
        },
      },
    };
    writeJson(configPath, merged);
  },
};
