import fs from "node:fs";
import path from "node:path";
import { createLogger, designContextRoot } from "@designcontext/shared";

const logger = createLogger("designcontext:secrets");

type Keytar = {
  setPassword: (service: string, account: string, password: string) => Promise<void>;
  getPassword: (service: string, account: string) => Promise<string | null>;
};

async function loadKeytar(): Promise<Keytar | null> {
  try {
    const mod = (await import("keytar")) as unknown as { default?: Keytar } & Keytar;
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function credentialsFile(): string {
  return path.join(designContextRoot(), "credentials.json");
}

function readFileSecrets(): Record<string, string> {
  try {
    const file = credentialsFile();
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeFileSecrets(secrets: Record<string, string>): void {
  const dir = designContextRoot();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(credentialsFile(), JSON.stringify(secrets, null, 2), { mode: 0o600 });
}

/** Store a secret in the OS keychain when available, else a non-versioned file. */
export async function storeSecret(account: string, secret: string): Promise<void> {
  const keytar = await loadKeytar();
  if (keytar) {
    await keytar.setPassword("designcontext", account, secret);
    return;
  }
  const all = readFileSecrets();
  all[account] = secret;
  writeFileSecrets(all);
  logger.warn("keytar unavailable; secret stored in ~/.designcontext (not versioned)");
}

/** Retrieve a stored secret, or null when absent. */
export async function getSecret(account: string): Promise<string | null> {
  const keytar = await loadKeytar();
  if (keytar) {
    return keytar.getPassword("designcontext", account);
  }
  return readFileSecrets()[account] ?? null;
}
