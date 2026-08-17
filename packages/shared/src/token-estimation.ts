/**
 * Approximate token estimation. Uses the common heuristic of ~4 characters per
 * token, which is a reasonable cross-model approximation for planning context
 * budgets. More accurate than word-count for JSON/TS-style content.
 */
export function estimateTokens(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

export interface TokenBudget {
  target: number;
  max: number;
}

export const DEFAULT_BUDGET: TokenBudget = {
  target: 5000,
  max: 12000,
};

export function estimateTokenReduction(
  fullTokens: number,
  summaryTokens: number,
): number {
  if (fullTokens <= 0) return 0;
  const reduction = (fullTokens - summaryTokens) / fullTokens;
  return Math.max(0, Math.min(1, reduction));
}
