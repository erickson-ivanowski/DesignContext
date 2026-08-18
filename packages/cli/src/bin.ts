async function main(): Promise<void> {
  // Re-spawn once with Node experimental warnings disabled (e.g. the harmless
  // `node:sqlite` ExperimentalWarning), so end users get a clean terminal.
  // Must happen before `./cli` is imported — that import chain reaches
  // `node:sqlite`, which emits the warning at module-load time.
  if (!process.execArgv.some((arg) => arg.includes("disable-warning"))) {
    const { spawnSync } = await import("node:child_process");
    const child = spawnSync(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", process.argv[1], ...process.argv.slice(2)],
      { stdio: "inherit" },
    );
    process.exit(child.status ?? 0);
    return;
  }

  const { program } = await import("./cli");
  await program.parseAsync(process.argv).catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}

void main();
