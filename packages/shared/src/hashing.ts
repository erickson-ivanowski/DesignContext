import { createHash } from "node:crypto";

/**
 * Volatile/transient keys that must never participate in a content hash
 * (timestamps, last-modified markers, absolute paths, etc.). See data-model.md
 * validation rule: contentHash MUST exclude timestamps and transient properties.
 */
const VOLATILE_KEYS = new Set([
  "lastModified",
  "lastSeenAt",
  "timestamp",
  "createdAt",
  "updatedAt",
  "absolutePath",
  "path",
  "lastModifiedAt",
]);

function stripVolatile(value: unknown, depth = 0): unknown {
  if (depth > 100) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripVolatile(item, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (VOLATILE_KEYS.has(key)) continue;
      out[key] = stripVolatile(val, depth + 1);
    }
    return out;
  }
  return value;
}

/** Canonical JSON serialization: sorted keys, stable arrays, no volatile fields. */
export function canonicalJson(value: unknown): string {
  const clean = stripVolatile(value);
  const sorted = sortKeys(clean);
  return JSON.stringify(sorted);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeys(item));
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sortKeys(v)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

/** SHA-256 hex digest of a value's canonical JSON form. */
export function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

/**
 * Content hash: SHA-256 over the canonicalized node content, excluding
 * volatile fields (timestamps, transient markers).
 */
export function contentHash(node: unknown): string {
  return sha256(node);
}

export interface StructuralProjection {
  type: string;
  children: string[];
  order: number;
  componentId: string | null;
  hierarchy: string[];
}

/**
 * Structural hash: SHA-256 over {type, children, order, componentId, hierarchy}
 * only. Detects structural (not content) changes.
 */
export function structuralHash(
  projection: StructuralProjection,
): string {
  return sha256({
    type: projection.type,
    children: projection.children,
    order: projection.order,
    componentId: projection.componentId ?? null,
    hierarchy: projection.hierarchy,
  });
}
