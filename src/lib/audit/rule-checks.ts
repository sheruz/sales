/**
 * Rule-based website checks (no AI). Used as evidence for Claude pitch.
 */

import { probeUrl } from "@/lib/audit/fetch-homepage";

export type CheckResult = {
  id: string;
  label: string;
  pass: boolean | null;
  evidence: string;
  severity: "info" | "warn" | "fail";
  niche?: boolean;
};

export type RuleCheckInput = {
  homepageUrl: string;
  finalUrl: string | null;
  html: string;
  pageSpeedMobile: number | null;
  pageSpeedDesktop: number | null;
  /** ICP / company industry strings for niche checks */
  industries: string[];
};

const BOOKING_RE =
  /calendly|cal\.com|acuityscheduling|booksy|setmore|schedul|book\s*(a\s*)?(demo|call|appointment|meeting)|online\s*booking|reservation/i;
const CHAT_RE =
  /intercom|drift\.com|zendesk|tawk\.to|livechat|crisp\.chat|hubspot.*chat|chatbot|olark|tidio|facebook\.com\/plugins\/customerchat/i;
const FORM_RE =
  /<form[\s>]|type=["']email["']|contact\s*form|get\s*in\s*touch|request\s*a\s*quote/i;
const PORTAL_RE =
  /tenant\s*portal|owner\s*portal|client\s*portal|customer\s*portal|resident\s*portal|\blog\s*in\b|\bsign\s*in\b|my\s*account|member\s*login/i;
const APP_RE =
  /apps\.apple\.com|play\.google\.com|app\s*store|google\s*play|download\s*(our\s*)?app/i;
const SOCIAL_RE =
  /facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com/i;

function isPropertyNiche(industries: string[]): boolean {
  const blob = industries.join(" ").toLowerCase();
  return /real\s*estate|propert(y|ies)|property\s*manag|landlord|rental|multifamily|hoa|leasing/.test(
    blob
  );
}

function extractMetaDescription(html: string): string | null {
  const m =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i
    );
  return m?.[1]?.trim() || null;
}

function hasViewport(html: string): boolean {
  return /<meta[^>]+name=["']viewport["']/i.test(html);
}

function copyrightYear(html: string): number | null {
  const years = [
    ...html.matchAll(/©\s*(20\d{2})/gi),
    ...html.matchAll(/copyright\s*(?:©\s*)?(20\d{2})/gi),
  ].map((m) => Number(m[1]));
  if (!years.length) return null;
  return Math.max(...years);
}

function extractSameOriginLinks(html: string, baseUrl: string): string[] {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }
  const hrefs = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) =>
    m[1].trim()
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const href of hrefs) {
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const abs = new URL(href, baseUrl);
      if (abs.origin !== origin) continue;
      const key = abs.toString().split("#")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
      if (out.length >= 8) break;
    } catch {
      /* ignore */
    }
  }
  return out;
}

