import type { ConnectorFetchContext } from "@/lib/connectors/types";

/**
 * Shared helpers for Phase 11 adapters.
 * Sources may use: official APIs, licensed providers, or customer-provided records.
 * Never rely on prohibited scraping/automation.
 */

export function recordsFromParams(ctx: ConnectorFetchContext): unknown[] | null {
  const records = ctx.params?.records ?? ctx.params?.licensedPayload;
  if (Array.isArray(records) && records.length > 0) return records;
  const events = ctx.params?.events;
  if (Array.isArray(events) && events.length > 0) return events;
  return null;
}

export function hasOfficialCreds(
  credentials: Record<string, string>,
  keys: string[]
): boolean {
  return keys.some((k) => Boolean(credentials[k]?.trim()));
}

export async function fetchJson(
  url: string,
  init?: RequestInit,
  allowedHostSuffixes?: string[]
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  try {
    const { assertSafeOutboundUrl } = await import("@/lib/security/ssrf");
    assertSafeOutboundUrl(url, allowedHostSuffixes);
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers || {}),
      },
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: `HTTP ${res.status}`,
      };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  }
}

export function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v).trim();
}

export function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
