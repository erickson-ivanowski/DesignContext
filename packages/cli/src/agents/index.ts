import type { AgentTarget } from "./types";
import { claudeDesktop } from "./claude-desktop";
import { claudeCode } from "./claude-code";
import { geminiCli } from "./gemini-cli";
import { codex } from "./codex";
import { opencode } from "./opencode";

export type { AgentTarget } from "./types";

/** Every agent DesignContext knows how to self-register with. Add new ones here. */
export const AGENT_TARGETS: AgentTarget[] = [claudeDesktop, claudeCode, geminiCli, codex, opencode];
