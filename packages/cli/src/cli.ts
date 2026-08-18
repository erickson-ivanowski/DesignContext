#!/usr/bin/env node
import { Command } from "commander";
import {
  defaultProjectConfig,
  loadProjectConfigDetailed,
  saveProjectConfig,
} from "@designcontext/cache";
import { startServer } from "@designcontext/mcp-server";
import { createAppContext, fileByAliasOrId, type AppContext, type FileRuntime } from "./runtime";
import { connect, ConnectError } from "./connect";
import { scanFile } from "./scan";
import { status } from "./status";
import { diff } from "./diff";
import { inspect } from "./inspect";
import { clearCache } from "./clear-cache";
import { setup } from "./setup";

declare const __DESIGNCONTEXT_VERSION__: string | undefined;
// esbuild replaces __DESIGNCONTEXT_VERSION__ with package.json's version at build time
// (see scripts/build.mjs); it's undefined when run directly via tsx in dev.
const VERSION = typeof __DESIGNCONTEXT_VERSION__ !== "undefined" ? __DESIGNCONTEXT_VERSION__ : "0.0.0-dev";

const program = new Command();

program
  .name("designcontext")
  .description("Local-first context compiler between AI agents and the Figma MCP")
  .version(VERSION);

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
  .option("--file <urlOrFileId>", "Figma file — paste a Figma URL or a bare file id")
  .option("--alias <name>", "short name for this file (defaults to the file's own name)")
  .description("Connect a Figma file (auto-reuses an existing Figma MCP when possible)")
  .action(async (opts: { token?: string; url?: string; file?: string; alias?: string }) => {
    try {
      const fileConfig = await connect(process.cwd(), {
        token: opts.token,
        url: opts.url,
        file: opts.file,
        alias: opts.alias,
      });
      process.stdout.write(`Connected "${fileConfig.alias}" (${fileConfig.fileId}).\n`);
    } catch (err) {
      if (err instanceof ConnectError) {
        process.stderr.write(`${err.message}\n`);
        process.exit(1);
      }
      throw err;
    }
  });

function requireFiles(config: ReturnType<typeof migrateAndLoad>): asserts config is ReturnType<typeof migrateAndLoad> {
  if (config.figmaFiles.length === 0) {
    process.stderr.write(
      "No Figma file connected yet. Run: designcontext connect --file <url>\n",
    );
    process.exit(1);
  }
}

/** Load the project config, persisting a one-time migration notice if the legacy shape was found. */
function migrateAndLoad(projectRoot: string) {
  const { config, migrated } = loadProjectConfigDetailed(projectRoot);
  if (migrated) {
    saveProjectConfig(projectRoot, config);
    process.stderr.write(
      'Migrated .designcontext/project.json to multi-file format (alias: "default").\n',
    );
  }
  return config;
}

function resolveTargetFile(ctx: AppContext, alias: string | undefined, requireExplicit: boolean): FileRuntime {
  if (alias) {
    const file = fileByAliasOrId(ctx, alias);
    if (!file) {
      const known = ctx.files.map((f) => f.alias).join(", ") || "(none configured)";
      process.stderr.write(`Unknown file "${alias}". Known files: ${known}\n`);
      process.exit(1);
    }
    return file;
  }
  if (ctx.files.length === 1) return ctx.files[0];
  if (requireExplicit) {
    const known = ctx.files.map((f) => f.alias).join(", ") || "(none configured)";
    process.stderr.write(`This project tracks multiple files — pass --file. Known files: ${known}\n`);
    process.exit(1);
  }
  return ctx.files[0];
}

program
  .command("scan")
  .option("--file <alias>", "file to scan (defaults to all configured files)")
  .option("--node <nodeId>", "scope node id (defaults to the file's configured root, or 0:0)")
  .option("--incremental", "incremental scan")
  .description("Index one file's scope, or every configured file when --file is omitted")
  .action(async (opts: { file?: string; node?: string; incremental?: boolean }) => {
    const projectRoot = process.cwd();
    const config = migrateAndLoad(projectRoot);
    requireFiles(config);

    if (opts.node && !opts.file && config.figmaFiles.length > 1) {
      process.stderr.write("--node requires --file when the project tracks multiple files.\n");
      process.exit(1);
    }

    const ctx = await createAppContext({ projectRoot, config });
    let hadFailure = false;
    try {
      const targets = opts.file ? [resolveTargetFile(ctx, opts.file, true)] : ctx.files;
      for (const target of targets) {
        const fileConfig = config.figmaFiles.find((f) => f.fileId === target.fileId);
        const scope = opts.node ?? fileConfig?.rootNodes[0] ?? "0:0";
        try {
          await scanFile(target, scope, { incremental: opts.incremental });
        } catch (err) {
          hadFailure = true;
          const message = err instanceof Error ? err.message : String(err);
          process.stderr.write(`[${target.alias}] Scan failed: ${message}\n`);
        }
      }
    } finally {
      for (const file of ctx.files) await file.adapter.close?.();
    }
    if (hadFailure) process.exit(1);
  });

