/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B5e dry-run — code-only (no schema). Checks polish files + backlog doc.
 */
const fs = require("fs");
const path = require("path");

function exists(rel) {
  return fs.existsSync(path.join(__dirname, "..", rel));
}

function main() {
  const files = {
    "countdown.ts": exists("src/lib/billing/countdown.ts"),
    "deadline-countdown.tsx": exists(
      "src/components/billing/deadline-countdown.tsx"
    ),
    "choose-what-stays-client.tsx": exists(
      "src/components/billing/choose-what-stays-client.tsx"
    ),
    "b5e-plan-pause.test.ts": exists("src/lib/billing/b5e-plan-pause.test.ts"),
    "docs/backlog.md": exists("docs/backlog.md"),
  };
  const gaps = [];
  for (const [f, ok] of Object.entries(files)) {
    if (!ok) gaps.push(`missing ${f}`);
  }

  let backlogItems = [];
  if (files["docs/backlog.md"]) {
    const md = fs.readFileSync(
      path.join(__dirname, "..", "docs/backlog.md"),
      "utf8"
    );
    backlogItems = [
      "Org detail Actions menu",
      "Platform-admins tab",
      "Audit typeahead",
      "Invoices detail drawer",
      "Transactions tax",
    ].filter((needle) => md.toLowerCase().includes(needle.toLowerCase().split(" ")[0]));
  }

  console.log(
    JSON.stringify(
      {
        slice: "B5e",
        mode: "dry-run",
        schemaChanges: false,
        files,
        backlogPresent: files["docs/backlog.md"],
        backlogHintsMatched: backlogItems.length,
        gaps,
        wouldApply: false,
        note: "Code-only. Say GO → npm run build && pm2 restart sales",
        next: "Say GO to build + pm2 restart sales",
      },
      null,
      2
    )
  );
}

main();
