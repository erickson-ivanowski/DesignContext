import {
  estimateTokens,
  DEFAULT_BUDGET,
  type TokenBudget,
} from "@designcontext/shared";

export interface OptimizedContext {
  content: unknown;
  tokenCount: number;
  /** Token cost of `content` before any stripping — what an agent would have paid without this tool. */
  fullTokenCount: number;
  truncated: boolean;
  references: string[];
}

/**
 * Minimum-sufficient context. Starts from the assembled content, then strips
 * progressively heavier fields (raw → properties → children) until it fits the
 * target budget. Anything dropped becomes a reference the agent can request.
 */
export function optimize(
  content: unknown,
  budget: TokenBudget = DEFAULT_BUDGET,
): OptimizedContext {
  const references: string[] = [];
  const fullTokenCount = estimateTokens(content);
  let working = deepClone(content);

  const measure = () => estimateTokens(working);
  let tokenCount = measure();

  if (tokenCount <= budget.target) {
    return { content: working, tokenCount, fullTokenCount, truncated: false, references };
  }

  // 1) Drop raw context (always reference-able, level-4).
  working = stripKey(working, "rawContext", references, "node");

  // 2) Replace heavy property maps with a count.
  working = replaceKeyWithCount(working, "properties", "propertyCount", references, "component");

  // 3) Replace child arrays with a count.
  working = replaceKeyWithCount(working, "children", "childCount", references, "node");

  tokenCount = measure();
  const truncated = tokenCount > budget.target;

  // Final guard: if still over the hard max, collapse to a summary.
  if (tokenCount > budget.max) {
    working = collapseToSummary(content);
    tokenCount = estimateTokens(working);
  }

  return { content: working, tokenCount, fullTokenCount, truncated, references };
}

function deepClone(value: unknown): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stripKey(
  value: unknown,
  key: string,
  references: string[],
  refKind: string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => stripKey(v, key, references, refKind));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === key) {
        if (v != null) references.push(`${refKind}:${refOf(value)}`);
        continue;
      }
      out[k] = stripKey(v, key, references, refKind);
    }
    return out;
  }
  return value;
}

function replaceKeyWithCount(
  value: unknown,
  key: string,
  countKey: string,
  references: string[],
  refKind: string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => replaceKeyWithCount(v, key, countKey, references, refKind));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === key) {
        if (Array.isArray(v)) {
          out[countKey] = v.length;
          for (const item of v.slice(0, 3)) {
            if (isPlainObject(item) && typeof item.id === "string") {
              references.push(`${refKind}:${item.id}`);
            }
          }
        } else if (v !== null && typeof v === "object") {
          out[countKey] = Object.keys(v).length;
        } else {
          out[k] = v;
        }
        continue;
      }
      out[k] = replaceKeyWithCount(v, key, countKey, references, refKind);
    }
    return out;
  }
  return value;
}

function refOf(value: Record<string, unknown>): string {
  return String(value.id ?? value.name ?? value.nodeId ?? "unknown");
}

function collapseToSummary(content: unknown): unknown {
  if (isPlainObject(content)) {
    return {
      name: content.name ?? content.screen ?? "scope",
      type: content.type ?? "summary",
      summary: "Context exceeds the maximum budget; request a narrower scope.",
    };
  }
  return { summary: "Context exceeds the maximum budget; request a narrower scope." };
}
