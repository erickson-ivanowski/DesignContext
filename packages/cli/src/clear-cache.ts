import { createLogger } from "@designcontext/shared";
import type { AppContext } from "./runtime";

const logger = createLogger("designcontext:clear-cache");

/** Remove cached blobs and index data (keeps project config). Scoped to one file when `fileId` is given. */
export async function clearCache(ctx: AppContext, fileId?: string): Promise<void> {
  await ctx.cache.clear(fileId);
  await ctx.graph.clear(fileId);
  logger.info({ fileId }, "cache cleared");
  process.stdout.write(fileId ? `Cache cleared for ${fileId}.\n` : "Cache cleared.\n");
}
