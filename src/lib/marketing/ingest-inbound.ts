import type { WebsiteInboundPayload } from "@/services/website-inbound.service";
import { websiteInboundService } from "@/services/website-inbound.service";

/**
 * Create inbound CRM records. Retries once on failure.
 * Same-app call (no HTTP loopback).
 */
export async function ingestInboundWithRetry(
  payload: WebsiteInboundPayload
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const data = await websiteInboundService.ingest(payload);
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[marketing-inbound] first attempt failed", message);
    try {
      await new Promise((r) => setTimeout(r, 600));
      const data = await websiteInboundService.ingest(payload);
      return { ok: true, data };
    } catch (err2) {
      return {
        ok: false,
        error: err2 instanceof Error ? err2.message : String(err2),
      };
    }
  }
}
