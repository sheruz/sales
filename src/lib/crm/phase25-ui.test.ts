import { describe, expect, it } from "vitest";
import { displayContactName, isGenericInboxEmail } from "@/lib/crm/display-name";
import { deriveCompanyFunnelStage } from "@/lib/crm/funnel-stage";

describe("display names", () => {
  it("maps info@ to General inbox", () => {
    expect(isGenericInboxEmail("info@acme.com")).toBe(true);
    expect(displayContactName("info", "info@acme.com")).toEqual({
      label: "General inbox",
      isGeneralInbox: true,
    });
  });

  it("title-cases real names", () => {
    expect(displayContactName("kendall smith", "kendall@acme.com").label).toBe(
      "Kendall Smith"
    );
  });
});

describe("funnel stage", () => {
  it("derives found → crawled → enriched → audited → contacted", () => {
    expect(
      deriveCompanyFunnelStage({
        crawlStatus: null,
        enrichmentStatus: null,
      })
    ).toBe("found");
    expect(
      deriveCompanyFunnelStage({
        crawlStatus: "DONE",
        enrichmentStatus: "PENDING",
      })
    ).toBe("crawled");
    expect(
      deriveCompanyFunnelStage({
        crawlStatus: "DONE",
        enrichmentStatus: "ENRICHED",
      })
    ).toBe("enriched");
    expect(
      deriveCompanyFunnelStage({
        crawlStatus: "DONE",
        enrichmentStatus: "ENRICHED",
        audited: true,
      })
    ).toBe("audited");
    expect(
      deriveCompanyFunnelStage({
        crawlStatus: "DONE",
        enrichmentStatus: "ENRICHED",
        audited: true,
        opportunityStage: "CONTACTED",
      })
    ).toBe("contacted");
  });
});
