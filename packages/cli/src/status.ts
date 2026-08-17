import type { StatusReport } from "@designcontext/core";
import { estimateTokens } from "@designcontext/shared";
import type { AppContext } from "./runtime";
import { loadProjectConfig } from "@designcontext/cache";

const SCREEN_TYPES = new Set(["SCREEN", "FRAME", "CANVAS"]);
const COMPONENT_TYPES = new Set(["COMPONENT", "INSTANCE", "COMPONENT_SET"]);

/** Compute the project status report. */
export async function buildStatus(ctx: AppContext): Promise<StatusReport> {
  const nodes = await ctx.graph.all();
  const screens = nodes.filter((n) => SCREEN_TYPES.has(n.type)).map((n) => n.name);
  const components = nodes.filter(
    (n) => n.componentId != null || COMPONENT_TYPES.has(n.type),
  );
  const withTokens = nodes.filter(
    (n) => Object.keys(n.tokens).length > 0,
  );

  const config = loadProjectConfig(ctx.projectRoot);
  const snapshot = await ctx.cache.getLatestSnapshot(ctx.fileId);
  const lastScanAt = snapshot?.createdAt ?? null;

  const cacheSizeBytes = nodes.reduce(
    (sum, n) => sum + estimateTokens(n.irJson ?? n) * 4,
    0,
  );

  return {
    name: config.name,
    screens: screens.length,
    components: components.length,
    tokens: withTokens.length,
    cacheSizeBytes,
    lastScanAt,
    cachedNodes: nodes.length,
    changedNodes: 0,
  };
}

export async function status(ctx: AppContext): Promise<void> {
  const report = await buildStatus(ctx);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
