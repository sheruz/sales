import { SignalType, SourceConnectorType } from "@prisma/client";
import { extractDomain } from "@/services/company.service";
import type {
  ConnectorFetchContext,
  NormalizedSignalRecord,
  SourceConnectorAdapter,
} from "@/lib/connectors/types";
import {
  asRecord,
  fetchJson,
  hasOfficialCreds,
  recordsFromParams,
  str,
} from "@/lib/connectors/adapters/shared";

/**
 * LinkedIn — official API / licensed provider / customer-provided data only.
 * Does not scrape LinkedIn.
 */
export const linkedInSignalConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.LINKEDIN,
  provider: "linkedin_official",
  displayName: "LinkedIn (Official / Licensed)",
  description:
    "Company and approved professional activity signals via LinkedIn official API, a licensed provider payload, or customer-exported records. Scraping is not supported.",

  async validate(ctx) {
    if (recordsFromParams(ctx)) return { ok: true };
    if (hasOfficialCreds(ctx.credentials, ["accessToken", "apiKey"])) {
      return { ok: true };
    }
    return {
      ok: false,
      message:
        "Provide LinkedIn accessToken/apiKey credentials, or params.records from an official/licensed/customer export.",
    };
  },

  async fetch(ctx: ConnectorFetchContext) {
    const fromParams = recordsFromParams(ctx);
    if (fromParams) {
      return {
        rawRecords: fromParams,
        metadata: { mode: "customer_or_licensed_payload" },
      };
    }

    const token =
      ctx.credentials.accessToken || ctx.credentials.apiKey || "";
    const orgUrn = str(
      ctx.configuration.organizationUrn || ctx.configuration.organizationId
    );

    // Official Organization Lookup where product access permits
    if (orgUrn) {
      const urn = orgUrn.startsWith("urn:")
        ? orgUrn
        : `urn:li:organization:${orgUrn}`;
      const encoded = encodeURIComponent(urn);
      const result = await fetchJson(
        `https://api.linkedin.com/v2/organizations/${encoded}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
        }
      );
      if (result.ok && result.data) {
        return {
          rawRecords: [result.data],
          metadata: { mode: "linkedin_organization_api" },
        };
      }
      return {
        rawRecords: [],
        metadata: {
          mode: "linkedin_organization_api",
          apiError: result.error,
          note: "Official API returned no data — check product access / scopes. Do not fall back to scraping.",
        },
      };
    }

    return {
      rawRecords: [],
      metadata: {
        mode: "linkedin_official",
        note: "Set configuration.organizationUrn for Organization API, or pass params.records from licensed/customer data.",
      },
    };
  },

  normalize(raw): NormalizedSignalRecord | null {
    const r = asRecord(raw);
    if (!r) return null;

    const companyName =
      str(r.companyName || r.company_name || r.localizedName || r.name) ||
      str((r.company as Record<string, unknown> | undefined)?.name);
    if (!companyName) return null;

    const website = str(r.website || r.companyWebsite || r.vanityName);
    const title =
      str(r.title || r.headline || r.signalTitle) ||
      `LinkedIn company signal: ${companyName}`;
    const activity = str(r.activityType || r.signal_type || "SOCIAL_ACTIVITY");

    return {
      signalType:
        activity.toUpperCase().includes("LEADER")
          ? SignalType.LEADERSHIP_CHANGE
          : SignalType.SOCIAL_ACTIVITY,
      title,
      description: str(r.description || r.text || r.summary) || null,
      evidenceUrl: str(r.url || r.evidenceUrl || r.permalink) || null,
      evidenceText: str(r.evidenceText) || null,
      confidence: Number(r.confidence ?? 75),
      occurredAt: (r.occurredAt || r.publishedAt || r.createdAt) as
        | string
        | Date
        | null
        | undefined,
      externalId: str(r.externalId || r.id || r.urn) || `${companyName}:${title}`,
      company: {
        name: companyName,
        website: website || null,
        domain: extractDomain(website) || str(r.domain) || null,
        industry: str(r.industry) || null,
        country: str(r.country) || null,
        description: str(r.companyDescription) || null,
      },
      contact:
        str(r.firstName || r.contactEmail)
          ? {
              firstName: str(r.firstName, "Contact"),
              lastName: str(r.lastName, "Unknown"),
              email: str(r.contactEmail || r.email) || null,
              title: str(r.jobTitle || r.contactTitle) || null,
              linkedInUrl: str(r.linkedInUrl || r.profileUrl) || null,
            }
          : null,
      whyNow:
        str(r.whyNow) ||
        `Approved LinkedIn activity for ${companyName}`,
      likelyProblem: str(r.likelyProblem) || null,
      recommendedAction:
        str(r.recommendedAction) ||
        "Review LinkedIn signal and identify decision maker",
      rawData: { linkedin: r },
    };
  },
};
