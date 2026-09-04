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
 * Meta / Facebook — Graph API or customer/licensed payloads only.
 */
export const metaSignalConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.META,
  provider: "meta_graph",
  displayName: "Meta / Facebook (Graph API)",
  description:
    "Business page and advertising/business signals via Meta Graph API where permissions permit, or licensed/customer-provided records. No scraping.",

  async validate(ctx) {
    if (recordsFromParams(ctx)) return { ok: true };
    if (hasOfficialCreds(ctx.credentials, ["accessToken"])) return { ok: true };
    return {
      ok: false,
      message:
        "Provide Meta Graph accessToken, or params.records from approved/licensed data.",
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

    const token = ctx.credentials.accessToken;
    const pageId = str(ctx.configuration.pageId || ctx.configuration.page_id);
    if (!pageId) {
      return {
        rawRecords: [],
        metadata: {
          note: "Set configuration.pageId for Graph API page fetch, or pass params.records.",
        },
      };
    }

    const result = await fetchJson(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/posts?fields=id,message,created_time,permalink_url&limit=25&access_token=${encodeURIComponent(token)}`
    );

    if (!result.ok) {
      return {
        rawRecords: [],
        metadata: {
          mode: "meta_graph",
          apiError: result.error,
          note: "Graph API access denied or incomplete — check app permissions. No scrape fallback.",
        },
      };
    }

    const data = asRecord(result.data);
    const list = Array.isArray(data?.data) ? data!.data : [];
    return {
      rawRecords: list.map((post) => ({
        ...(asRecord(post) || {}),
        pageId,
        companyName: str(ctx.configuration.companyName || ctx.configuration.pageName || pageId),
        website: str(ctx.configuration.website),
      })),
      metadata: { mode: "meta_graph_posts" },
    };
  },

  normalize(raw): NormalizedSignalRecord | null {
    const r = asRecord(raw);
    if (!r) return null;
    const companyName = str(r.companyName || r.company_name || r.pageName);
    if (!companyName) return null;
    const title =
      str(r.title) ||
      (str(r.message) ? str(r.message).slice(0, 120) : "Meta business activity");
    const website = str(r.website);

    return {
      signalType: SignalType.SOCIAL_ACTIVITY,
      title,
      description: str(r.message || r.description) || null,
      evidenceUrl: str(r.permalink_url || r.url || r.evidenceUrl) || null,
      confidence: Number(r.confidence ?? 70),
      occurredAt: (r.created_time || r.occurredAt) as string | Date | null | undefined,
      externalId: str(r.id || r.externalId) || `${companyName}:${title}`,
      company: {
        name: companyName,
        website: website || null,
        domain: extractDomain(website) || str(r.domain) || null,
        industry: str(r.industry) || null,
      },
      whyNow: str(r.whyNow) || `Meta/Facebook business signal for ${companyName}`,
      recommendedAction:
        str(r.recommendedAction) || "Review Meta activity and qualify intent",
      rawData: { meta: r },
    };
  },
};
