import { describe, expect, it } from "vitest";
import { SignalType } from "@prisma/client";
import { catalogConnectorTypes, getConnectorAdapter } from "@/lib/connectors/registry";
import { linkedInSignalConnector } from "@/lib/connectors/adapters/linkedin";
import { metaSignalConnector } from "@/lib/connectors/adapters/meta";
import { websiteVisitorsConnector } from "@/lib/connectors/adapters/website-visitors";
import { hubspotConnector } from "@/lib/connectors/adapters/crm";
import { ensureFingerprint } from "@/lib/connectors/types";

const emptyCtx = {
  organizationId: "org-1",
  userId: "u1",
  connectorId: "c1",
  configuration: {},
  credentials: {},
};

describe("Phase 11 advanced opportunity sources", () => {
  it("registers advanced connectors without replacing Phase 4 set", () => {
    const types = catalogConnectorTypes().map((c) => c.type);
    for (const required of [
      "HIRING",
      "LINKEDIN",
      "META",
      "INSTAGRAM",
      "WEBSITE_VISITORS",
      "HUBSPOT",
      "SALESFORCE",
      "PIPEDRIVE",
    ]) {
      expect(types).toContain(required);
    }
  });

  it("LinkedIn adapter rejects scrape-only mode and accepts licensed records", async () => {
    const bad = await linkedInSignalConnector.validate(emptyCtx);
    expect(bad.ok).toBe(false);

    const good = await linkedInSignalConnector.validate({
      ...emptyCtx,
      params: {
        records: [{ companyName: "Acme", title: "Hiring post" }],
      },
    });
    expect(good.ok).toBe(true);

    const record = linkedInSignalConnector.normalize(
      {
        companyName: "Acme Corp",
        title: "Leadership update",
        activityType: "LEADERSHIP_CHANGE",
        url: "https://www.linkedin.com/company/acme",
      },
      emptyCtx
    );
    expect(record?.signalType).toBe(SignalType.LEADERSHIP_CHANGE);
    expect(record).not.toHaveProperty("provider");
  });

  it("Meta + HubSpot normalize into signal types the Opportunity Engine already understands", () => {
    const meta = metaSignalConnector.normalize(
      {
        companyName: "Beta",
        message: "Launched a new product line",
        permalink_url: "https://facebook.com/beta/posts/1",
      },
      emptyCtx
    );
    expect(meta?.signalType).toBe(SignalType.SOCIAL_ACTIVITY);

    const hubspot = hubspotConnector.normalize(
      {
        id: "hs-1",
        properties: {
          name: "Gamma LLC",
          domain: "gamma.io",
          industry: "Software",
        },
      },
      emptyCtx
    );
    expect(hubspot?.signalType).toBe(SignalType.CRM_ACTIVITY);
    expect(hubspot?.company.domain).toBe("gamma.io");
  });

  it("Website visitor events become WEBSITE_VISIT signals", () => {
    const record = websiteVisitorsConnector.normalize(
      {
        companyName: "Delta Inc",
        domain: "delta.com",
        page: "/pricing",
        frequency: 4,
        intent: "pricing_research",
        visitorId: "v-9",
      },
      emptyCtx
    );
    expect(record?.signalType).toBe(SignalType.WEBSITE_VISIT);
    expect(record?.title).toContain("/pricing");
    expect(ensureFingerprint(record!, "org-1")).toHaveLength(64);
  });

  it("new connectors require no Opportunity Engine rewrite — same NormalizedSignalRecord shape", () => {
    const adapter = getConnectorAdapter("WEBSITE_VISITORS");
    const record = adapter!.normalize(
      { companyName: "Epsilon", page: "/demo", visits: 2 },
      emptyCtx
    );
    expect(record).toMatchObject({
      signalType: expect.any(String),
      title: expect.any(String),
      company: { name: expect.any(String) },
    });
    expect(Object.keys(record!)).not.toContain("hubspotDealId");
    expect(Object.keys(record!)).not.toContain("linkedinUrn");
  });
});
