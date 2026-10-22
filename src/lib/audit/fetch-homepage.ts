/**
 * Homepage fetch for audits — same crawler rules (UA, timeout, robots) + SSRF.
 */

import { safeFetch, assertSafeOutboundUrlResolved } from "@/lib/security/ssrf";
import { ValidationError } from "@/lib/api/response";

const USER_AGENT =
  "RevenueOS-SourcingBot/1.0 (+https://sales.zoiax.com; contact=support@zoiax.com)";
const TIMEOUT_MS = 10_000;

export type HomepageFetchResult = {
  ok: boolean;
  url: string | null;
  finalUrl: string | null;
  status: number;
  html: string;
  blocked: boolean;
  blockedByRobots: boolean;
  error?: string;
};

function normalizeBase(website: string): URL | null {
  try {
    return new URL(website.includes("://") ? website : `https://${website}`);
  } catch {
    return null;
  }
}

async function fetchText(
  url: string
): Promise<{
  ok: boolean;
  status: number;
  text: string;
  blocked: boolean;
  finalUrl: string;
  ssrfBlocked?: boolean;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await assertSafeOutboundUrlResolved(url, { allowHttp: true });
    const res = await safeFetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      ssrf: { allowHttp: true },
    });
    const blocked = res.status === 403 || res.status === 429;
    const text = blocked ? "" : await res.text();
    return {
      ok: res.ok,
      status: res.status,
      text,
      blocked,
      finalUrl: res.url || url,
    };
  } catch (err) {
    if (err instanceof ValidationError) {
      return {
        ok: false,
        status: 0,
        text: "",
        blocked: true,
        finalUrl: url,
        ssrfBlocked: true,
      };
    }
    return { ok: false, status: 0, text: "", blocked: false, finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

async function robotsAllows(
  origin: string,
  path: string
): Promise<{ allowed: boolean; blockedByRobots: boolean }> {
  const robotsUrl = `${origin}/robots.txt`;
  const res = await fetchText(robotsUrl);
  if (res.ssrfBlocked) return { allowed: false, blockedByRobots: false };
  if (res.blocked) return { allowed: false, blockedByRobots: true };
  if (!res.ok || !res.text) return { allowed: true, blockedByRobots: false };

  const lines = res.text.split(/\r?\n/);
  let applies = false;
  const disallows: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^user-agent:\s*\*/i.test(t)) {
      applies = true;
      continue;
    }
    if (/^user-agent:/i.test(t)) {
      applies = false;
      continue;
    }
    if (applies) {
      const m = t.match(/^disallow:\s*(.*)$/i);
      if (m) disallows.push(m[1].trim());
    }
  }
  for (const rule of disallows) {
    if (rule === "/") return { allowed: false, blockedByRobots: true };
    if (rule && path.startsWith(rule)) {
      return { allowed: false, blockedByRobots: true };
    }
  }
  return { allowed: true, blockedByRobots: false };
}

/** Fetch homepage HTML with robots.txt respect (same as contact crawler). */
export async function fetchHomepageHtml(
  website: string
): Promise<HomepageFetchResult> {
  const base = normalizeBase(website);
  if (!base) {
    return {
      ok: false,
      url: null,
      finalUrl: null,
      status: 0,
      html: "",
      blocked: false,
      blockedByRobots: false,
      error: "Invalid website URL",
    };
  }

  try {
    await assertSafeOutboundUrlResolved(base.toString(), { allowHttp: true });
  } catch {
    return {
      ok: false,
      url: base.toString(),
      finalUrl: null,
      status: 0,
      html: "",
      blocked: true,
      blockedByRobots: false,
      error: "SSRF blocked",
    };
  }

  const robots = await robotsAllows(base.origin, "/");
  if (!robots.allowed) {
    return {
      ok: false,
      url: base.toString(),
      finalUrl: null,
      status: 0,
      html: "",
      blocked: true,
      blockedByRobots: true,
      error: "Blocked by robots.txt",
    };
  }

  const home = new URL("/", base.origin).toString();
  const res = await fetchText(home);
  if (res.ssrfBlocked) {
    return {
      ok: false,
      url: home,
      finalUrl: res.finalUrl,
      status: 0,
      html: "",
      blocked: true,
      blockedByRobots: false,
      error: "SSRF blocked",
    };
  }
  if (res.blocked) {
    return {
      ok: false,
      url: home,
      finalUrl: res.finalUrl,
      status: res.status,
      html: "",
      blocked: true,
      blockedByRobots: false,
      error: `HTTP ${res.status}`,
    };
  }
  if (!res.ok || !res.text) {
    return {
      ok: false,
      url: home,
      finalUrl: res.finalUrl,
      status: res.status,
      html: "",
      blocked: false,
      blockedByRobots: false,
      error: res.status ? `HTTP ${res.status}` : "Fetch failed",
    };
  }

  return {
    ok: true,
    url: home,
    finalUrl: res.finalUrl,
    status: res.status,
    html: res.text,
    blocked: false,
    blockedByRobots: false,
  };
}

/** HEAD/GET a URL with short timeout — used for broken-link sampling. */
export async function probeUrl(
  url: string,
  timeoutMs = 5_000
): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await assertSafeOutboundUrlResolved(url, { allowHttp: true });
    const res = await safeFetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      ssrf: { allowHttp: true },
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}
