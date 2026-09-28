import { Telegraf } from "telegraf";
import { assertConfig, config } from "./config.js";
import { register, throttle } from "./handlers.js";
import { HOUND } from "./ascii.js";

const log = (...parts) => console.log(new Date().toISOString(), "[hound-bot]", ...parts);

async function main() {
  assertConfig();

  const bot = new Telegraf(config.botToken, { handlerTimeout: 30_000 });

  bot.use(throttle());
  register(bot);

  // Telegraf swallows nothing by default: without this one bad update can take
  // the whole process down and stop the bot answering anyone.
  bot.catch((error, ctx) => {
    log("unhandled error on", ctx?.updateType, "-", error?.message || error);
  });

  // Fail fast and loudly if the instance is unreachable, rather than starting
  // and answering every command with an error.
  try {
    const probe = await fetch(`${config.api.baseUrl}/api/live/tokens`, { signal: AbortSignal.timeout(8_000) });
    log(probe.ok ? `connected to ${config.api.baseUrl}` : `WARNING: ${config.api.baseUrl} answered ${probe.status}`);
  } catch (error) {
    log(`WARNING: ${config.api.baseUrl} is unreachable (${error?.message || error}). Starting anyway; commands will report it.`);
  }

  await bot.telegram.setMyCommands([
    { command: "scents", description: "The ranked set, with 1H / 6H / 24H" },
    { command: "scent", description: "Everything known about one specimen" },
    { command: "compare", description: "Two fingerprints side by side" },
    { command: "memory", description: "What the system has observed over time" },
    { command: "about", description: "The model, scope and disclosure" },
  ]);

  const me = await bot.telegram.getMe();
  console.log(HOUND);
  log(`started as @${me.username}`);

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      log(`${signal} received, stopping`);
      bot.stop(signal);
    });
  }

  await bot.launch({ dropPendingUpdates: true });
}

main().catch((error) => {
  console.error("\n" + (error?.message || error) + "\n");
  process.exit(1);
});
