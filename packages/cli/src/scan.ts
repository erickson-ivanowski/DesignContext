import { createLogger } from "@designcontext/shared";
import type { AppContext } from "./runtime";
import { writeAgentConfig } from "./agent-config";

const logger = createLogger("designcontext:scan");

export interface ScanOptions {
  node?: string;
  incremental?: boolean;
  configDir?: string;
}

/**
 * Index a scope. First run = full scan; later runs = incremental (only changed
 * nodes). Reports discovered/cached/changed counts and emits the agent config.
 */
export async function scan(
  ctx: AppContext,
  scopeNodeId: string,
  opts: ScanOptions = {},
): Promise<void> {
  const report = opts.incremental
    ? await ctx.indexer.incrementalScan(scopeNodeId)
    : await ctx.indexer.fullScan(scopeNodeId);

  logger.info(
    {
      discovered: report.discovered,
      cached: report.cached,
      changed: report.changed,
      indexed: report.indexed,
      fullScan: report.fullScan,
    },
    "scan complete",
  );

  // Human-readable report to stdout.
  const mode = report.fullScan ? "full" : "incremental";
  process.stdout.write(
    `Scan (${mode}): ${report.discovered} discovered, ${report.indexed} indexed, ` +
      `${report.changed} changed, ${report.cached} cached\n`,
  );

  if (opts.configDir) {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dest = path.join(opts.configDir, "mcp.json");
    writeAgentConfig(dest);
    void fs;
    process.stdout.write(`Agent MCP config written to ${dest}\n`);
  }
}
