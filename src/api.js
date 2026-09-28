import { config } from "./config.js";

/**
 * Client for a running HoundBrain instance.
 *
 * The bot is a reader. It never contacts a market source itself — the instance
 * already collects on a schedule and serves what it stored, so pointing the bot
 * at the instance keeps one collector for both surfaces and means the bot
 * inherits the instance's freshness and availability reporting unchanged.
 */

const cache = new Map();

async function get(pathname, { ttlMs = config.api.cacheTtlMs } = {}) {
  const key = pathname;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.api.timeoutMs);
  try {
    const response = await fetch(`${config.api.baseUrl}${pathname}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    // 404 is a real answer here — "not a token we track" — so it is returned
    // rather than thrown, and the caller decides what to say.
    if (response.status === 404) return { notFound: true };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = await response.json();
    cache.set(key, { at: Date.now(), value });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

export class ApiError extends Error {}

async function guarded(pathname, options) {
  try {
    return await get(pathname, options);
  } catch (error) {
    const reason = error?.name === "AbortError" ? "timed out" : error?.message || "failed";
    throw new ApiError(`HoundBrain did not answer (${reason}).`);
  }
}

export const WINDOWS = ["1h", "6h", "24h"];
export const isWindow = (value) => WINDOWS.includes(String(value).toLowerCase());

/**
 * `fingerprint` pulls the full 971-slot receptor pattern. It is opt-in because
 * it adds roughly 45KB to the response, which is pointless for a list but is
 * exactly what a specimen card and a comparison need.
 */
export function feed(window = "24h", { fingerprint = false } = {}) {
  const w = isWindow(window) ? String(window).toLowerCase() : "24h";
  return guarded(`/api/live/tokens?window=${w}${fingerprint ? "&fingerprint=1" : ""}`);
}

export const theses = (contract) =>
  guarded(`/api/live/theses?contract=${encodeURIComponent(contract)}`, { ttlMs: config.api.panelCacheTtlMs });

export const holders = (contract) =>
  guarded(`/api/live/holders?contract=${encodeURIComponent(contract)}`, { ttlMs: config.api.panelCacheTtlMs });

export const traders = (contract) =>
  guarded(`/api/live/traders?contract=${encodeURIComponent(contract)}`, { ttlMs: config.api.panelCacheTtlMs });

export const memoryStats = () => guarded("/api/memory/stats", { ttlMs: config.api.panelCacheTtlMs });

export const chain = () => guarded("/api/live/chain");

/**
 * Resolves what someone typed — a symbol, a slug, or a contract — to a token in
 * the current set. Matching is deliberately forgiving because people type
 * "$pons" and "PONS" and expect both to work.
 */
export async function findToken(query, window = "24h", options = {}) {
  const needle = String(query || "").trim().toLowerCase().replace(/^\$/, "");
  if (!needle) return null;
  const payload = await feed(window, options);
  const tokens = payload?.tokens ?? [];
  return (
    tokens.find((t) => t.contract?.toLowerCase() === needle) ||
    tokens.find((t) => t.slug?.toLowerCase() === needle) ||
    tokens.find((t) => t.symbol?.toLowerCase() === needle) ||
    tokens.find((t) => t.symbol?.toLowerCase().startsWith(needle)) ||
    tokens.find((t) => t.name?.toLowerCase().includes(needle)) ||
    null
  );
}

/** Used by the callback router, where the slug is authoritative. */
export async function tokenBySlug(slug, window = "24h", options = {}) {
  const payload = await feed(window, options);
  return (payload?.tokens ?? []).find((t) => t.slug === slug) || null;
}
