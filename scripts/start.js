/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

require("./load-env");

const rootDir = path.join(__dirname, "..");
const port = process.env.APP_PORT || process.env.PORT || "3000";

process.env.PORT = String(port);
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

// Use next start from project root — most reliable for PM2 + nginx deployments.
// Standalone mode requires extra static file copying and often causes 404 chunk errors.
const useStandalone = process.env.USE_STANDALONE === "true";
const standaloneServer = path.join(rootDir, ".next", "standalone", "server.js");

console.log(`[start] Starting on http://${process.env.HOSTNAME}:${port}`);

if (useStandalone && fs.existsSync(standaloneServer)) {
  console.log("[start] Mode: standalone");
  const child = spawn("node", ["server.js"], {
    cwd: path.join(rootDir, ".next", "standalone"),
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  console.log("[start] Mode: next start (recommended)");
  const child = spawn(
    "npx",
    ["next", "start", "-H", "0.0.0.0", "-p", String(port)],
    {
      cwd: rootDir,
      stdio: "inherit",
      env: process.env,
      shell: true,
    }
  );
  child.on("exit", (code) => process.exit(code ?? 0));
}
