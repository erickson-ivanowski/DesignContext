#!/usr/bin/env node
import { Command } from "commander";
import {
  defaultProjectConfig,
  loadProjectConfig,
  saveProjectConfig,
} from "@designcontext/cache";
import { startServer } from "@designcontext/mcp-server";
import { createAppContext, resolveFigmaAdapter, type AppContext } from "./runtime";
import { connect } from "./connect";
import { scan } from "./scan";
import { status } from "./status";
import { diff } from "./diff";
import { inspect } from "./inspect";
import { clearCache } from "./clear-cache";
import { setup } from "./setup";

const program = new Command();

program
  .name("designcontext")
  .description("Local-first context compiler between AI agents and the Figma MCP")
  .version("0.1.0");

program
  .command("init")
  .argument("[name]", "project name")
  .description("Create .designcontext/ (project.json, mappings.json, rules.md)")
  .action((name?: string) => {
    const projectRoot = process.cwd();
    const config = defaultProjectConfig(name ?? projectRoot.split(/[\\/]/).pop());
    saveProjectConfig(projectRoot, config);
    process.stdout.write(`Initialized ${projectRoot}/.designcontext/\n`);
  });

program
  .command("connect")
  .option("--token <token>", "Figma API key (spawn figma-developer-mcp)")
  .option("--url <url>", "reuse a hosted Figma MCP server over HTTP")
  .option("--file <fileId>", "Figma file id")
  .description("Configure the Figma connection (auto-reuses an existing Figma MCP when possible)")
  .action(async (opts: { token?: string; url?: string; file?: string }) => {
    await connect(process.cwd(), { token: opts.token, url: opts.url, fileId: opts.file });
  });

program
  .command("scan")
  .option("--node <nodeId>", "scope node id (defaults to the document root 0:0)")
  .option("--incremental", "incremental scan")
  .description("Index the project scope (or a single node)")
  .action(async (opts: { node?: string; incremental?: boolean }) => {
    const config = loadProjectConfig(process.cwd());
    const scope = opts.node ?? config.rootNodes[0] ?? "0:0";
    const adapter = await resolveFigmaAdapter(config, process.cwd());
    const ctx = await createAppContext({
      projectRoot: process.cwd(),
      fileId: config.figmaFileId ?? "file",
      adapter,
    });
    try {
      await scan(ctx, scope, { incremental: opts.incremental });
    } finally {
      await adapter.close?.();
    }
  });

program
  .command("status")
  .description("Print project status")
  .action(async () => {
    const ctx = await createAppContext(resolveFileOptions());
    await status(ctx);
  });

program
  .command("diff")
  .argument("[screen]", "screen node id")
  .description("Print changed/added/removed vs. previous scan")
  .action(async (screen?: string) => {
    const ctx = await createAppContext(resolveFileOptions());
    const scope = screen ?? loadProjectConfig(process.cwd()).rootNodes[0];
    if (!scope) {
      process.stderr.write("No screen specified.\n");
      process.exit(1);
    }
    await diff(ctx, scope);
  });

program
  .command("inspect")
  .requiredOption("--node <nodeId>", "node id")
  .option("--level <level>", "context level 0-4", "2")
  .description("Print context for a node at a level")
  .action(async (opts: { node: string; level: string }) => {
    const ctx = await createAppContext(resolveFileOptions());
    const level = Number(opts.level) as 0 | 1 | 2 | 3 | 4;
    await inspect(ctx, opts.node, level);
  });

program
  .command("clear-cache")
  .description("Remove cached blobs and index data")
  .action(async () => {
    const ctx = await createAppContext(resolveFileOptions());
    await clearCache(ctx);
  });

program
  .command("setup")
  .option("--agent <ids>", "comma-separated agent ids (skip the interactive prompt)")
  .description("Register the DesignContext MCP server with an AI agent (Claude, Gemini, Codex, opencode, ...)")
  .action(async (opts: { agent?: string }) => {
    await setup({ agent: opts.agent });
  });

program
  .command("mcp", { hidden: true })
  .description("Start the MCP server over stdio (invoked by agents, not run directly)")
  .action(async () => {
    const ctx = await createAppContext(resolveFileOptions());
    await startServer({
      engine: ctx.engine,
      graph: ctx.graph,
      getProject: async () => {
        const config = loadProjectConfig(ctx.projectRoot);
        const nodes = await ctx.graph.all();
        return {
          name: config.name,
          framework: config.framework,
          screens: nodes.filter((n) => ["SCREEN", "FRAME", "CANVAS"].includes(n.type)).map((n) => n.name),
          components: nodes.filter((n) => n.componentId != null).map((n) => n.name),
          tokens: nodes.filter((n) => Object.keys(n.tokens).length > 0).map((n) => n.name),
        };
      },
    });
  });

function resolveFileOptions(): { projectRoot: string; fileId: string; inMemory: boolean } {
  const projectRoot = process.cwd();
  const config = loadProjectConfig(projectRoot);
  return {
    projectRoot,
    fileId: config.figmaFileId ?? "mock-file",
    inMemory: false,
  };
}

export { program, createAppContext, type AppContext };
