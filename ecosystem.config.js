/**
 * pm2 ecosystem for sales-platform (Next app + Audit 2.0 worker).
 *
 *   pm2 start ecosystem.config.js
 *   pm2 restart sales sales-audit-worker
 *
 * Do not start unrelated apps from this file.
 */
module.exports = {
  apps: [
    {
      name: "sales",
      cwd: __dirname,
      script: "scripts/start.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "sales-audit-worker",
      cwd: __dirname,
      script: "scripts/audit-worker.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "800M",
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production",
        PLAYWRIGHT_BROWSERS_PATH: "0",
      },
    },
  ],
};
