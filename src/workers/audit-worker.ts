/**
 * sales-audit-worker — polls DeepAuditJob queue, max 2 concurrent browsers.
 * Main Next `sales` process must never import browser-runner for request paths.
 */

import { hostname } from "os";
import { deepAuditService } from "@/services/deep-audit.service";
import { cleanupExpiredEvidence } from "@/lib/audit/evidence-store";
import {
  DEEP_AUDIT_MAX_CONCURRENT,
} from "@/lib/audit/deep/types";
import { killOrphanedChromium } from "@/lib/audit/deep/browser-runner";

const WORKER_ID = `audit-worker:${hostname()}:${process.pid}`;
const POLL_MS = Number(process.env.AUDIT_WORKER_POLL_MS || 3000);
const MEMORY_LIMIT_MB = Number(process.env.AUDIT_WORKER_MEMORY_MB || 750);

let active = 0;
let stopping = false;
let lastCleanup = 0;

function rssMb(): number {
  return process.memoryUsage().rss / (1024 * 1024);
}

async function tick() {
  if (stopping) return;
  if (rssMb() > MEMORY_LIMIT_MB) {
    console.warn(
      `[${WORKER_ID}] memory guard ${rssMb().toFixed(0)}MB > ${MEMORY_LIMIT_MB}MB — skipping claim, killing orphans`
    );
    await killOrphanedChromium();
    if (global.gc) global.gc();
    return;
  }

  const slots = DEEP_AUDIT_MAX_CONCURRENT - active;
  if (slots <= 0) return;

  const claimed = await deepAuditService.claimJobs(WORKER_ID, slots);
  for (const job of claimed) {
    active += 1;
    console.log(`[${WORKER_ID}] browser job start ${job.id} company=${job.companyId}`);
    void deepAuditService
      .processClaimedJob(job.id)
      .catch((err) => {
        console.error(`[${WORKER_ID}] job ${job.id} error`, err);
      })
      .finally(() => {
        active -= 1;
        console.log(`[${WORKER_ID}] browser job end ${job.id}`);
      });
  }

  // Evidence retention cleanup ~ hourly
  if (Date.now() - lastCleanup > 3_600_000) {
    lastCleanup = Date.now();
    const cleaned = await cleanupExpiredEvidence().catch((e) => {
      console.warn(`[${WORKER_ID}] evidence cleanup failed`, e);
      return { deletedFiles: 0, deletedDirs: 0 };
    });
    if (cleaned.deletedFiles || cleaned.deletedDirs) {
      console.log(
        `[${WORKER_ID}] evidence cleanup files=${cleaned.deletedFiles} dirs=${cleaned.deletedDirs}`
      );
    }
  }
}

async function main() {
  // Isolate browsers to this app's cache when unset
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  }

  console.log(
    `[${WORKER_ID}] starting poll=${POLL_MS}ms maxConcurrent=${DEEP_AUDIT_MAX_CONCURRENT} playwrightPath=${process.env.PLAYWRIGHT_BROWSERS_PATH}`
  );

  const timer = setInterval(() => {
    void tick();
  }, POLL_MS);

  const shutdown = async (sig: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[${WORKER_ID}] ${sig} — draining ${active} jobs`);
    clearInterval(timer);
    const deadline = Date.now() + 25_000;
    while (active > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
    }
    await killOrphanedChromium();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  void tick();
}

main().catch((err) => {
  console.error("[audit-worker] fatal", err);
  process.exit(1);
});
