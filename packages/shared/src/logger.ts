import pino from "pino";

export type Logger = pino.Logger;

/**
 * Structured logger. Never logs secrets/tokens — sensitive keys are redacted.
 */
export function createLogger(name: string, level = "info"): Logger {
  return pino({
    name,
    level,
    base: { service: name },
    redact: {
      paths: [
        "token",
        "apiKey",
        "api_key",
        "secret",
        "password",
        "credential",
        "accessToken",
        "refreshToken",
        "*.token",
        "*.secret",
        "*.password",
      ],
      censor: "[REDACTED]",
    },
  });
}

export function silentLogger(): Logger {
  return pino({ level: "silent" });
}
