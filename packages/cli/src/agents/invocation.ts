import { spawnSync } from "node:child_process";

export interface McpInvocation {
  command: string;
  args: string[];
}

let cached: McpInvocation | null = null;

/** True when `designcontext` resolves on PATH (e.g. installed with `npm install -g`). */
function hasGlobalBinary(): boolean {
  const checkCmd = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checkCmd, ["designcontext"], { stdio: "ignore", shell: true });
  return result.status === 0;
}

/**
 * How an agent config should invoke DesignContext's MCP server. Prefers the global
 * binary; falls back to `npx` when it's not on PATH (e.g. installed without `-g`, or
 * blocked by missing global-install permissions) so `setup` still produces a working
 * config instead of one that fails with "command not found".
 */
export function resolveMcpInvocation(): McpInvocation {
  if (cached) return cached;
  cached = hasGlobalBinary()
    ? { command: "designcontext", args: ["mcp"] }
    : { command: "npx", args: ["-y", "designcontext", "mcp"] };
  return cached;
}
