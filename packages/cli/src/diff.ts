import type { AppContext } from "./runtime";

/** Print changed/added/removed vs. the previous scan. */
export async function diff(ctx: AppContext, screen: string): Promise<void> {
  const result = await ctx.engine.getChanges(screen);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
