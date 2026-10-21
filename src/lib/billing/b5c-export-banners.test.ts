import { describe, expect, it } from "vitest";
import {
  pickHighestBanner,
  type TenantBanner,
} from "@/lib/billing/tenant-banner-state";
import { createZipStore, toCsv } from "@/lib/export/zip-store";
import { assertAllSameOrg } from "@/services/privacy-export.service";

function banner(
  kind: TenantBanner["kind"],
  tone: TenantBanner["tone"] = "warn"
): TenantBanner {
  return {
    kind,
    title: kind,
    body: kind,
    ctaLabel: "Go",
    ctaHref: "/",
    tone,
  };
}

describe("B5c tenant banner priority", () => {
  it("picks suspended over past_due and low_credits", () => {
    const picked = pickHighestBanner([
      banner("low_credits", "info"),
      banner("past_due", "danger"),
      banner("suspended", "danger"),
      banner("test_mode", "info"),
    ]);
    expect(picked?.kind).toBe("suspended");
  });

  it("picks canceled over trial_ending", () => {
    expect(
      pickHighestBanner([banner("trial_ending"), banner("canceled")])?.kind
    ).toBe("canceled");
  });

  it("picks limit_notice over low_credits", () => {
    expect(
      pickHighestBanner([banner("low_credits"), banner("limit_notice")])?.kind
    ).toBe("limit_notice");
  });
});

describe("B5c export isolation + zip", () => {
  it("rejects mixed-org rows", () => {
    expect(
      assertAllSameOrg(
        [
          { organizationId: "a" },
          { organizationId: "a" },
        ],
        "a"
      )
    ).toBe(true);
    expect(
      assertAllSameOrg(
        [
          { organizationId: "a" },
          { organizationId: "b" },
        ],
        "a"
      )
    ).toBe(false);
  });

  it("builds a valid store zip with csv", () => {
    const csv = toCsv([
      { id: "1", organizationId: "org", name: "Acme" },
      { id: "2", organizationId: "org", name: "Beta, Inc" },
    ]);
    expect(csv).toContain("Beta, Inc");
    const zip = createZipStore([
      { name: "companies.csv", data: csv },
      { name: "manifest.json", data: '{"ok":true}' },
    ]);
    expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(zip.length).toBeGreaterThan(50);
  });
});
