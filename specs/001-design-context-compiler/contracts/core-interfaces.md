# Contract: Core Interfaces

Independent interfaces (source document §55). Located in `packages/core`; implemented by feature packages. Written here as TypeScript contracts.

## DesignSource (implemented by figma-adapter)

```ts
interface DesignSource {
  getMetadata(nodeId: string): Promise<unknown>;
  getContext(nodeId: string): Promise<unknown>;
  getScreenshot(nodeId: string): Promise<Buffer>;
}
```

## CacheStore (implemented by cache)

```ts
interface CacheStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  invalidate(key: string): Promise<void>;
}
```

## DesignGraph (implemented by design-graph)

```ts
interface DesignGraph {
  getNode(id: string): Promise<DesignNode | null>;
  getChildren(id: string): Promise<DesignNode[]>;
  search(query: string): Promise<DesignNode[]>;
}
```

## ContextEngine (implemented by context-engine)

```ts
interface ContextEngine {
  getScreen(id: string): Promise<ContextResult>;
  getComponent(id: string): Promise<ContextResult>;
  getChanges(id: string): Promise<DiffResult>;
}
```

## FigmaAdapter (implemented by figma-adapter, source document §11)

```ts
interface FigmaAdapter {
  getMetadata(nodeId: string): Promise<FigmaMetadata>;
  getDesignContext(nodeId: string): Promise<FigmaDesignContext>;
  getScreenshot(nodeId: string): Promise<Buffer>;
  getImage(nodeId: string): Promise<Buffer>;
}
```

## Contract notes

- `FigmaMcpAdapter` is the only `FigmaAdapter`/`DesignSource` implementation in the MVP; it is a *client* of the Figma MCP.
- `CacheStore` key is `fileId:nodeId:contentHash`.
- `ContextResult` carries estimated token counts and honors the context budget; it may include references (`component://…`, `tokenset://…`) instead of inline content.
