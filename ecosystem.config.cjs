// PM2 process definition.
//
//   npm ci && pm2 start ecosystem.config.cjs
//
// One instance only. Telegram delivers each update once, and a second poller
// on the same token makes both fight for updates and answer erratically.
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "hound-telegram-bot",
      cwd: __dirname,
      script: path.join(__dirname, "src", "index.js"),
      interpreter: "node",

      instances: 1,
      exec_mode: "fork",

      env: { NODE_ENV: "production" },
      env_production: { NODE_ENV: "production" },

      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      kill_timeout: 5000,
      restart_delay: 3000,

      merge_logs: true,
      time: true,
      out_file: path.join(__dirname, "logs", "bot-out.log"),
      error_file: path.join(__dirname, "logs", "bot-error.log"),
    },
  ],
};
