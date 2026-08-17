import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

const alias = (name: string) =>
  path.join(root, "packages", name, "src", "index.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@designcontext/shared": alias("shared"),
      "@designcontext/core": alias("core"),
      "@designcontext/figma-adapter": alias("figma-adapter"),
      "@designcontext/cache": alias("cache"),
      "@designcontext/design-graph": alias("design-graph"),
      "@designcontext/design-ir": alias("design-ir"),
      "@designcontext/diff-engine": alias("diff-engine"),
      "@designcontext/context-engine": alias("context-engine"),
      "@designcontext/mcp-server": alias("mcp-server"),
      "@designcontext/cli": alias("cli"),
      "node:sqlite": path.join(root, "tests", "stubs", "node-sqlite.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
  },
});
