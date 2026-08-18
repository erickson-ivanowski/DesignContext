import type {
  DesignIR,
  DesignNode,
  DiffResult,
  ContextResult,
  FigmaDesignContext,
  FigmaMetadata,
  ScanReport,
} from "./types";

/** Source of design data; implemented by figma-adapter. */
export interface DesignSource {
  getMetadata(nodeId: string): Promise<unknown>;
  getContext(nodeId: string): Promise<unknown>;
  getScreenshot(nodeId: string): Promise<Buffer>;
}

/** Content-addressable cache; implemented by cache. */
export interface CacheStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  invalidate(key: string): Promise<void>;
  clear(fileId?: string): Promise<void>;
}

/**
 * In-memory + persisted node graph; implemented by design-graph. Node ids
 * passed to `getNode`/`getChildren`/`upsert` are composite `graphKey(fileId, nodeId)`
 * strings — bare Figma node ids are only unique within one file.
 */
export interface DesignGraph {
  getNode(compositeId: string): Promise<DesignNode | null>;
  getChildren(compositeId: string): Promise<DesignNode[]>;
  upsert(node: DesignNode): Promise<void>;
  all(fileId?: string): Promise<DesignNode[]>;
  search(query: string, fileId?: string): Promise<DesignNode[]>;
  clear(fileId?: string): Promise<void>;
  listFileIds(): Promise<string[]>;
}

/** Minimum-sufficient context assembly; implemented by context-engine. */
export interface ContextEngine {
  getScreen(id: string, fileId?: string): Promise<ContextResult>;
  getComponent(id: string, fileId?: string): Promise<ContextResult>;
  getChanges(id: string, fileId?: string): Promise<DiffResult>;
  getTokens(scope?: string, fileId?: string): Promise<ContextResult>;
}

/**
 * Client of the Figma MCP (source document §11). The only DesignSource
 * implementation in the MVP.
 */
export interface FigmaAdapter {
  getMetadata(nodeId: string): Promise<FigmaMetadata>;
  getDesignContext(nodeId: string): Promise<FigmaDesignContext>;
  getScreenshot(nodeId: string): Promise<Buffer>;
  getImage(nodeId: string): Promise<Buffer>;
  close?(): Promise<void>;
}

/** Normalizes Figma raw context into Design IR; implemented by design-ir. */
export interface IrNormalizer {
  normalize(nodeId: string, raw: FigmaDesignContext, fileId: string): DesignIR;
}

/** Full-scan and incremental-scan orchestration; implemented by core. */
export interface Indexer {
  fullScan(scopeNodeId: string): Promise<ScanReport>;
  incrementalScan(scopeNodeId: string): Promise<ScanReport>;
}
