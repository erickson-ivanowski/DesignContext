import type { AppContext } from "./runtime";

/** Print changed/added/removed vs. the previous scan, for one file. */
export async function diff(ctx: AppContext, screen: string, fileId: string): Promise<void> {
  const result = await ctx.engine.getChanges(screen, fileId);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
