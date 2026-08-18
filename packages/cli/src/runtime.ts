import type { FigmaAdapter, FigmaFileConfig, ProjectConfig } from "@designcontext/core";
import { DesignIndexer } from "@designcontext/core";
import {
  InMemoryCacheStore,
  SqliteCacheStore,
  openDb,
  type DesignCache,
} from "@designcontext/cache";
import { InMemoryDesignGraph } from "@designcontext/design-graph";
import { ContextEngineImpl } from "@designcontext/context-engine";
import {
  FigmaMcpAdapter,
  HttpFigmaClient,
  MockFigmaAdapter,
  StdioFigmaClient,
} from "@designcontext/figma-adapter";
import { dbPath } from "@designcontext/shared";
import { getSecret } from "./secrets";
import { discoverFigmaMcp } from "./figma-discovery";

export interface FigmaMcpConnection {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** Build a real Figma adapter backed by the Figma MCP server over stdio. */
export function buildFigmaAdapter(conn: FigmaMcpConnection): FigmaMcpAdapter {
  return new FigmaMcpAdapter(
    new StdioFigmaClient({
      command: conn.command,
      args: conn.args,
      env: conn.env,
    }),
  );
}

/**
 * Resolve the Figma adapter for indexing one file, in order of preference:
 *   1. remote Figma MCP URL
 *   2. reused Figma MCP config (command/args/env already carry auth)
 *   3. stored token → spawn `figma-developer-mcp`
 *   4. on-the-fly discovery of an existing Figma MCP
 *   5. mock (dev/demo fallback)
 */
export async function resolveFigmaAdapter(
  fileConfig: FigmaFileConfig,
  projectRoot: string,
): Promise<FigmaAdapter> {
  if (fileConfig.figmaMcpUrl) {
    return new FigmaMcpAdapter(new HttpFigmaClient(fileConfig.figmaMcpUrl));
  }

  if (fileConfig.figmaMcpEnv !== undefined) {
    return buildFigmaAdapter({
      command: fileConfig.figmaMcpCommand ?? "npx",
      args: fileConfig.figmaMcpArgs ?? [],
      env: fileConfig.figmaMcpEnv,
    });
  }

  const apiKey = await getSecret("figma-token");
  if (apiKey) {
    return buildFigmaAdapter({
      command: fileConfig.figmaMcpCommand ?? "npx",
      args: fileConfig.figmaMcpArgs ?? ["-y", "figma-developer-mcp", "--stdio"],
      env: { FIGMA_API_KEY: apiKey },
    });
  }

  const discovered = discoverFigmaMcp(projectRoot);
  if (discovered?.url) {
    return new FigmaMcpAdapter(new HttpFigmaClient(discovered.url));
  }
  if (discovered?.command) {
    return buildFigmaAdapter({
      command: discovered.command,
      args: discovered.args ?? [],
      env: discovered.env ?? {},
    });
  }

  process.stderr.write(
    "Warning: no Figma connection found (run `designcontext connect`); using mock adapter.\n",
  );
  return new MockFigmaAdapter();
}

export interface FileRuntime {
  fileId: string;
  alias: string;
  adapter: FigmaAdapter;
  indexer: DesignIndexer;
}

export interface AppContext {
  cache: DesignCache;
  graph: InMemoryDesignGraph;
  engine: ContextEngineImpl;
  files: FileRuntime[];
  projectRoot: string;
}

export interface AppContextOptions {
  projectRoot: string;
  config: ProjectConfig;
  inMemory?: boolean;
  /** Override adapters per alias — used by tests to inject mocks instead of resolving real connections. */
  adapters?: Record<string, FigmaAdapter>;
}

/** Build the shared runtime (cache → graph → engine → one indexer per configured file) for CLI + MCP. */
export async function createAppContext(opts: AppContextOptions): Promise<AppContext> {
  const cache: DesignCache = opts.inMemory
    ? new InMemoryCacheStore()
    : new SqliteCacheStore(await openDb(dbPath()));

  const graph = new InMemoryDesignGraph(cache);
  await graph.load();

  const engine = new ContextEngineImpl(graph, cache);

  const files: FileRuntime[] = [];
  for (const fileConfig of opts.config.figmaFiles) {
    const adapter =
      opts.adapters?.[fileConfig.alias] ??
      (await resolveFigmaAdapter(fileConfig, opts.projectRoot));
    const indexer = new DesignIndexer({
      adapter,
      graph,
      cache,
      fileId: fileConfig.fileId,
    });
    files.push({ fileId: fileConfig.fileId, alias: fileConfig.alias, adapter, indexer });
  }

  return {
    cache,
    graph,
    engine,
    files,
    projectRoot: opts.projectRoot,
  };
}

/** Find a configured file by alias or raw Figma file id. */
export function fileByAliasOrId(ctx: AppContext, aliasOrId: string): FileRuntime | undefined {
  return ctx.files.find((f) => f.alias === aliasOrId || f.fileId === aliasOrId);
}
