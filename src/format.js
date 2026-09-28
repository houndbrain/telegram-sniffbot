import { config } from "./config.js";
import { HOUND, bar, receptorBlock } from "./ascii.js";

/**
 * Message rendering.
 *
 * Messages are HTML rather than MarkdownV2: token names and community writing
 * are attacker-controlled strings full of characters MarkdownV2 would choke on,
 * and HTML needs only three escapes to be safe.
 */

export const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export function usd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(4)}`;
}

export function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function ago(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return "";
  const s = Math.round(n / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const shortAddress = (address) => `${String(address).slice(0, 8)}…${String(address).slice(-4)}`;

/** A token whose figures are a placeholder rather than a reading. */
const isStale = (token) => token?.source !== "DEXSCREENER";

/**
 * One line the whole bot shares: what the ordering means and how old it is.
 * Every list and card carries it, so no screenshot of this bot can be mistaken
 * for a live tick.
 */
export function provenance(payload) {
  const parts = [];
  if (payload?.window) parts.push(`${String(payload.window).toUpperCase()} ${payload.rankBasis || "VOLUME"}`);
  if (Number.isFinite(payload?.dataAgeMs)) parts.push(ago(payload.dataAgeMs));
  if (payload?.stale) parts.push("STALE");
  return parts.length ? `<i>${esc(parts.join(" · "))}</i>` : "";
}

export function welcome() {
  return [
    `<pre>${esc(HOUND)}</pre>`,
    "<b>HOUNDBRAIN</b>",
    "<i>A digital olfactory system for market behaviour.</i>",
    "",
    "HoundBrain reads live market and on-chain activity and re-presents it as synthetic scent — named qualities such as <b>strong</b>, <b>diffuse</b>, <b>fading</b> or <b>sharp</b>, produced by a fixed deterministic model rather than a chart.",
    "",
    "It describes what a market feels like. It does not tell you what to do.",
    "",
    "<b>Commands</b>",
    "/scents — the ranked set, with 1H / 6H / 24H",
    "/scent <code>SYMBOL</code> — everything known about one specimen",
    "/compare <code>A</code> <code>B</code> — two fingerprints side by side",
    "/memory — what the system has observed over time",
    "/about — the model, scope and disclosure",
  ].join("\n");
}

export function about() {
  return [
    "<b>How it smells</b>",
    "",
    "<pre>market observation\n  →  12 normalised features\n  →  32 synthetic odour channels\n  →  971 receptor activations\n  →  descriptors + state</pre>",
    "Measurements are normalised into twelve bounded dimensions, mixed into thirty-two odour channels, then projected across a bank of 971 receptor slots. The resulting activation pattern is a fingerprint, and the fingerprint plus the underlying features resolve into plain descriptors and one behavioural state.",
    "",
    "The pipeline is deterministic: the same input always produces the same scent.",
    "",
    "<b>Scope and disclosure</b>",
    "• The receptor bank is <i>inspired by</i> the documented canine olfactory repertoire. The mapping is computational — not a claim that dogs perceive markets.",
    "• Scent describes current observable behaviour. It is not a forecast, and two markets smelling alike implies nothing about their future.",
    "• Descriptors are descriptions of a modelled pattern, not ratings, recommendations or financial advice.",
    "• Community writing is reproduced, not endorsed, scored or verified.",
    "• This bot is read-only. It never asks for a wallet, a key or a signature.",
  ].join("\n");
}

export function feedMessage(payload) {
  const tokens = (payload?.tokens ?? []).slice(0, config.ui.listLimit);
  if (!tokens.length) {
    return "No specimens are being tracked right now. The collector may not have completed a sweep yet.";
  }

  const lines = [`<b>TRENDING SCENTS</b>`, provenance(payload), ""];
  for (const token of tokens) {
    const flag = isStale(token) ? " · <i>no market</i>" : "";
    const change = Number(token.change24h);
    const arrow = !Number.isFinite(change) ? "" : change > 0 ? "▲" : change < 0 ? "▼" : "•";
    lines.push(
      `<b>${token.rank}. ${esc(token.symbol)}</b> — ${esc(token.name)}`,
      `<code>${usd(token.priceUsd)}  ${arrow} ${pct(token.change24h)}</code>${flag}`,
      `<i>${esc((token.descriptors ?? []).join(" · ") || token.houndState || "—")}</i>`,
      "",
    );
  }
  lines.push("Tap a specimen below, or send <code>/scent SYMBOL</code>.");
  return lines.join("\n");
}

export function scentCard(token, payload) {
  const lines = [
    `<b>${esc(token.symbol)}</b> — ${esc(token.name)}`,
    provenance(payload),
    "",
  ];

  if (isStale(token)) {
    lines.push("⚠️ <b>NO MARKET</b> — the figures below are a registry placeholder, not a reading.", "");
  }

  lines.push(
    `<code>price      ${usd(token.priceUsd)}</code>`,
    `<code>24h        ${pct(token.change24h)}</code>`,
    `<code>1h vol     ${usd(token.volume1h)}</code>`,
    `<code>24h vol    ${usd(token.volume24h)}</code>`,
    `<code>liquidity  ${usd(token.liquidityUsd)}</code>`,
  );
  if (Number.isFinite(token.marketCap) && token.marketCap > 0) {
    lines.push(`<code>market cap ${usd(token.marketCap)}</code>`);
  }
  if (Number.isFinite(token.ageDays) && token.ageDays !== null) {
    lines.push(`<code>age        ${Number(token.ageDays).toFixed(2)}d</code>`);
  }

  lines.push("", `<b>Scent</b>  <i>${esc((token.descriptors ?? []).join(" · ") || "—")}</i>`);
  lines.push(`<b>State</b>  <code>${esc(token.houndState || "—")}</code>`);

  if (Array.isArray(token.receptorValues) && token.receptorValues.length) {
    lines.push(
      "",
      `<pre>${esc(receptorBlock(token.receptorValues))}</pre>`,
      `<i>${token.activeReceptors} of 971 receptor slots active · sampled for this view</i>`,
    );
  }

  lines.push("", `<code>${esc(token.contract)}</code>`);
  return lines.join("\n");
}

export function thesesMessage(token, report) {
  const head = `<b>TRADER THESES</b> · ${esc(token.symbol)}`;
  if (!report?.available) {
    return [
      head,
      "",
      report?.reason === "NOT_CONFIGURED"
        ? "The thesis feed is not configured on this instance."
        : "The thesis feed is unavailable right now. That is a statement about the feed, not about this token.",
    ].join("\n");
  }
  const list = (report.theses ?? []).slice(0, config.ui.thesisLimit);
  if (!list.length) {
    return [
      head,
      "",
      report.pending
        ? "Theses are not loaded yet — the feed asked us to check back shortly."
        : `Nobody has posted a thesis on ${esc(token.symbol)} yet.`,
    ].join("\n");
  }

  const lines = [head, `<i>${list.length} of ${(report.theses ?? []).length} shown · ${ago(report.cachedAgeMs)}</i>`, ""];
  for (const thesis of list) {
    const flags = [];
    if (thesis.isDev) flags.push("DEV");
    if (Number(thesis.equityUsd) > 0) flags.push(`holds ${usd(thesis.equityUsd)}`);
    lines.push(
      `<b>@${esc(thesis.handle || thesis.name || "anonymous")}</b>${flags.length ? ` <i>(${esc(flags.join(" · "))})</i>` : ""}`,
      esc(thesis.text),
      `<i>♥ ${Number(thesis.likes) || 0} · ↩ ${Number(thesis.replies) || 0}</i>`,
      "",
    );
  }
  lines.push(
    "<i>Opinions posted by other people, reproduced unedited. Not endorsed, scored or verified. A DEV tag means the author is the token's developer.</i>",
  );
  return lines.join("\n");
}

export function holdersMessage(token, report) {
  const head = `<b>TOP HOLDERS</b> · ${esc(token.symbol)}`;
  if (!report?.available) {
    return [
      head,
      "",
      report?.reason === "NOT_CONFIGURED"
        ? "Holder data is not configured on this instance."
        : "Holder data is unavailable right now — not a statement about this token.",
    ].join("\n");
  }
  const all = report.holders ?? [];
  if (!all.length) return [head, "", "No holder records were returned for this specimen."].join("\n");

  const wallets = all.filter((h) => !h.isBurn && !h.exchange);
  const topShare = wallets.slice(0, 10).reduce((sum, h) => sum + (Number(h.percentage) || 0), 0);

  const lines = [head, ""];
  for (const holder of all.slice(0, config.ui.holderLimit)) {
    const tag = holder.isBurn
      ? " burn"
      : holder.exchange
        ? ` pool·${String(holder.exchange).replace(/_/g, " ")}`
        : holder.isContract
          ? " contract"
          : "";
    lines.push(
      `<code>${bar(holder.percentage, 8)} ${(Number(holder.percentage) * 100).toFixed(2).padStart(6)}%  ${shortAddress(holder.address)}</code>${esc(tag)}`,
    );
  }
  lines.push(
    "",
    `<i>Top ${Math.min(10, wallets.length)} actual wallets hold ${(topShare * 100).toFixed(1)}%. Liquidity pools and burn addresses are marked and excluded — a pool custodies supply for traders, and burned supply cannot move.</i>`,
  );
  return lines.join("\n");
}

export function tradersMessage(token, report) {
  const head = `<b>TOP TRADERS</b> · ${esc(token.symbol)} · last hour`;
  if (report?.coverage === "UNSUPPORTED_POOL_TYPE") {
    return [
      head,
      "",
      "This market trades through a pool type whose swaps carry no pool address on chain, so traders cannot be attributed without misrepresenting them.",
    ].join("\n");
  }
  if (report?.coverage === "RATE_LIMITED") {
    return [head, "", "The node throttled this read. No traders were resolved, which is not the same as none trading."].join("\n");
  }
  const list = (report?.traders ?? []).slice(0, config.ui.traderLimit);
  if (!list.length) return [head, "", "No trades against indexed pools in the last hour."].join("\n");

  const lines = [head, `<i>${report.sampledLegs} largest of ${Number(report.totalLegs).toLocaleString()} trades</i>`, ""];
  for (const [index, trader] of list.entries()) {
    lines.push(
      `<code>${String(index + 1).padStart(2, "0")} ${usd(trader.volumeUsd).padStart(9)}  ${shortAddress(trader.address)}</code> <i>${esc(trader.side)}</i>`,
    );
  }
  if (Number(report.poolsSkipped) > 0) {
    lines.push("", `<i>${report.poolsSkipped} pool(s) could not be covered, so flow routed there is not counted.</i>`);
  }
  return lines.join("\n");
}

export function memoryMessage(stats) {
  if (!stats?.enabled) {
    return [
      "<b>MEMORY</b>",
      "",
      "Long-term memory is not enabled on this instance, so only session figures exist — and a bot has no session to speak of.",
    ].join("\n");
  }
  const lines = [
    "<b>MEMORY</b>",
    "<i>observations recorded over time</i>",
    "",
    `<code>scents remembered  ${Number(stats.totalObservations).toLocaleString()}</code>`,
    `<code>today              +${Number(stats.observationsToday).toLocaleString()}</code>`,
    `<code>specimens          ${Number(stats.specimens).toLocaleString()}</code>`,
    `<code>new today          +${Number(stats.specimensToday).toLocaleString()}</code>`,
  ];
  if (stats.firstObservationAt) {
    lines.push(`<code>since              ${esc(String(stats.firstObservationAt).slice(0, 10))}</code>`);
  }

  const top = (stats.topSpecimens ?? []).slice(0, 5);
  if (top.length) {
    lines.push("", "<b>Most remembered</b>");
    for (const [index, row] of top.entries()) {
      lines.push(
        `<code>${index + 1}. ${esc(row.symbol).padEnd(10)} ${Number(row.observations).toLocaleString().padStart(6)}  since ${esc(String(row.firstSeenAt).slice(0, 10))}</code>`,
      );
    }
  }
  return lines.join("\n");
}

export function compareMessage(a, b) {
  const lines = [
    `<b>COMPARE</b> · ${esc(a.symbol)} vs ${esc(b.symbol)}`,
    "",
    `<code>              ${esc(a.symbol).padEnd(10)} ${esc(b.symbol)}</code>`,
    `<code>price         ${usd(a.priceUsd).padEnd(10)} ${usd(b.priceUsd)}</code>`,
    `<code>24h           ${pct(a.change24h).padEnd(10)} ${pct(b.change24h)}</code>`,
    `<code>24h vol       ${usd(a.volume24h).padEnd(10)} ${usd(b.volume24h)}</code>`,
    `<code>liquidity     ${usd(a.liquidityUsd).padEnd(10)} ${usd(b.liquidityUsd)}</code>`,
    `<code>receptors     ${String(a.activeReceptors).padEnd(10)} ${b.activeReceptors}</code>`,
    "",
    `<b>${esc(a.symbol)}</b>  <i>${esc((a.descriptors ?? []).join(" · ") || "—")}</i>`,
    `<b>${esc(b.symbol)}</b>  <i>${esc((b.descriptors ?? []).join(" · ") || "—")}</i>`,
  ];

  if (Array.isArray(a.receptorValues) && Array.isArray(b.receptorValues) && a.receptorValues.length === b.receptorValues.length) {
    const similarity = cosine(a.receptorValues, b.receptorValues);
    lines.push(
      "",
      `<code>fingerprint similarity  ${similarity.toFixed(4)}</code>`,
      "<i>The receptor bank compresses differences, so this number ranks specimens rather than separating them. Treat it as an ordering, not a distance.</i>",
    );
  }
  return lines.join("\n");
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
