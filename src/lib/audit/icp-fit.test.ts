import { describe, expect, it } from "vitest";
import { scoreIcpFit, shouldSkipDeepAudit } from "@/lib/audit/icp-fit";

describe("ICP fit (PoW1)", () => {
  it("skips low-fit companies", () => {
    const fit = scoreIcpFit({
      companyIndustry: "Aerospace missiles",
      companyCity: "Tokyo",
      companyCountry: "JP",
      icpIndustries: ["Dental clinics", "Orthodontics"],
      icpGeographies: ["United States", "Texas"],
      icpEmployeeRanges: ["1-10"],
    });
    expect(fit.band).toBe("low");
    expect(shouldSkipDeepAudit(fit)).toBe(true);
  });

  it("scores high when industry + geo match", () => {
    const fit = scoreIcpFit({
      companyIndustry: "Dental clinic",
      companyCity: "Austin",
      companyCountry: "US",
      companyEmployeeCount: 8,
      icpIndustries: ["Dental", "Healthcare"],
      icpGeographies: ["Texas", "United States"],
      icpEmployeeRanges: ["1-10"],
    });
    expect(fit.band).toBe("high");
    expect(shouldSkipDeepAudit(fit)).toBe(false);
  });

  it("does not block when no ICP configured", () => {
    const fit = scoreIcpFit({
      companyIndustry: "Anything",
      icpIndustries: [],
    });
    expect(fit.band).not.toBe("low");
  });
});