program
  .command("status")
  .description("Print project status (aggregate + per-file breakdown)")
  .action(async () => {
    const projectRoot = process.cwd();
    const config = migrateAndLoad(projectRoot);
    const ctx = await createAppContext({ projectRoot, config });
    await status(ctx);
  });

program
  .command("diff")
  .argument("[screen]", "screen node id")
  .option("--file <alias>", "file to diff (required when the project tracks more than one)")
  .description("Print changed/added/removed vs. previous scan")
  .action(async (screen: string | undefined, opts: { file?: string }) => {
    const projectRoot = process.cwd();
    const config = migrateAndLoad(projectRoot);
    requireFiles(config);
    const ctx = await createAppContext({ projectRoot, config });
    const target = resolveTargetFile(ctx, opts.file, true);
    const fileConfig = config.figmaFiles.find((f) => f.fileId === target.fileId);
    const scope = screen ?? fileConfig?.rootNodes[0];
    if (!scope) {
      process.stderr.write("No screen specified.\n");
      process.exit(1);
    }
    await diff(ctx, scope, target.fileId);
  });

program
  .command("inspect")
  .requiredOption("--node <nodeId>", "node id")
  .option("--level <level>", "context level 0-4", "2")
  .option("--file <alias>", "file to inspect (required when the project tracks more than one)")
  .description("Print context for a node at a level")
  .action(async (opts: { node: string; level: string; file?: string }) => {
    const projectRoot = process.cwd();
    const config = migrateAndLoad(projectRoot);
    requireFiles(config);
    const ctx = await createAppContext({ projectRoot, config });
    const target = resolveTargetFile(ctx, opts.file, true);
    const level = Number(opts.level) as 0 | 1 | 2 | 3 | 4;
    await inspect(ctx, opts.node, level, target.fileId);
  });

program
  .command("clear-cache")
  .option("--file <alias>", "file to clear (defaults to clearing everything)")
  .description("Remove cached blobs and index data")
  .action(async (opts: { file?: string }) => {
    const projectRoot = process.cwd();
    const config = migrateAndLoad(projectRoot);
    const ctx = await createAppContext({ projectRoot, config });
    const target = opts.file ? resolveTargetFile(ctx, opts.file, true) : undefined;
    await clearCache(ctx, target?.fileId);
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
    const projectRoot = process.cwd();
    const config = migrateAndLoad(projectRoot);
    const ctx = await createAppContext({ projectRoot, config });

    await startServer({
      engine: ctx.engine,
      graph: ctx.graph,
      getProject: async () => {
        const nodes = await ctx.graph.all();
        return {
          name: config.name,
          framework: config.framework,
          screens: nodes.filter((n) => ["SCREEN", "FRAME", "CANVAS"].includes(n.type)).map((n) => n.name),
          components: nodes.filter((n) => n.componentId != null).map((n) => n.name),
          tokens: nodes.filter((n) => Object.keys(n.tokens).length > 0).map((n) => n.name),
        };
      },
      listFiles: async () => {
        const result = [];
        for (const file of ctx.files) {
          const nodes = await ctx.graph.all(file.fileId);
          result.push({
            alias: file.alias,
            fileId: file.fileId,
            screens: nodes.filter((n) => ["SCREEN", "FRAME", "CANVAS"].includes(n.type)).length,
            components: nodes.filter((n) => n.componentId != null).length,
          });
        }
        return result;
      },
      resolveFileId: async (aliasOrId) => {
        if (aliasOrId) {
          const file = fileByAliasOrId(ctx, aliasOrId);
          if (!file) {
            const known = ctx.files.map((f) => f.alias).join(", ") || "(none configured)";
            throw new Error(`Unknown file "${aliasOrId}". Known files: ${known}`);
          }
          return file.fileId;
        }
        if (ctx.files.length === 1) return ctx.files[0].fileId;
        if (ctx.files.length === 0) {
          throw new Error("No Figma file connected yet. Run: designcontext connect --file <url>");
        }
        const known = ctx.files.map((f) => f.alias).join(", ");
        throw new Error(`This project tracks multiple files — pass \`file\`. Known files: ${known}`);
      },
    });
  });

export { program, createAppContext, type AppContext };
