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

function normalizeCrmRecord(
  r: Record<string, unknown>,
  provider: string
): NormalizedSignalRecord | null {
  const props = asRecord(r.properties) || r;
  const companyName = str(
    props.name ||
      props.company ||
      props.company_name ||
      r.Name ||
      r.name ||
      props.domain
  );
  if (!companyName) return null;

  const website = str(
    props.website || props.domain || props.Website || r.Website || r.website
  );
  const domain =
    extractDomain(website) ||
    str(props.domain || r.domain).toLowerCase() ||
    null;
  const title =
    str(r.title || props.dealname || props.Name || props.subject) ||
    `${provider} CRM activity: ${companyName}`;

  const email = str(
    props.email ||
      props.Email ||
      r.Email ||
      (r.contact as Record<string, unknown> | undefined)?.email
  );

  return {
    signalType: SignalType.CRM_ACTIVITY,
    title,
    description: str(props.description || r.description || props.notes) || null,
    evidenceUrl: str(r.url || props.url || r.evidenceUrl) || null,
    confidence: Number(r.confidence ?? 80),
    occurredAt: (props.lastmodifieddate ||
      props.hs_lastmodifieddate ||
      r.updated_at ||
      r.occurredAt) as string | Date | null | undefined,
    externalId: str(r.id || r.Id || props.hs_object_id || r.externalId) ||
      `${provider}:${companyName}:${title}`,
    company: {
      name: companyName,
      website: website || (domain ? `https://${domain}` : null),
      domain,
      industry: str(props.industry || r.Industry) || null,
      country: str(props.country || r.Country) || null,
      city: str(props.city || r.City) || null,
    },
    contact: email
      ? {
          firstName: str(
            props.firstname || props.FirstName || r.FirstName,
            "Contact"
          ),
          lastName: str(
            props.lastname || props.LastName || r.LastName,
            "Unknown"
          ),
          email,
          title: str(props.jobtitle || props.Title || r.Title) || null,
          phone: str(props.phone || r.Phone) || null,
        }
      : null,
    whyNow: str(r.whyNow) || `Synced from ${provider}: ${title}`,
    recommendedAction:
      str(r.recommendedAction) || "Review CRM activity and continue pipeline",
    estimatedValue: props.amount || props.Amount || r.amount
      ? Number(props.amount || props.Amount || r.amount)
      : null,
    rawData: { [provider.toLowerCase()]: r },
  };
}

/** HubSpot CRM — private app token or customer export */
export const hubspotConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.HUBSPOT,
  provider: "hubspot",
  displayName: "HubSpot CRM",
  description:
    "Import companies/contacts/deals via HubSpot CRM API (private app token) or customer-exported records.",

  async validate(ctx) {
    if (recordsFromParams(ctx)) return { ok: true };
    if (hasOfficialCreds(ctx.credentials, ["accessToken", "apiKey"])) {
      return { ok: true };
    }
    return {
      ok: false,
      message: "Provide HubSpot accessToken (private app), or params.records.",
    };
  },

  async fetch(ctx: ConnectorFetchContext) {
    const fromParams = recordsFromParams(ctx);
    if (fromParams) {
      return {
        rawRecords: fromParams,
        metadata: { mode: "customer_export" },
      };
    }

    const token = ctx.credentials.accessToken || ctx.credentials.apiKey;
    const objectType = str(ctx.configuration.objectType || "companies");
    const result = await fetchJson(
      `https://api.hubapi.com/crm/v3/objects/${encodeURIComponent(objectType)}?limit=50&properties=name,domain,website,industry,phone,city,country,description`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!result.ok) {
      return {
        rawRecords: [],
        metadata: {
          mode: "hubspot_api",
          apiError: result.error,
          note: "HubSpot API failed — verify private app scopes. No scrape fallback.",
        },
      };
    }

    const data = asRecord(result.data);
    const results = Array.isArray(data?.results) ? data!.results : [];
    return { rawRecords: results, metadata: { mode: "hubspot_api", objectType } };
  },

  normalize(raw) {
    const r = asRecord(raw);
    if (!r) return null;
    return normalizeCrmRecord(r, "HubSpot");
  },
};

