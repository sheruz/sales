/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("child_process");
const path = require("path");

require("./load-env");

const rootDir = path.join(__dirname, "..");
const port = process.env.PORT || "3000";

process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

const child = spawn(
  "npx",
  ["next", "start", "-H", "0.0.0.0", "-p", String(port)],
  { cwd: rootDir, stdio: "inherit", env: process.env, shell: true }
);

child.on("exit", (code) => process.exit(code ?? 0));
