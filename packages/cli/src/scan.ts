import type { ScanReport } from "@designcontext/core";
import { createLogger } from "@designcontext/shared";
import type { FileRuntime } from "./runtime";
import { writeAgentConfig } from "./agent-config";

const logger = createLogger("designcontext:scan");

export interface ScanOptions {
  node?: string;
  incremental?: boolean;
  configDir?: string;
}

/**
 * Index one file's scope. First run = full scan; later runs = incremental
 * (only changed nodes). Reports discovered/cached/changed counts.
 */
export async function scanFile(
  file: FileRuntime,
  scopeNodeId: string,
  opts: Pick<ScanOptions, "incremental"> = {},
): Promise<ScanReport> {
  const report = opts.incremental
    ? await file.indexer.incrementalScan(scopeNodeId)
    : await file.indexer.fullScan(scopeNodeId);

  logger.info(
    {
      alias: file.alias,
      discovered: report.discovered,
      cached: report.cached,
      changed: report.changed,
      indexed: report.indexed,
      fullScan: report.fullScan,
    },
    "scan complete",
  );

  const mode = report.fullScan ? "full" : "incremental";
  process.stdout.write(
    `[${file.alias}] Scan (${mode}): ${report.discovered} discovered, ${report.indexed} indexed, ` +
      `${report.changed} changed, ${report.cached} cached\n`,
  );

  return report;
}

export async function maybeWriteAgentConfig(configDir?: string): Promise<void> {
  if (!configDir) return;
  const path = await import("node:path");
  const dest = path.join(configDir, "mcp.json");
  writeAgentConfig(dest);
  process.stdout.write(`Agent MCP config written to ${dest}\n`);
}
