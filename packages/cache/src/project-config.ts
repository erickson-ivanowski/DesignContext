import fs from "node:fs";
import type { ProjectConfig } from "@designcontext/core";
import { projectConfigDir, projectConfigFile } from "@designcontext/shared";

/** Default `.designcontext/project.json` contents for a freshly initialized project. */
export function defaultProjectConfig(name?: string): ProjectConfig {
  return {
    name: name ?? "untitled",
    figmaFiles: [],
    framework: "unknown",
    language: "unknown",
    sourceDirectory: "src",
    componentDirectory: "src/components",
    configVersion: 2,
  };
}

/** Pre-multi-file `.designcontext/project.json` shape (configVersion field absent). */
interface LegacyProjectConfig {
  name: string;
  figmaFileId: string | null;
  rootNodes: string[];
  framework: string;
  language: string;
  sourceDirectory: string;
  componentDirectory: string;
  figmaMcpCommand?: string;
  figmaMcpArgs?: string[];
  figmaMcpEnv?: Record<string, string>;
  figmaMcpUrl?: string;
}

function isLegacyConfig(raw: unknown): raw is LegacyProjectConfig {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "figmaFileId" in raw &&
    !("configVersion" in raw)
  );
}

/** Migrate a pre-multi-file config to the `figmaFiles` array shape (alias "default"). */
function migrateLegacyConfig(legacy: LegacyProjectConfig): ProjectConfig {
  return {
    name: legacy.name,
    figmaFiles: legacy.figmaFileId
      ? [
          {
            fileId: legacy.figmaFileId,
            alias: "default",
            rootNodes: legacy.rootNodes ?? [],
            figmaMcpCommand: legacy.figmaMcpCommand,
            figmaMcpArgs: legacy.figmaMcpArgs,
            figmaMcpEnv: legacy.figmaMcpEnv,
            figmaMcpUrl: legacy.figmaMcpUrl,
            addedAt: new Date(0).toISOString(),
          },
        ]
      : [],
    framework: legacy.framework,
    language: legacy.language,
    sourceDirectory: legacy.sourceDirectory,
    componentDirectory: legacy.componentDirectory,
    configVersion: 2,
  };
}

export interface LoadedProjectConfig {
  config: ProjectConfig;
  /** True when this config was just migrated in-memory from the legacy single-file shape. */
  migrated: boolean;
}

/** Load `.designcontext/project.json`, falling back to defaults if absent. Migrates legacy configs in-memory without writing to disk — call `saveProjectConfig` to persist. */
export function loadProjectConfigDetailed(projectRoot: string): LoadedProjectConfig {
  const file = projectConfigFile(projectRoot);
  if (!fs.existsSync(file)) {
    return { config: defaultProjectConfig(projectRoot.split(/[\\/]/).pop()), migrated: false };
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as unknown;
  if (isLegacyConfig(raw)) {
    return { config: migrateLegacyConfig(raw), migrated: true };
  }
  return { config: raw as ProjectConfig, migrated: false };
}

/** Load `.designcontext/project.json`, falling back to defaults if absent. */
export function loadProjectConfig(projectRoot: string): ProjectConfig {
  return loadProjectConfigDetailed(projectRoot).config;
}

/** Persist `.designcontext/project.json`. */
export function saveProjectConfig(projectRoot: string, config: ProjectConfig): void {
  fs.mkdirSync(projectConfigDir(projectRoot), { recursive: true });
  fs.writeFileSync(projectConfigFile(projectRoot), JSON.stringify(config, null, 2) + "\n");
}