export async function runRuleChecks(
  input: RuleCheckInput
): Promise<CheckResult[]> {
  const html = input.html || "";
  const url = input.finalUrl || input.homepageUrl;
  const checks: CheckResult[] = [];

  const isHttps = /^https:/i.test(url);
  checks.push({
    id: "ssl",
    label: "HTTPS / SSL",
    pass: isHttps,
    evidence: isHttps
      ? `Homepage served over HTTPS (${url})`
      : `Homepage is not HTTPS (${url})`,
    severity: isHttps ? "info" : "fail",
  });

  const viewport = hasViewport(html);
  checks.push({
    id: "mobile_viewport",
    label: "Mobile viewport meta",
    pass: viewport,
    evidence: viewport
      ? "Found <meta name=\"viewport\">"
      : "Missing mobile viewport meta tag",
    severity: viewport ? "info" : "fail",
  });

  const mobileScore = input.pageSpeedMobile;
  const speedPass =
    mobileScore == null ? null : mobileScore >= 50;
  checks.push({
    id: "load_speed",
    label: "Mobile PageSpeed (≥50)",
    pass: speedPass,
    evidence:
      mobileScore == null
        ? "PageSpeed mobile score unavailable"
        : `Mobile performance score ${mobileScore}/100`,
    severity:
      mobileScore == null
        ? "warn"
        : mobileScore >= 50
          ? "info"
          : mobileScore >= 30
            ? "warn"
            : "fail",
  });

  const hasForm = FORM_RE.test(html);
  checks.push({
    id: "contact_form",
    label: "Contact form present",
    pass: hasForm,
    evidence: hasForm
      ? "Detected form / email field / contact CTA markup"
      : "No clear contact form markup on homepage",
    severity: hasForm ? "info" : "warn",
  });

  const hasBooking = BOOKING_RE.test(html);
  checks.push({
    id: "online_booking",
    label: "Online booking / scheduling",
    pass: hasBooking,
    evidence: hasBooking
      ? "Detected booking/scheduling widget or CTA"
      : "No online booking/scheduling signals on homepage",
    severity: hasBooking ? "info" : "warn",
  });

  const hasChat = CHAT_RE.test(html);
  checks.push({
    id: "live_chat",
    label: "Live chat / chatbot",
    pass: hasChat,
    evidence: hasChat
      ? "Detected chat/chatbot script or markup"
      : "No live chat/chatbot signals on homepage",
    severity: hasChat ? "info" : "info",
  });

  const year = copyrightYear(html);
  const currentYear = new Date().getUTCFullYear();
  const copyrightOk = year == null ? null : year >= currentYear - 1;
  checks.push({
    id: "copyright_year",
    label: "Copyright year current",
    pass: copyrightOk,
    evidence:
      year == null
        ? "No copyright year found on homepage"
        : `Copyright year ${year} (current ${currentYear})`,
    severity:
      year == null ? "info" : year >= currentYear - 1 ? "info" : "warn",
  });

  const meta = extractMetaDescription(html);
  const metaOk = Boolean(meta && meta.length >= 20);
  checks.push({
    id: "meta_description",
    label: "Meta description",
    pass: metaOk,
    evidence: metaOk
      ? `Meta description present (${meta!.slice(0, 80)}…)`
      : "Missing or very short meta description",
    severity: metaOk ? "info" : "warn",
  });

  const hasSocial = SOCIAL_RE.test(html);
  checks.push({
    id: "social_links",
    label: "Social links",
    pass: hasSocial,
    evidence: hasSocial
      ? "Found social network links on homepage"
      : "No social network links detected",
    severity: hasSocial ? "info" : "info",
  });

  const hasPortal = PORTAL_RE.test(html);
  checks.push({
    id: "client_portal",
    label: "Client / tenant portal or login",
    pass: hasPortal,
    evidence: hasPortal
      ? "Detected portal/login/account signals"
      : "No client/tenant portal or login signals",
    severity: hasPortal ? "info" : "warn",
  });

  const hasApp = APP_RE.test(html);
  checks.push({
    id: "mobile_app_links",
    label: "Mobile app store links",
    pass: hasApp,
    evidence: hasApp
      ? "Found app store / download app links"
      : "No mobile app store links",
    severity: "info",
  });

  // Broken links (sample up to 5 same-origin hrefs, skip homepage)
  const links = extractSameOriginLinks(html, url).filter(
    (l) => l.replace(/\/$/, "") !== url.replace(/\/$/, "")
  );
  const sample = links.slice(0, 5);
  let broken: string[] = [];
  for (const link of sample) {
    const probe = await probeUrl(link);
    if (!probe.ok && (probe.status === 0 || probe.status >= 400)) {
      broken.push(`${link} (${probe.status || "timeout"})`);
    }
  }
  const brokenPass = sample.length === 0 ? null : broken.length === 0;
  checks.push({
    id: "broken_links",
    label: "Homepage links (sample)",
    pass: brokenPass,
    evidence:
      sample.length === 0
        ? "No same-origin links to sample"
        : broken.length === 0
          ? `Checked ${sample.length} links — none returned 4xx/timeout`
          : `Broken/unreachable: ${broken.join("; ")}`,
    severity:
      broken.length > 0 ? "fail" : sample.length === 0 ? "info" : "info",
  });

  if (isPropertyNiche(input.industries)) {
    const propertySearch = /propert(y|ies)\s*(search|listing|for\s*rent|for\s*sale)|search\s*(rentals|listings)|view\s*listings|available\s*(units|homes)/i.test(
      html
    );
    checks.push({
      id: "property_listings",
      label: "Property search / listings",
      pass: propertySearch,
      evidence: propertySearch
        ? "Detected property search/listings signals"
        : "No property search/listings signals (ICP niche)",
      severity: propertySearch ? "info" : "warn",
      niche: true,
    });

    const rentalApp =
      /rental\s*application|apply\s*(online|now)|online\s*application|lease\s*application/i.test(
        html
      );
    checks.push({
      id: "rental_application",
      label: "Online rental application",
      pass: rentalApp,
      evidence: rentalApp
        ? "Detected online rental application CTA"
        : "No online rental application signals (ICP niche)",
      severity: rentalApp ? "info" : "warn",
      niche: true,
    });

    const tenantPortal = /tenant\s*portal|resident\s*portal|renter\s*login/i.test(
      html
    );
    checks.push({
      id: "tenant_portal",
      label: "Tenant portal",
      pass: tenantPortal,
      evidence: tenantPortal
        ? "Detected tenant/resident portal"
        : "No tenant portal signals (ICP niche)",
      severity: tenantPortal ? "info" : "warn",
      niche: true,
    });

    const ownerPortal = /owner\s*portal|landlord\s*portal|investor\s*login/i.test(
      html
    );
    checks.push({
      id: "owner_portal",
      label: "Owner portal",
      pass: ownerPortal,
      evidence: ownerPortal
        ? "Detected owner/landlord portal"
        : "No owner portal signals (ICP niche)",
      severity: ownerPortal ? "info" : "info",
      niche: true,
    });

    const maintenance =
      /maintenance\s*request|work\s*order|report\s*(a\s*)?repair|submit\s*a\s*request/i.test(
        html
      );
    checks.push({
      id: "maintenance_request",
      label: "Maintenance request form",
      pass: maintenance,
      evidence: maintenance
        ? "Detected maintenance/work-order request signals"
        : "No maintenance request form signals (ICP niche)",
      severity: maintenance ? "info" : "warn",
      niche: true,
    });
  }

  return checks;
}

/** Failed / warn checks suitable as pitch evidence (pass === false). */
export function failingChecks(checks: CheckResult[]): CheckResult[] {
  return checks.filter((c) => c.pass === false);
}
