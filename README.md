```text
          / \__             __  ______  __  ___   ______  ____  ____  ___    _____   __
         (    @\___        / / / / __ \/ / / / | / / __ \/ __ )/ __ \/   |  /  _/ | / /
         /         O      / /_/ / / / / / / /  |/ / / / / __  / /_/ / /| |  / //  |/ /
        /   (_____/      / __  / /_/ / /_/ / /|  / /_/ / /_/ / _, _/ ___ |_/ // /|  /
       /_____/   U      /_/ /_/\____/\____/_/ |_/_____/_____/_/ |_/_/  |_/___/_/ |_/
```

# HoundBrain for Telegram

**Read market behaviour as synthetic scent, without leaving the chat.**

This bot is the Telegram surface of [HoundBrain](https://houndbrain.xyz) — a digital
olfactory system that turns live market and on-chain activity into named qualities
such as *strong*, *diffuse*, *fading* or *sharp*, produced by a fixed deterministic
model rather than a chart.

It describes what a market feels like. It never tells you what to do.

---

## What it does

| Command | What you get |
|---|---|
| `/scents` | The ranked set, switchable between **1H**, **6H** and **24H** |
| `/scent SYMBOL` | One specimen in full: price, volume, scent, state, receptor fingerprint |
| `/compare A B` | Two fingerprints side by side, with their similarity |
| `/memory` | Cumulative observations — how much has been recorded, and since when |
| `/about` | The model, its scope, and what it explicitly is not |

Every specimen card carries three buttons that open the deeper panels:

- **Theses** — what people have written about the token, reproduced unedited and
  attributed, with the author's position size and a marker when the author is the
  token's developer.
- **Holders** — distribution by share of supply, with liquidity pools and burn
  addresses marked and excluded from the concentration figure, because neither is a
  holder in any useful sense.
- **Traders** — the wallets behind the largest recent flows.

Typing a bare ticker (`PONS`, `$meme`) works too — in a chat window, that is what
people actually do.

---

## Architecture

The bot is a **reader**. It holds no market credentials, runs no collector, and
contacts no data source of its own.

```
   ┌──────────────────┐         ┌──────────────┐        ┌──────────┐
   │ HoundBrain       │◀────────│ this bot     │◀──────▶│ Telegram │
   │ instance         │  HTTP   │              │        │          │
   └──────────────────┘         └──────────────┘        └──────────┘
    collects on a schedule,      reads, renders,         long polling
    stores, and serves           throttles
```

Why it is built this way:

- **One collector, two surfaces.** The instance already gathers data on a timer and
  serves what it stored. Pointing the bot at it means the web and the chat show the
  same numbers, from the same sweep, at the same age.
- **No credential sprawl.** Upstream keys live in one place. The bot needs only a
  Telegram token and an address.
- **Honesty is inherited, not reimplemented.** Freshness, staleness, unavailable
  panels and *pending vs empty* all come from the instance, so the two surfaces
  cannot drift apart in what they claim.

---

## Honesty rules

This bot reports on live markets, so it is built never to overstate what it knows.
These are product requirements, not error handling:

- Figures that are a placeholder rather than a reading are labelled **NO MARKET**.
- Every list and card states its window, its ranking basis and **how old the data
  is**. A screenshot of this bot cannot be mistaken for a live tick.
- A panel that is unavailable says so, *and says that this is not a statement about
  the token*.
- A source that answers "nothing yet" is reported as pending — never as "nobody has
  written about this token".
- Community writing is reproduced, not endorsed, scored or verified.

The rule behind all of these: **an absence in the pipeline must never be rendered as
a fact about the subject.**

---

## Setup

Requirements: Node.js 20 or newer, and a reachable HoundBrain instance.

```bash
git clone <this-repo> hound-telegram-bot
cd hound-telegram-bot
npm ci

cp .env.example .env
#   TELEGRAM_BOT_TOKEN — from @BotFather
#   HOUND_API_URL      — your HoundBrain instance

npm start
```

On startup the bot probes the instance and prints whether it is reachable. It starts
either way: if the instance is down, commands report that clearly rather than the bot
refusing to run.

### Running it properly

```bash
pm2 start ecosystem.config.cjs
pm2 logs hound-telegram-bot
```

**Run exactly one instance per bot token.** Telegram delivers each update once, so a
second poller on the same token makes both fight for updates and answer erratically.

---

## Configuration

Only two values are required. Everything else has a working default — see
[`.env.example`](.env.example) for the full list with explanations.

| Variable | Default | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | **Required.** From @BotFather |
| `HOUND_API_URL` | `http://127.0.0.1:6782` | **Required.** The instance to read |
| `HOUND_SITE_URL` | *(empty)* | Enables the "Open in browser" button |
| `HOUND_API_CACHE_TTL_MS` | `8000` | Collapses duplicate requests in busy chats |
| `HOUND_PANEL_CACHE_TTL_MS` | `60000` | Detail panels move slower than price |
| `HOUND_CHAT_INTERVAL_MS` | `900` | Minimum gap between one chat's commands |
| `HOUND_LIST_LIMIT` | `8` | Rows before a message stops fitting a phone |

---

## Project layout

```
src/
  index.js      startup, command registration, graceful shutdown
  config.js     environment parsing, validation, defaults
  api.js        HoundBrain client — fetch, cache, timeouts, lookup
  handlers.js   commands, callbacks, error boundary, throttle
  format.js     message rendering and all user-facing copy
  keyboards.js  inline keyboards and callback payloads
  ascii.js      the hound mark and the receptor block renderer
```

Messages are rendered as HTML rather than MarkdownV2: token names and community
writing are attacker-controlled strings full of characters MarkdownV2 would choke
on, while HTML needs only three escapes to be safe.

---

## Scope and disclosure

- The receptor bank is **inspired by** the documented canine olfactory repertoire.
  The mapping from market data to synthetic odour is computational. It is not a
  claim that dogs perceive markets.
- Scent describes *current observable behaviour*. It is not a forecast, and two
  markets smelling alike implies nothing about their future.
- Descriptors such as `FRESH`, `DENSE` or `SHARP` describe a modelled pattern. They
  are not ratings, recommendations or financial advice.
- The bot is read-only. It never asks for a wallet, a key or a signature, and it
  cannot execute a trade.

---

## Licence

MIT — see [LICENSE](LICENSE).

*Same data. A different sense.*
