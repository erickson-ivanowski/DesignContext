import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface DiscoveredFigmaMcp {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  source: string;
}

/**
 * Discover an already-configured Figma MCP server in common agent config
 * locations (`.mcp.json` and `~/.claude.json`), so the user doesn't need to
 * provide a Figma token. Returns the launch config (command/args/env) or a
 * remote URL when found.
 */
export function discoverFigmaMcp(projectRoot: string): DiscoveredFigmaMcp | null {
  const candidates = [
    path.join(projectRoot, ".mcp.json"),
    path.join(os.homedir(), ".mcp.json"),
    path.join(os.homedir(), ".claude.json"),
  ];
  for (const file of candidates) {
    const found = findInFile(file);
    if (found) return found;
  }
  return null;
}

interface McpServerEntry {
  url?: unknown;
  command?: unknown;
  args?: unknown;
  env?: unknown;
}

function findInFile(file: string): DiscoveredFigmaMcp | null {
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
    const serverMaps = collectServerMaps(data);
    for (const servers of serverMaps) {
      if (!servers || typeof servers !== "object") continue;
      for (const [name, raw] of Object.entries(servers)) {
        const entry = raw as McpServerEntry;
        if (!isFigmaEntry(name, entry)) continue;
        if (typeof entry.url === "string" && entry.url.length > 0) {
          return { url: entry.url, source: file };
        }
        if (typeof entry.command === "string" && entry.command.length > 0) {
          return {
            command: entry.command,
            args: Array.isArray(entry.args)
              ? (entry.args as string[])
              : [],
            env: entry.env && typeof entry.env === "object"
              ? (entry.env as Record<string, string>)
              : {},
            source: file,
          };
        }
      }
    }
  } catch {
    // Malformed config — skip silently.
  }
  return null;
}

function collectServerMaps(data: Record<string, unknown>): Record<string, unknown>[] {
  const maps: Record<string, unknown>[] = [];
  if (data.mcpServers && typeof data.mcpServers === "object") {
    maps.push(data.mcpServers as Record<string, unknown>);
  }
  // Claude Code keeps per-project mcpServers under `projects.<path>.mcpServers`.
  if (data.projects && typeof data.projects === "object") {
    for (const project of Object.values(data.projects as Record<string, unknown>)) {
      const p = project as Record<string, unknown>;
      if (p.mcpServers && typeof p.mcpServers === "object") {
        maps.push(p.mcpServers as Record<string, unknown>);
      }
    }
  }
  return maps;
}

function isFigmaEntry(name: string, entry: McpServerEntry): boolean {
  const haystack = `${name} ${JSON.stringify(entry ?? {})}`.toLowerCase();
  return haystack.includes("figma");
}
