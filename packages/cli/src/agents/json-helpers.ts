import fs from "node:fs";
import path from "node:path";

/** Read a JSON file, returning `{}` if it doesn't exist yet. Throws on invalid JSON. */
export function readJson(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf-8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Write a JSON file with trailing newline, creating parent directories as needed. */
export function writeJson(filePath: string, data: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

/** Merge a `{ command, args }`-style MCP server entry under `data[serversKey][serverName]`, preserving everything else. */
export function mergeMcpServer(
  data: Record<string, unknown>,
  serversKey: string,
  serverName: string,
  entry: Record<string, unknown>,
): Record<string, unknown> {
  const servers =
    data[serversKey] && typeof data[serversKey] === "object"
      ? (data[serversKey] as Record<string, unknown>)
      : {};
  return {
    ...data,
    [serversKey]: {
      ...servers,
      [serverName]: entry,
    },
  };
}
