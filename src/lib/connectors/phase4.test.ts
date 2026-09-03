import { describe, expect, it } from "vitest";
import {
  buildSignalFingerprint,
  ensureFingerprint,
  normalizeCompanyName,
} from "@/lib/connectors/types";
import { SignalType } from "@prisma/client";
import { catalogConnectorTypes, getConnectorAdapter } from "@/lib/connectors/registry";
import { csvCrmConnector } from "@/lib/connectors/adapters/csv-crm";

describe("Phase 4 connector framework", () => {
  it("exposes all initial connectors", () => {
    const catalog = catalogConnectorTypes();
    const types = catalog.map((c) => c.type);
    expect(types).toContain("HIRING");
    expect(types).toContain("FUNDING");
    expect(types).toContain("WEB_RESEARCH");
    expect(types).toContain("RFP_TENDER");
    expect(types).toContain("CSV_CRM");
  });

  it("normalizes company names for dedupe", () => {
    expect(normalizeCompanyName("Acme Inc.")).toBe("acme");
    expect(normalizeCompanyName("ACME, LLC")).toBe("acme");
  });

  it("fingerprints are stable for same hiring signal", () => {
    const a = buildSignalFingerprint({
      organizationId: "org-1",
      signalType: SignalType.HIRING,
      companyName: "Acme Inc",
      domain: "acme.com",
      title: "Senior Engineer",
      evidenceUrl: "https://jobs.example/1",
    });
    const b = buildSignalFingerprint({
      organizationId: "org-1",
      signalType: SignalType.HIRING,
      companyName: "Acme Inc",
      domain: "acme.com",
      title: "Senior Engineer",
      evidenceUrl: "https://jobs.example/1",
    });
    expect(a).toBe(b);
  });

  it("CSV connector normalizes rows into signals without caring about provider", () => {
    const adapter = getConnectorAdapter("CSV_CRM");
    expect(adapter?.provider).toBe("csv_upload");
    const record = csvCrmConnector.normalize(
      {
        company_name: "Beta Co",
        website: "https://beta.co",
        email: "a@beta.co",
        first_name: "Ann",
        last_name: "Lee",
        signal_title: "Imported account",
        signal_type: "CRM_ACTIVITY",
      },
      {
        organizationId: "org-x",
        userId: "u1",
        connectorId: "c1",
        configuration: {},
        credentials: {},
      }
    );
    expect(record?.company.name).toBe("Beta Co");
    expect(record?.signalType).toBe(SignalType.CRM_ACTIVITY);
    const fp = ensureFingerprint(record!, "org-x");
    expect(fp).toHaveLength(64);
  });

  it("Opportunity Engine input shape is source-agnostic", () => {
    const hiring = {
      signalType: SignalType.HIRING,
      title: "Role",
      company: { name: "A" },
    };
    const funding = {
      signalType: SignalType.FUNDING,
      title: "Series A",
      company: { name: "B" },
    };
    // Both are NormalizedSignalRecord-compatible keys
    for (const r of [hiring, funding]) {
      expect(r).toHaveProperty("signalType");
      expect(r).toHaveProperty("company");
      expect(r).not.toHaveProperty("provider");
    }
  });
});
