import {
  classifyEmailType,
  extractEmailsFromText,
  extractPhonesFromText,
  extractSocialLinks,
} from "@/lib/sourcing/email-extract";

const USER_AGENT =
  "RevenueOS-SourcingBot/1.0 (+https://sales.zoiax.com; contact=support@zoiax.com)";
const MAX_PAGES = 5;
const TIMEOUT_MS = 10_000;
const MIN_DELAY_MS = 400;

export type CrawlResult = {
  status: "DONE" | "FAILED" | "BLOCKED";
  error?: string;
  emails: Array<{
    email: string;
    sourcePage: string;
    type: "GENERIC" | "PERSONAL";
  }>;
  phones: string[];
  linkedInUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  pagesVisited: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeBase(website: string): URL | null {
  try {
    return new URL(website.includes("://") ? website : `https://${website}`);
  } catch {
    return null;
  }
}

async function fetchText(
  url: string
): Promise<{ ok: boolean; status: number; text: string; blocked: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const blocked = res.status === 403 || res.status === 429;
    const text = blocked ? "" : await res.text();
    return { ok: res.ok, status: res.status, text, blocked };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      text: "",
      blocked: false,
    };
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

function candidatePaths(base: URL): string[] {
  const roots = ["/", "/contact", "/contact-us", "/about", "/about-us"];
  return roots.map((p) => new URL(p, base.origin).toString());
}

export async function crawlWebsiteForContacts(
  website: string
): Promise<CrawlResult> {
  const base = normalizeBase(website);
  if (!base) {
    return {
      status: "FAILED",
      error: "Invalid website URL",
      emails: [],
      phones: [],
      linkedInUrl: null,
      facebookUrl: null,
      instagramUrl: null,
      pagesVisited: 0,
    };
  }

  const emailMap = new Map<
    string,
    { email: string; sourcePage: string; type: "GENERIC" | "PERSONAL" }
  >();
  const phones = new Set<string>();
  let linkedInUrl: string | null = null;
  let facebookUrl: string | null = null;
  let instagramUrl: string | null = null;
  let pagesVisited = 0;

  const paths = candidatePaths(base).slice(0, MAX_PAGES);

  for (const url of paths) {
    const path = new URL(url).pathname;
    const robots = await robotsAllows(base.origin, path);
    if (!robots.allowed) {
      return {
        status: "BLOCKED",
        error: "Blocked by robots.txt",
        emails: [...emailMap.values()],
        phones: [...phones],
        linkedInUrl,
        facebookUrl,
        instagramUrl,
        pagesVisited,
      };
    }

    await sleep(MIN_DELAY_MS);
    const page = await fetchText(url);
    pagesVisited += 1;

    if (page.blocked) {
      return {
        status: "BLOCKED",
        error: `HTTP ${page.status}`,
        emails: [...emailMap.values()],
        phones: [...phones],
        linkedInUrl,
        facebookUrl,
        instagramUrl,
        pagesVisited,
      };
    }
    if (!page.ok) continue;

    for (const email of extractEmailsFromText(page.text)) {
      if (!emailMap.has(email)) {
        emailMap.set(email, {
          email,
          sourcePage: url,
          type: classifyEmailType(email),
        });
      }
    }
    for (const phone of extractPhonesFromText(page.text)) phones.add(phone);

    const social = extractSocialLinks(page.text);
    linkedInUrl = linkedInUrl || social.linkedInUrl;
    facebookUrl = facebookUrl || social.facebookUrl;
    instagramUrl = instagramUrl || social.instagramUrl;
  }

  if (pagesVisited === 0) {
    return {
      status: "FAILED",
      error: "No pages fetched",
      emails: [],
      phones: [],
      linkedInUrl: null,
      facebookUrl: null,
      instagramUrl: null,
      pagesVisited: 0,
    };
  }

  return {
    status: "DONE",
    emails: [...emailMap.values()],
    phones: [...phones],
    linkedInUrl,
    facebookUrl,
    instagramUrl,
    pagesVisited,
  };
}
