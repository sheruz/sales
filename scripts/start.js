/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

require("./load-env");

const rootDir = path.join(__dirname, "..");
const port = process.env.APP_PORT || process.env.PORT || "3000";

process.env.PORT = String(port);
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

const standaloneDir = path.join(rootDir, ".next", "standalone");
const standaloneServer = path.join(standaloneDir, "server.js");

console.log(`[start] Starting on http://${process.env.HOSTNAME}:${port}`);

if (fs.existsSync(standaloneServer)) {
  const child = spawn("node", ["server.js"], {
    cwd: standaloneDir,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  const child = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
    shell: true,
  });

  child.on("exit", (code) => process.exit(code ?? 0));
}
