export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Lightweight metadata returned by the Figma MCP for a node (metadata-first discovery). */
export interface FigmaMetadata {
  nodeId: string;
  name: string;
  type: string;
  parentId?: string | null;
  children?: string[];
  componentId?: string | null;
  /** Volatile — must never participate in a content hash. */
  lastModified?: string | null;
}

/** Raw design context as returned by the Figma MCP. Loosely typed; normalized into Design IR. */
export type FigmaDesignContext = Record<string, unknown>;

/** Normalized style values for a node (subset used by the MVP). */
export interface TokenSet {
  color?: Record<string, string>;
  spacing?: Record<string, number>;
  radius?: Record<string, number>;
  typography?: Record<string, unknown>;
}

/** Design Intermediate Representation: Figma raw → normalized form. */
export interface DesignIR {
  id: string;
  name: string;
  type: string;
  bounds: Bounds | null;
  children: string[];
  componentId: string | null;
  componentName: string | null;
  properties: Record<string, unknown>;
  tokens: TokenSet;
}

/** A single persisted design element (screen, section, frame, or component). */
export interface DesignNode {
  id: string;
  fileId: string;
  parentId: string | null;
  name: string;
  type: string;
  bounds: Bounds | null;
  children: string[];
  componentId: string | null;
  componentName: string | null;
  properties: Record<string, unknown>;
  tokens: TokenSet;
  contentHash: string;
  structuralHash: string;
  irJson?: unknown;
  rawContext?: unknown | null;
  lastSeenAt: string;
}

export type ChangeKind = "content" | "structural" | "added" | "removed";

export interface ChangeRecord {
  nodeId: string;
  name: string;
  before: unknown;
  after: unknown;
  kind: ChangeKind;
}

export interface DiffResult {
  scope: string;
  changed: ChangeRecord[];
  added: string[];
  removed: string[];
  unchanged: string[];
}

/** Progressive context levels: 0 summary … 4 raw. */
export type ContextLevel = 0 | 1 | 2 | 3 | 4;

export interface ContextResult {
  nodeId: string;
  level: ContextLevel;
  content: unknown;
  tokenCount: number;
  references?: string[];
}

/** One Figma file tracked by a project. A project may track several. */
export interface FigmaFileConfig {
  fileId: string;
  /** Short handle used to refer to this file in the CLI and MCP tools — unique per project. */
  alias: string;
  rootNodes: string[];
  figmaMcpCommand?: string;
  figmaMcpArgs?: string[];
  figmaMcpEnv?: Record<string, string>;
  figmaMcpUrl?: string;
  addedAt: string;
}

export interface ProjectConfig {
  name: string;
  figmaFiles: FigmaFileConfig[];
  framework: string;
  language: string;
  sourceDirectory: string;
  componentDirectory: string;
  configVersion: 2;
}

export interface ScanReport {
  discovered: number;
  cached: number;
  changed: number;
  indexed: number;
  fullScan: boolean;
}

export interface FileStatusReport {
  alias: string;
  fileId: string;
  screens: number;
  components: number;
  tokens: number;
  lastScanAt: string | null;
  cachedNodes: number;
}

export interface StatusReport {
  name: string;
  screens: number;
  components: number;
  tokens: number;
  cacheSizeBytes: number;
  lastScanAt: string | null;
  cachedNodes: number;
  changedNodes: number;
  files: FileStatusReport[];
}

export interface Metrics {
  cacheHits: number;
  cacheMisses: number;
  figmaCalls: number;
  tokensWithoutContext: number;
  tokensWithContext: number;
}

export const CONTEXT_LEVELS: Record<ContextLevel, string> = {
  0: "summary",
  1: "structure",
  2: "properties",
  3: "full-ir",
  4: "raw",
};
