import esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packages = [
  "shared",
  "core",
  "figma-adapter",
  "cache",
  "design-graph",
  "design-ir",
  "diff-engine",
  "context-engine",
  "mcp-server",
  "cli",
];

const alias = Object.fromEntries(
  packages.map((p) => [
    `@designcontext/${p}`,
    path.join(root, "packages", p, "src", "index.ts"),
  ]),
);

await esbuild.build({
  entryPoints: [path.join(root, "packages", "cli", "src", "bin.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: path.join(root, "dist", "cli.mjs"),
  banner: { js: "#!/usr/bin/env node" },
  alias,
  external: [
    "commander",
    "pino",
    "zod",
    "@modelcontextprotocol/*",
    "keytar",
    "node:*",
  ],
  sourcemap: false,
  logLevel: "info",
});
