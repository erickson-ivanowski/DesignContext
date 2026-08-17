import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverFigmaMcp } from "@designcontext/cli";

describe("Figma MCP discovery", () => {
  it("reuses a Figma MCP configured in the project .mcp.json", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-discovery-"));
    fs.writeFileSync(
      path.join(dir, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          figma: {
            command: "npx",
            args: ["-y", "figma-developer-mcp", "--stdio"],
            env: { FIGMA_API_KEY: "secret-key" },
          },
          other: { command: "node", args: ["x.js"] },
        },
      }),
    );

    const found = discoverFigmaMcp(dir);
    expect(found).not.toBeNull();
    expect(found!.command).toBe("npx");
    expect(found!.args).toEqual(["-y", "figma-developer-mcp", "--stdio"]);
    expect(found!.env).toEqual({ FIGMA_API_KEY: "secret-key" });

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reuses a remote Figma MCP URL", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-discovery-"));
    fs.writeFileSync(
      path.join(dir, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          figma: { url: "https://mcp.figma.example/mcp" },
        },
      }),
    );

    const found = discoverFigmaMcp(dir);
    expect(found!.url).toBe("https://mcp.figma.example/mcp");

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
