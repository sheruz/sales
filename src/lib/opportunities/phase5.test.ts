import { describe, expect, it } from "vitest";
import { OpportunityIntelligenceService } from "@/services/opportunity-intelligence.service";
import { estimateTokenCostUsd } from "@/lib/ai/usage";

describe("Phase 5 opportunity intelligence", () => {
  const service = new OpportunityIntelligenceService();

  it("ranks decision makers by seniority and signal fit", () => {
    const ranked = service.rankDecisionMakers({
      contacts: [
        {
          id: "1",
          fullName: "Dev Person",
          title: "Software Engineer",
          seniority: null,
          department: "Engineering",
          email: "dev@acme.com",
        },
        {
          id: "2",
          fullName: "CTO",
          title: "Chief Technology Officer",
          seniority: "C-level",
          department: "Engineering",
          email: "cto@acme.com",
        },
        {
          id: "3",
          fullName: "Ops Manager",
          title: "Operations Manager",
          seniority: null,
          department: "Operations",
          email: null,
        },
      ],
      companyEmployeeCount: 120,
      signalType: "HIRING",
    });

    expect(ranked[0].contactId).toBe("2");
    expect(ranked[0].confidence).toBeGreaterThan(ranked[1].confidence);
    expect(ranked[0].reason.toLowerCase()).toContain("seniority");
  });

  it("boosts ops contacts for funding/RFP signals", () => {
    const ranked = service.rankDecisionMakers({
      contacts: [
        {
          id: "eng",
          fullName: "Engineer",
          title: "Engineer",
          seniority: null,
          department: "Engineering",
          email: "e@x.com",
        },
        {
          id: "ops",
          fullName: "VP Ops",
          title: "VP of Operations",
          seniority: null,
          department: "Operations",
          email: "o@x.com",
        },
      ],
      signalType: "FUNDING",
    });
    expect(ranked[0].contactId).toBe("ops");
  });

  it("estimates AI usage cost without needing API keys", () => {
    const cost = estimateTokenCostUsd({
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 1000,
      outputTokens: 500,
    });
    expect(cost).not.toBeNull();
    expect(cost!).toBeGreaterThan(0);
  });

  it("score explanation contract matches explainable format", () => {
    const explanation = [
      "ICP Fit: 91",
      "Signal Strength: 88",
      "Urgency: 94",
      "Service Fit: 92",
      "Reachability: 75",
      "Overall: 89/100",
    ].join("\n");
    expect(explanation).toContain("ICP Fit:");
    expect(explanation).toContain("Overall: 89/100");
  });
});
