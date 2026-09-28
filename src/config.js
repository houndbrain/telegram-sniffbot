import fs from "node:fs";
import path from "node:path";

/**
 * Configuration, read once from the environment.
 *
 * Only two values are required: the bot token and the address of a running
 * HoundBrain instance. Everything else has a working default, so the bot starts
 * from a two-line .env file.
 */

// Node loads no .env on its own. Existing process.env always wins, so a host
// or process manager can still override a file.
for (const file of [".env.local", ".env"]) {
  const full = path.join(process.cwd(), file);
  try {
    if (!fs.existsSync(full)) continue;
    for (const raw of fs.readFileSync(full, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      if (!key || process.env[key] !== undefined) continue;
      let value = line.slice(eq + 1).trim();
      // A quoted token silently becomes an invalid one; strip them here rather
      // than debugging a 401 later.
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // An unreadable env file must not stop the bot from starting.
  }
}

function readNumber(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    console.warn(`[config] ${name}=${JSON.stringify(raw)} is out of range; using ${fallback}`);
    return fallback;
  }
  return value;
}

function readUrl(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} is not a valid URL: ${JSON.stringify(raw)}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} must be http(s), got ${parsed.protocol}`);
  }
  return raw.replace(/\/$/, "");
}

export const config = {
  botToken: (process.env.TELEGRAM_BOT_TOKEN || "").trim(),

  api: {
    /** A running HoundBrain instance. The bot reads it and nothing else. */
    baseUrl: readUrl("HOUND_API_URL", "http://127.0.0.1:6782"),
    timeoutMs: readNumber("HOUND_API_TIMEOUT_MS", 12_000, { min: 1_000, max: 60_000 }),
    /**
     * Short shared cache. A group chat can produce many identical requests in a
     * second; this collapses them without ever serving something older than one
     * refresh of the upstream instance.
     */
    cacheTtlMs: readNumber("HOUND_API_CACHE_TTL_MS", 8_000, { min: 0 }),
    /** Detail panels change far more slowly than price. */
    panelCacheTtlMs: readNumber("HOUND_PANEL_CACHE_TTL_MS", 60_000, { min: 0 }),
  },

  ui: {
    /** Rows in a ranked list before it stops being readable on a phone. */
    listLimit: readNumber("HOUND_LIST_LIMIT", 8, { min: 1, max: 20 }),
    thesisLimit: readNumber("HOUND_THESIS_LIMIT", 5, { min: 1, max: 20 }),
    holderLimit: readNumber("HOUND_HOLDER_LIMIT", 8, { min: 1, max: 30 }),
    traderLimit: readNumber("HOUND_TRADER_LIMIT", 8, { min: 1, max: 30 }),
    /** Public site, used for "open in browser" links. Optional. */
    siteUrl: process.env.HOUND_SITE_URL?.trim().replace(/\/$/, "") || "",
  },

  limits: {
    /** Minimum gap between one chat's commands, to blunt spam and loops. */
    perChatIntervalMs: readNumber("HOUND_CHAT_INTERVAL_MS", 900, { min: 0, max: 10_000 }),
  },
};

export function assertConfig() {
  const problems = [];
  if (!config.botToken) problems.push("TELEGRAM_BOT_TOKEN is not set — create a bot with @BotFather and paste its token.");
  if (!config.api.baseUrl) problems.push("HOUND_API_URL is not set.");
  if (problems.length) {
    throw new Error(`Cannot start:\n  - ${problems.join("\n  - ")}`);
  }
}
