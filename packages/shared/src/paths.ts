import os from "node:os";
import path from "node:path";

/**
 * Cross-platform path helpers. Never assume bash/Unix paths. The global
 * data root is `~/.designcontext/` (treated as sensitive, never versioned).
 */
export function designContextRoot(): string {
  return path.join(os.homedir(), ".designcontext");
}

export function cacheDir(): string {
  return path.join(designContextRoot(), "cache");
}

export function blobsDir(): string {
  return path.join(cacheDir(), "blobs");
}

export function dbPath(): string {
  return path.join(designContextRoot(), "database.sqlite");
}

export function screenshotsDir(): string {
  return path.join(designContextRoot(), "screenshots");
}

export function credentialsFile(): string {
  return path.join(designContextRoot(), "credentials.json");
}

export function projectConfigDir(projectRoot: string): string {
  return path.join(projectRoot, ".designcontext");
}

export function projectConfigFile(projectRoot: string): string {
  return path.join(projectConfigDir(projectRoot), "project.json");
}

export function normalizePath(p: string): string {
  return path.resolve(p);
}
