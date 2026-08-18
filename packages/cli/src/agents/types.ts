/** A single MCP-capable agent/tool that DesignContext can register itself with. */
export interface AgentTarget {
  id: string;
  label: string;
  /** Absolute path(s) to try, in order of preference (first existing wins; first is created if none exist). */
  configPaths(): string[];
  /** Read + merge-write the MCP server entry into the config at `configPath`. Creates the file/dirs if needed. */
  install(configPath: string): Promise<void>;
}
