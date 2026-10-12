import {
  EnrichmentApiError,
  EnrichmentRateLimitError,
  type AccountCredits,
  type DomainSearchResult,
  type EnrichmentPerson,
  type EnrichmentProvider,
  type VerifyEmailResult,
} from "@/lib/enrichment/types";
import { mapHunterVerificationStatus } from "@/lib/enrichment/verification";

const HUNTER_BASE = "https://api.hunter.io/v2";

async function hunterFetch(
  path: string,
  apiKey: string,
  params: Record<string, string> = {},
  attempt = 1
): Promise<unknown> {
  const url = new URL(`${HUNTER_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") || "2");
    if (attempt < 4) {
      await new Promise((r) =>
        setTimeout(r, Math.min(30_000, Math.max(1000, retryAfter * 1000) * attempt))
      );
      return hunterFetch(path, apiKey, params, attempt + 1);
    }
    throw new EnrichmentRateLimitError("Hunter rate limited (429)");
  }

  const json = (await res.json().catch(() => ({}))) as {
    data?: unknown;
    errors?: Array<{ details?: string; id?: string }>;
  };

  if (!res.ok) {
    const msg =
      json.errors?.[0]?.details ||
      `Hunter API error ${res.status}`;
    throw new EnrichmentApiError(msg, res.status, res.status >= 500 || res.status === 429);
  }

  return json;
}

function mapPerson(raw: Record<string, unknown>): EnrichmentPerson | null {
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  if (!email.includes("@")) return null;
  const first =
    typeof raw.first_name === "string" ? raw.first_name.trim() : null;
  const last = typeof raw.last_name === "string" ? raw.last_name.trim() : null;
  const full =
    [first, last].filter(Boolean).join(" ") ||
    (typeof raw.value === "string" ? raw.value : null);
  return {
    firstName: first,
    lastName: last,
    fullName: full,
    email: email.toLowerCase(),
    title: typeof raw.position === "string" ? raw.position : null,
    seniority: typeof raw.seniority === "string" ? raw.seniority : null,
    linkedInUrl:
      typeof raw.linkedin === "string"
        ? raw.linkedin
        : typeof raw.linkedin_url === "string"
          ? raw.linkedin_url
          : null,
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
  };
}

export class HunterAdapter implements EnrichmentProvider {
  readonly name = "hunter";

  constructor(private readonly apiKey: string) {}

  async domainSearch(domain: string): Promise<DomainSearchResult> {
    // Free/Starter Hunter plans cap domain-search at 10 results — requesting more fails the call.
    const json = (await hunterFetch("/domain-search", this.apiKey, {
      domain,
      limit: "10",
    })) as {
      data?: {
        domain?: string;
        emails?: Record<string, unknown>[];
      };
    };
    const people = (json.data?.emails ?? [])
      .map(mapPerson)
      .filter((p): p is EnrichmentPerson => Boolean(p));
    return {
      domain: json.data?.domain || domain,
      people,
      raw: json.data,
    };
  }

  async verifyEmail(email: string): Promise<VerifyEmailResult> {
    const json = (await hunterFetch("/email-verifier", this.apiKey, {
      email,
    })) as {
      data?: {
        status?: string;
        result?: string;
        score?: number;
        email?: string;
      };
    };
    const status = mapHunterVerificationStatus(
      json.data?.status || json.data?.result
    );
    return {
      email: (json.data?.email || email).toLowerCase(),
      status,
      score: typeof json.data?.score === "number" ? json.data.score : null,
      raw: json.data,
    };
  }

  async getCredits(): Promise<AccountCredits> {
    const json = (await hunterFetch("/account", this.apiKey)) as {
      data?: {
        requests?: {
          credits?: { available?: number; used?: number };
        };
      };
    };
    const credits = json.data?.requests?.credits;
    return {
      available:
        typeof credits?.available === "number" ? credits.available : null,
      used: typeof credits?.used === "number" ? credits.used : null,
      raw: json.data,
    };
  }
}
