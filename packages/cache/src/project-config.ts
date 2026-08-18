import fs from "node:fs";
import type { ProjectConfig } from "@designcontext/core";
import { projectConfigDir, projectConfigFile } from "@designcontext/shared";

/** Default `.designcontext/project.json` contents for a freshly initialized project. */
export function defaultProjectConfig(name?: string): ProjectConfig {
  return {
    name: name ?? "untitled",
    figmaFileId: null,
    rootNodes: [],
    framework: "unknown",
    language: "unknown",
    sourceDirectory: "src",
    componentDirectory: "src/components",
  };
}

/** Load `.designcontext/project.json`, falling back to defaults if absent. */
export function loadProjectConfig(projectRoot: string): ProjectConfig {
  const file = projectConfigFile(projectRoot);
  if (!fs.existsSync(file)) {
    return defaultProjectConfig(projectRoot.split(/[\\/]/).pop());
  }
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw) as ProjectConfig;
}

/** Persist `.designcontext/project.json`. */
export function saveProjectConfig(projectRoot: string, config: ProjectConfig): void {
  fs.mkdirSync(projectConfigDir(projectRoot), { recursive: true });
  fs.writeFileSync(projectConfigFile(projectRoot), JSON.stringify(config, null, 2) + "\n");
}