/** Salesforce — OAuth access token + instance URL */
export const salesforceConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.SALESFORCE,
  provider: "salesforce",
  displayName: "Salesforce CRM",
  description:
    "Import Accounts/Contacts/Opportunities via Salesforce REST API or customer-exported records.",

  async validate(ctx) {
    if (recordsFromParams(ctx)) return { ok: true };
    if (
      hasOfficialCreds(ctx.credentials, ["accessToken"]) &&
      str(ctx.credentials.instanceUrl || ctx.configuration.instanceUrl)
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      message:
        "Provide Salesforce accessToken + instanceUrl, or params.records.",
    };
  },

  async fetch(ctx: ConnectorFetchContext) {
    const fromParams = recordsFromParams(ctx);
    if (fromParams) {
      return {
        rawRecords: fromParams,
        metadata: { mode: "customer_export" },
      };
    }

    const token = ctx.credentials.accessToken;
    const instance = str(
      ctx.credentials.instanceUrl || ctx.configuration.instanceUrl
    ).replace(/\/$/, "");
    const soql = encodeURIComponent(
      str(
        ctx.configuration.soql,
        "SELECT Id, Name, Website, Industry, BillingCountry, BillingCity, Description FROM Account LIMIT 50"
      )
    );
    const result = await fetchJson(
      `${instance}/services/data/v59.0/query?q=${soql}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!result.ok) {
      return {
        rawRecords: [],
        metadata: {
          mode: "salesforce_api",
          apiError: result.error,
          note: "Salesforce API failed — verify OAuth scopes/instance. No scrape fallback.",
        },
      };
    }

    const data = asRecord(result.data);
    const records = Array.isArray(data?.records) ? data!.records : [];
    return { rawRecords: records, metadata: { mode: "salesforce_api" } };
  },

  normalize(raw) {
    const r = asRecord(raw);
    if (!r) return null;
    return normalizeCrmRecord(r, "Salesforce");
  },
};

/** Pipedrive — API token */
export const pipedriveConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.PIPEDRIVE,
  provider: "pipedrive",
  displayName: "Pipedrive CRM",
  description:
    "Import organizations/deals via Pipedrive API token or customer-exported records.",

  async validate(ctx) {
    if (recordsFromParams(ctx)) return { ok: true };
    if (hasOfficialCreds(ctx.credentials, ["apiToken", "apiKey", "accessToken"])) {
      return { ok: true };
    }
    return {
      ok: false,
      message: "Provide Pipedrive apiToken, or params.records.",
    };
  },

  async fetch(ctx: ConnectorFetchContext) {
    const fromParams = recordsFromParams(ctx);
    if (fromParams) {
      return {
        rawRecords: fromParams,
        metadata: { mode: "customer_export" },
      };
    }

    const token =
      ctx.credentials.apiToken ||
      ctx.credentials.apiKey ||
      ctx.credentials.accessToken;
    const companyDomain = str(
      ctx.configuration.companyDomain || ctx.credentials.companyDomain,
      "api"
    );
    const result = await fetchJson(
      `https://${companyDomain}.pipedrive.com/api/v1/organizations?limit=50&api_token=${encodeURIComponent(token)}`
    );

    if (!result.ok) {
      return {
        rawRecords: [],
        metadata: {
          mode: "pipedrive_api",
          apiError: result.error,
          note: "Pipedrive API failed — verify token/domain. No scrape fallback.",
        },
      };
    }

    const data = asRecord(result.data);
    const list = Array.isArray(data?.data) ? data!.data : [];
    return {
      rawRecords: list.map((org) => {
        const o = asRecord(org) || {};
        return {
          id: o.id,
          name: o.name,
          website: o.website || o.cc_email,
          country: o.address_country,
          city: o.address_locality,
          ...o,
        };
      }),
      metadata: { mode: "pipedrive_api" },
    };
  },

  normalize(raw) {
    const r = asRecord(raw);
    if (!r) return null;
    return normalizeCrmRecord(r, "Pipedrive");
  },
};
