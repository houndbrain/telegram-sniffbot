import * as api from "./api.js";
import * as fmt from "./format.js";
import { feedKeyboard, panelKeyboard, scentKeyboard } from "./keyboards.js";
import { config } from "./config.js";

const HTML = { parse_mode: "HTML", link_preview_options: { is_disabled: true } };

/** Remembers the window a chat last chose, so buttons stay consistent. */
const chatWindow = new Map();
const windowFor = (ctx) => chatWindow.get(ctx.chat?.id) || "24h";
const rememberWindow = (ctx, w) => ctx.chat && chatWindow.set(ctx.chat.id, w);

/**
 * A single place where upstream failure becomes user-facing text. The bot
 * reports that *it* could not read, and never dresses a failure up as a fact
 * about a market.
 */
async function guard(ctx, run) {
  try {
    await run();
  } catch (error) {
    const message =
      error instanceof api.ApiError
        ? `${error.message}\n\nNothing is wrong with the token — this is about the connection to HoundBrain.`
        : "Something went wrong handling that. Try again in a moment.";
    console.error("[handler]", error?.message || error);
    await ctx.reply(message).catch(() => {});
  }
}

export function register(bot) {
  bot.start((ctx) => guard(ctx, async () => {
    await ctx.reply(fmt.welcome(), HTML);
  }));

  bot.help((ctx) => guard(ctx, async () => {
    await ctx.reply(fmt.welcome(), HTML);
  }));

  bot.command("about", (ctx) => guard(ctx, async () => {
    await ctx.reply(fmt.about(), HTML);
  }));

  bot.command(["scents", "trending"], (ctx) => guard(ctx, async () => {
    const arg = (ctx.payload || "").trim().toLowerCase();
    const window = api.isWindow(arg) ? arg : windowFor(ctx);
    rememberWindow(ctx, window);
    const payload = await api.feed(window);
    await ctx.reply(fmt.feedMessage(payload), { ...HTML, ...feedKeyboard(payload) });
  }));

  bot.command("scent", (ctx) => guard(ctx, async () => {
    const query = (ctx.payload || "").trim();
    if (!query) {
      await ctx.reply("Send a symbol, for example <code>/scent PONS</code>.", HTML);
      return;
    }
    const window = windowFor(ctx);
    const token = await api.findToken(query, window, { fingerprint: true });
    if (!token) {
      await ctx.reply(
        `No tracked specimen matches <b>${fmt.esc(query)}</b>.\n\nThe set is the current trending list, so it changes. Send /scents to see what is being tracked right now.`,
        HTML,
      );
      return;
    }
    const payload = await api.feed(window, { fingerprint: true });
    await ctx.reply(fmt.scentCard(token, payload), { ...HTML, ...scentKeyboard(token, window) });
  }));

  bot.command("memory", (ctx) => guard(ctx, async () => {
    await ctx.reply(fmt.memoryMessage(await api.memoryStats()), HTML);
  }));

  bot.command("compare", (ctx) => guard(ctx, async () => {
    const parts = (ctx.payload || "").trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length < 2) {
      await ctx.reply("Send two symbols, for example <code>/compare PONS MEME</code>.", HTML);
      return;
    }
    const window = windowFor(ctx);
    const [a, b] = await Promise.all([
      api.findToken(parts[0], window, { fingerprint: true }),
      api.findToken(parts[1], window, { fingerprint: true }),
    ]);
    const missing = [!a && parts[0], !b && parts[1]].filter(Boolean);
    if (missing.length) {
      await ctx.reply(`Not tracked right now: <b>${fmt.esc(missing.join(", "))}</b>. Send /scents for the current set.`, HTML);
      return;
    }
    await ctx.reply(fmt.compareMessage(a, b), HTML);
  }));

  // ── callbacks ────────────────────────────────────────────────────────────
  bot.action(/^w:(.+)$/, (ctx) => guard(ctx, async () => {
    const window = api.isWindow(ctx.match[1]) ? ctx.match[1] : "24h";
    rememberWindow(ctx, window);
    const payload = await api.feed(window);
    await ctx.answerCbQuery(`${window.toUpperCase()} window`);
    await editOrSend(ctx, fmt.feedMessage(payload), feedKeyboard(payload));
  }));

  bot.action(/^b:(.+)$/, (ctx) => guard(ctx, async () => {
    const window = api.isWindow(ctx.match[1]) ? ctx.match[1] : windowFor(ctx);
    const payload = await api.feed(window);
    await ctx.answerCbQuery();
    await editOrSend(ctx, fmt.feedMessage(payload), feedKeyboard(payload));
  }));

  bot.action(/^t:(.+)$/, (ctx) => guard(ctx, async () => {
    const window = windowFor(ctx);
    const token = await api.tokenBySlug(ctx.match[1], window, { fingerprint: true });
    if (!token) return expired(ctx);
    const payload = await api.feed(window, { fingerprint: true });
    await ctx.answerCbQuery();
    await editOrSend(ctx, fmt.scentCard(token, payload), scentKeyboard(token, window));
  }));

  registerPanel(bot, /^th:(.+)$/, api.theses, fmt.thesesMessage, "Reading theses…");
  registerPanel(bot, /^ho:(.+)$/, api.holders, fmt.holdersMessage, "Reading holders…");
  registerPanel(bot, /^tr:(.+)$/, api.traders, fmt.tradersMessage, "Reading traders…");

  // Plain text that looks like a ticker is treated as a lookup, because that is
  // what people type in a chat window.
  bot.on("text", (ctx) => guard(ctx, async () => {
    const text = (ctx.message?.text || "").trim();
    if (!text || text.startsWith("/")) return;
    if (!/^\$?[A-Za-z0-9._-]{2,20}$/.test(text)) return;
    const window = windowFor(ctx);
    const token = await api.findToken(text, window, { fingerprint: true });
    if (!token) return;
    const payload = await api.feed(window, { fingerprint: true });
    await ctx.reply(fmt.scentCard(token, payload), { ...HTML, ...scentKeyboard(token, window) });
  }));
}

