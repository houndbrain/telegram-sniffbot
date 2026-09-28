import { Markup } from "telegraf";
import { config } from "./config.js";
import { WINDOWS } from "./api.js";

/**
 * Callback payloads are capped at 64 bytes by Telegram, so they carry a short
 * verb and a slug and nothing else. Anything richer is re-read from the API.
 */
export const cb = {
  window: (w) => `w:${w}`,
  token: (slug) => `t:${slug}`,
  theses: (slug) => `th:${slug}`,
  holders: (slug) => `ho:${slug}`,
  traders: (slug) => `tr:${slug}`,
  back: (w) => `b:${w}`,
};

export function feedKeyboard(payload) {
  const active = String(payload?.window || "24h").toLowerCase();
  const windowRow = WINDOWS.map((w) =>
    Markup.button.callback(w === active ? `· ${w.toUpperCase()} ·` : w.toUpperCase(), cb.window(w)),
  );

  const tokens = (payload?.tokens ?? []).slice(0, config.ui.listLimit);
  const tokenRows = [];
  for (let i = 0; i < tokens.length; i += 3) {
    tokenRows.push(tokens.slice(i, i + 3).map((t) => Markup.button.callback(t.symbol.slice(0, 12), cb.token(t.slug))));
  }

  return Markup.inlineKeyboard([windowRow, ...tokenRows]);
}

export function scentKeyboard(token, window = "24h") {
  const rows = [
    [
      Markup.button.callback("Theses", cb.theses(token.slug)),
      Markup.button.callback("Holders", cb.holders(token.slug)),
      Markup.button.callback("Traders", cb.traders(token.slug)),
    ],
    [Markup.button.callback("‹ Back to scents", cb.back(window))],
  ];
  if (config.ui.siteUrl) {
    rows.splice(1, 0, [Markup.button.url("Open in browser", `${config.ui.siteUrl}/scent/${token.slug}`)]);
  }
  return Markup.inlineKeyboard(rows);
}

export function panelKeyboard(token, window = "24h") {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`‹ Back to ${token.symbol}`, cb.token(token.slug))],
    [Markup.button.callback("‹‹ Scents", cb.back(window))],
  ]);
}
