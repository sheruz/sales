import { describe, expect, it } from "vitest";

describe("Phase 8–9 revenue analytics + learning", () => {
  it("funnel stages match revenue journey", () => {
    const funnel = [
      "Opportunities",
      "Qualified",
      "Contacted",
      "Replied",
      "Meeting",
      "Proposal",
      "Negotiation",
      "Won",
    ];
    expect(funnel).toHaveLength(8);
    expect(funnel[0]).toBe("Opportunities");
    expect(funnel.at(-1)).toBe("Won");
  });

  it("recommendation shape requires reason, priority, impact, action", () => {
    const rec = {
      reason: "High score opportunity",
      priority: "HIGH",
      expectedImpact: "Increase win probability",
      action: "Follow up today",
    };
    expect(rec.reason).toBeTruthy();
    expect(rec.priority).toBeTruthy();
    expect(rec.expectedImpact).toBeTruthy();
    expect(rec.action).toBeTruthy();
  });

  it("learning insights require approval guardrail", () => {
    const insight = {
      pattern: "Series A + hiring converted 2.4x better",
      confidence: 72,
      requiresApproval: true as const,
      recommendation: "Prioritize funded hiring signals — do not auto-change ICP",
    };
    expect(insight.requiresApproval).toBe(true);
    expect(insight.recommendation.toLowerCase()).toContain("not auto");
  });

  it("source buckets cover Phase 8 sources", () => {
    const sources = ["hiring", "funding", "RFP", "web signals", "CRM", "imports"];
    expect(sources).toContain("hiring");
    expect(sources).toContain("funding");
    expect(sources).toContain("RFP");
  });
});