function registerPanel(bot, pattern, fetcher, render, notice) {
  bot.action(pattern, (ctx) => guard(ctx, async () => {
    const window = windowFor(ctx);
    const token = await api.tokenBySlug(ctx.match[1], window);
    if (!token) return expired(ctx);
    await ctx.answerCbQuery(notice);
    const report = await fetcher(token.contract);
    await editOrSend(ctx, render(token, report), panelKeyboard(token, window));
  }));
}

function expired(ctx) {
  return ctx.answerCbQuery("That specimen is no longer in the tracked set.", { show_alert: true }).catch(() => {});
}

/**
 * Editing keeps a chat from filling with near-identical cards. Telegram rejects
 * an edit that changes nothing, and that rejection is not an error worth
 * surfacing, so it is swallowed and only real failures fall back to a new
 * message.
 */
async function editOrSend(ctx, text, keyboard) {
  try {
    await ctx.editMessageText(text, { parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...keyboard });
  } catch (error) {
    if (String(error?.description || "").includes("message is not modified")) return;
    await ctx.reply(text, { parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...keyboard });
  }
}

/**
 * One command per chat per interval. A shared bot in a busy group is otherwise
 * an easy way to hammer the instance behind it.
 */
export function throttle() {
  const last = new Map();
  return async (ctx, next) => {
    const id = ctx.chat?.id ?? ctx.from?.id;
    if (id === undefined || config.limits.perChatIntervalMs <= 0) return next();
    const now = Date.now();
    const previous = last.get(id) || 0;
    if (now - previous < config.limits.perChatIntervalMs) {
      if (ctx.updateType === "callback_query") await ctx.answerCbQuery("Easy — one at a time.").catch(() => {});
      return undefined;
    }
    last.set(id, now);
    return next();
  };
}
