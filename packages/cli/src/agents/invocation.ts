import { spawnSync } from "node:child_process";

export interface McpInvocation {
  command: string;
  args: string[];
}

let cached: McpInvocation | null = null;

/**
 * `where`/`which` can resolve to a temporary shim npx puts on PATH for the duration of
 * `npx designcontext ...` itself — that shim disappears once the process exits, so a
 * config built from it (bare `designcontext`) would work during `setup` but fail the
 * next time an agent actually starts the MCP server. Filter those out; only a hit
 * outside npx's cache dirs counts as a real, persistent global install.
 */
export function isNpxShimPath(resolvedPath: string): boolean {
  return /[\\/]_npx[\\/]/i.test(resolvedPath);
}

/** True when `designcontext` resolves on PATH to a real, persistent binary (e.g. installed with `npm install -g`) — not a transient npx shim. */
function hasGlobalBinary(): boolean {
  const checkCmd = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checkCmd, ["designcontext"], { encoding: "utf8", shell: true });
  if (result.status !== 0 || !result.stdout) return false;
  const paths = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return paths.some((p) => !isNpxShimPath(p));
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
