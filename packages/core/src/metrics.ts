import type { Metrics } from "./types";

/** Local metrics: cache hits/misses, Figma calls, token reduction (US5). */
export class MetricsCollector implements Metrics {
  cacheHits = 0;
  cacheMisses = 0;
  figmaCalls = 0;
  tokensWithoutContext = 0;
  tokensWithContext = 0;

  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  recordFigmaCall(): void {
    this.figmaCalls++;
  }

  recordTokens(fullTokens: number, summaryTokens: number): void {
    this.tokensWithoutContext += fullTokens;
    this.tokensWithContext += summaryTokens;
  }

  get tokenReductionRatio(): number {
    if (this.tokensWithoutContext <= 0) return 0;
    return (
      (this.tokensWithoutContext - this.tokensWithContext) /
      this.tokensWithoutContext
    );
  }

  snapshot(): Metrics {
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      figmaCalls: this.figmaCalls,
      tokensWithoutContext: this.tokensWithoutContext,
      tokensWithContext: this.tokensWithContext,
    };
  }

  reset(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.figmaCalls = 0;
    this.tokensWithoutContext = 0;
    this.tokensWithContext = 0;
  }
}
