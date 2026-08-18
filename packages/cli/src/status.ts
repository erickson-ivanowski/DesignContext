import type { FileStatusReport, StatusReport } from "@designcontext/core";
import { graphKey } from "@designcontext/core";
import { estimateTokens } from "@designcontext/shared";
import type { AppContext } from "./runtime";
import { loadProjectConfig } from "@designcontext/cache";

const SCREEN_TYPES = new Set(["SCREEN", "FRAME", "CANVAS"]);
const COMPONENT_TYPES = new Set(["COMPONENT", "INSTANCE", "COMPONENT_SET"]);

/** Compute the status report for a single file. `rootId` is the file's first configured root node, resolved once by the caller. */
async function buildFileStatus(
  ctx: AppContext,
  alias: string,
  fileId: string,
  rootId: string | undefined,
): Promise<FileStatusReport> {
  const nodes = await ctx.graph.all(fileId);
  const screens = nodes.filter((n) => SCREEN_TYPES.has(n.type));
  const components = nodes.filter((n) => n.componentId != null || COMPONENT_TYPES.has(n.type));
  const withTokens = nodes.filter((n) => Object.keys(n.tokens).length > 0);

  const snapshot = rootId ? await ctx.cache.getLatestSnapshot(graphKey(fileId, rootId)) : null;

  return {
    alias,
    fileId,
    screens: screens.length,
    components: components.length,
    tokens: withTokens.length,
    lastScanAt: snapshot?.createdAt ?? null,
    cachedNodes: nodes.length,
  };
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

/** Compute the aggregate project status report, plus a per-file breakdown. */
export async function buildStatus(ctx: AppContext): Promise<StatusReport> {
  const config = loadProjectConfig(ctx.projectRoot);
  const rootIdByFileId = new Map(config.figmaFiles.map((f) => [f.fileId, f.rootNodes[0]]));
  const files = await Promise.all(
    ctx.files.map((f) => buildFileStatus(ctx, f.alias, f.fileId, rootIdByFileId.get(f.fileId))),
  );

  const allNodes = await ctx.graph.all();
  const cacheSizeBytes = allNodes.reduce(
    (sum, n) => sum + estimateTokens(n.irJson ?? n) * 4,
    0,
  );

  const savings = await ctx.cache.getSavings();

  return {
    name: config.name,
    screens: files.reduce((sum, f) => sum + f.screens, 0),
    components: files.reduce((sum, f) => sum + f.components, 0),
    tokens: files.reduce((sum, f) => sum + f.tokens, 0),
    cacheSizeBytes,
    lastScanAt: files.reduce<string | null>(
      (latest, f) => (!latest || (f.lastScanAt && f.lastScanAt > latest) ? f.lastScanAt : latest),
      null,
    ),
    cachedNodes: allNodes.length,
    changedNodes: 0,
    files,
    tokensSaved: {
      withoutContext: savings.tokensWithoutContext,
      withContext: savings.tokensWithContext,
      reductionPercent: pct(
        savings.tokensWithoutContext - savings.tokensWithContext,
        savings.tokensWithoutContext,
      ),
      calls: savings.calls,
    },
    figmaCallsSaved: {
      cacheHits: savings.cacheHits,
      cacheMisses: savings.cacheMisses,
      hitRatePercent: pct(savings.cacheHits, savings.cacheHits + savings.cacheMisses),
    },
  };
}

export async function status(ctx: AppContext): Promise<void> {
  const report = await buildStatus(ctx);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
