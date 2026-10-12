import type { EnrichmentPerson } from "@/lib/enrichment/types";

export const DEFAULT_TITLE_PRIORITY: string[] = [
  "Owner",
  "Founder",
  "Co-Founder",
  "CEO",
  "Chief Executive Officer",
  "President",
  "Managing Director",
  "Broker/Owner",
  "Managing Broker",
  "Principal",
  "Team Lead",
  "CTO",
  "Chief Technology Officer",
];

function normalizeTitle(title: string | null | undefined): string {
  return (title || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function titleRank(
  title: string | null | undefined,
  priority: string[]
): number {
  const t = normalizeTitle(title);
  if (!t) return priority.length + 50;
  const idx = priority.findIndex((p) => {
    const n = p.toLowerCase();
    return t === n || t.includes(n) || n.includes(t);
  });
  return idx === -1 ? priority.length + 20 : idx;
}

function isExecutiveSeniority(seniority: string | null | undefined): boolean {
  const s = (seniority || "").toLowerCase();
  return s.includes("executive") || s === "founder" || s === "owner";
}

/**
 * Pick best decision-maker: prefer executive seniority + title priority list,
 * else highest confidence personal email.
 */
export function pickDecisionMaker(
  people: EnrichmentPerson[],
  titlePriority: string[] = DEFAULT_TITLE_PRIORITY
): EnrichmentPerson | null {
  if (!people.length) return null;

  const withEmail = people.filter((p) => p.email?.includes("@"));
  if (!withEmail.length) return null;

  const scored = withEmail.map((p) => {
    const rank = titleRank(p.title, titlePriority);
    const execBonus = isExecutiveSeniority(p.seniority) ? -5 : 0;
    const confidence = p.confidence ?? 0;
    return {
      person: p,
      // lower score = better
      score: rank + execBonus - confidence / 100,
      rank,
      confidence,
    };
  });

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    return a.score - b.score;
  });

  const bestRanked = scored.find((s) => s.rank < titlePriority.length);
  if (bestRanked) return bestRanked.person;

  scored.sort((a, b) => b.confidence - a.confidence);
  return scored[0]?.person ?? null;
}

/** Prefer info@ / contact@ over other generic crawled emails. */
export function pickBestGenericEmail(
  emails: Array<{ email: string; type?: string }>
): string | null {
  if (!emails.length) return null;
  const lower = emails.map((e) => e.email.toLowerCase().trim());
  const prefer = ["info@", "contact@", "hello@", "office@", "admin@"];
  for (const prefix of prefer) {
    const hit = lower.find((e) => e.startsWith(prefix));
    if (hit) return hit;
  }
  return lower[0] ?? null;
}
