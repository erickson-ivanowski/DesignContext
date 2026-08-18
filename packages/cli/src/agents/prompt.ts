import readline from "node:readline";
import type { AgentTarget } from "./types";

/** Minimal numbered-list prompt (no extra dependency): pick agents by number, comma-separated, or "all". */
export async function promptForAgents(agents: AgentTarget[]): Promise<AgentTarget[]> {
  process.stdout.write("\nWhich agent(s) should DesignContext register with?\n\n");
  agents.forEach((agent, i) => {
    process.stdout.write(`  ${i + 1}. ${agent.label}\n`);
  });
  process.stdout.write(`\nEnter numbers separated by commas (e.g. "1,3"), or "all": `);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) => {
    rl.question("", (line) => {
      rl.close();
      resolve(line.trim());
    });
  });

  if (answer.toLowerCase() === "all") return agents;

  const indices = answer
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= agents.length);

  return indices.map((i) => agents[i - 1]);
}
