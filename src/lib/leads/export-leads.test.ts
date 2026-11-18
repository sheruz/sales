import { describe, expect, it } from "vitest";
import {
  canCompanyAdminExportLeads,
  leadExportRow,
  parseLeadExportRange,
  rowsForCompany,
} from "@/lib/leads/export-leads";

describe("company admin lead export", () => {
  it("allows a company admin and blocks a super admin", () => {
    expect(
      canCompanyAdminExportLeads({
        organizationRoleKey: "company_admin",
        platformRole: null,
        isPlatformAdmin: false,
        role: "ADMIN",
      })
    ).toBe(true);

    expect(
      canCompanyAdminExportLeads({
        organizationRoleKey: "company_admin",
        platformRole: "SUPER_ADMIN",
        isPlatformAdmin: true,
        role: "SUPER_ADMIN",
      })
    ).toBe(false);

    expect(
      canCompanyAdminExportLeads({
        organizationRoleKey: "sales_rep",
        platformRole: null,
        isPlatformAdmin: false,
        role: "SALES_REPRESENTATIVE",
      })
    ).toBe(false);
  });

  it("treats the end date as inclusive", () => {
    const range = parseLeadExportRange("2026-01-01", "2026-01-31");
    expect(range.gte.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("maps a contact into import-compatible columns", () => {
    const row = leadExportRow({
      createdAt: new Date("2026-03-02T12:00:00.000Z"),
      firstName: "Ada",
      lastName: "Lovelace",
      title: "CTO",
      email: "ada@example.com",
      phone: null,
      linkedInUrl: null,
      source: "hunter",
      status: "ACTIVE",
      company: {
        name: "Analytical Engines",
        website: "https://example.com",
        phone: null,
        address: null,
        city: "London",
        state: null,
        country: "UK",
        industry: "Software",
        employeeCount: 12,
        linkedInUrl: null,
        source: null,
        emails: [{ email: "hello@example.com" }],
      },
    });
    expect(row.company_name).toBe("Analytical Engines");
    expect(row.company_email).toBe("hello@example.com");
    expect(row.first_name).toBe("Ada");
    expect(row.email).toBe("ada@example.com");
    expect(row.employee_count).toBe("12");
    expect(row.created_at).toBe("2026-03-02T12:00:00.000Z");
  });

  it("keeps a place that has no contact yet", () => {
    const rows = rowsForCompany(
      {
        createdAt: new Date("2026-11-18T13:00:00.000Z"),
        name: "Maple Dental",
        website: "https://mapledental.example",
        phone: "+1 512 555 0100",
        address: "1 Main St",
        city: "Austin",
        state: "TX",
        country: "US",
        industry: null,
        employeeCount: null,
        linkedInUrl: null,
        source: "google_places",
        emails: [],
      },
      []
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.company_name).toBe("Maple Dental");
    expect(rows[0]?.company_phone).toBe("+1 512 555 0100");
    expect(rows[0]?.source).toBe("google_places");
    expect(rows[0]?.first_name).toBe("");
    expect(rows[0]?.email).toBe("");
  });
});
