import { AGENT_TARGETS, type AgentTarget } from "./agents";
import { promptForAgents } from "./agents/prompt";

export interface SetupOptions {
  agent?: string;
}

function resolveByFlag(flag: string): AgentTarget[] {
  const ids = flag.split(",").map((s) => s.trim().toLowerCase());
  const unknown = ids.filter((id) => !AGENT_TARGETS.some((a) => a.id === id));
  if (unknown.length > 0) {
    const known = AGENT_TARGETS.map((a) => a.id).join(", ");
    throw new Error(`Unknown agent(s): ${unknown.join(", ")}. Known agents: ${known}`);
  }
  return AGENT_TARGETS.filter((a) => ids.includes(a.id));
}

export async function setup(opts: SetupOptions): Promise<void> {
  const targets = opts.agent ? resolveByFlag(opts.agent) : await promptForAgents(AGENT_TARGETS);

  if (targets.length === 0) {
    process.stdout.write("No agent selected — nothing to do.\n");
    return;
  }

  process.stdout.write("\n");
  for (const agent of targets) {
    const [configPath] = agent.configPaths();
    try {
      await agent.install(configPath);
      process.stdout.write(`✓ ${agent.label} — registered in ${configPath}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stdout.write(`✗ ${agent.label} — failed: ${message}\n`);
    }
  }
  process.stdout.write("\nRestart the agent(s) above to pick up the new MCP server.\n");
}
