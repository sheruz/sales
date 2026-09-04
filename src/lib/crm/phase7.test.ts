import { describe, expect, it } from "vitest";
import { DealStage, OpportunityStage } from "@prisma/client";
import {
  dealStageProbability,
  opportunityStageToDealStage,
  PIPELINE_STAGES,
} from "@/lib/crm/pipeline";

describe("Phase 7 CRM pipeline", () => {
  it("maps opportunity journey stages onto deal stages", () => {
    expect(opportunityStageToDealStage(OpportunityStage.CONTACTED)).toBe(
      DealStage.CONTACTED
    );
    expect(opportunityStageToDealStage(OpportunityStage.REPLIED)).toBe(
      DealStage.REPLIED
    );
    expect(opportunityStageToDealStage(OpportunityStage.DISCOVERY)).toBe(
      DealStage.DISCOVERY
    );
    expect(opportunityStageToDealStage(OpportunityStage.MEETING)).toBe(
      DealStage.MEETING
    );
    expect(opportunityStageToDealStage(OpportunityStage.PROPOSAL)).toBe(
      DealStage.PROPOSAL
    );
    expect(opportunityStageToDealStage(OpportunityStage.NEGOTIATION)).toBe(
      DealStage.NEGOTIATION
    );
    expect(opportunityStageToDealStage(OpportunityStage.WON)).toBe(DealStage.WON);
  });

  it("assigns rising probability through the funnel", () => {
    expect(dealStageProbability(DealStage.QUALIFIED)).toBeLessThan(
      dealStageProbability(DealStage.MEETING)
    );
    expect(dealStageProbability(DealStage.PROPOSAL)).toBeLessThan(
      dealStageProbability(DealStage.NEGOTIATION)
    );
    expect(dealStageProbability(DealStage.WON)).toBe(100);
    expect(dealStageProbability(DealStage.LOST)).toBe(0);
  });

  it("includes the full revenue path stages", () => {
    expect(PIPELINE_STAGES).toEqual(
      expect.arrayContaining([
        OpportunityStage.CONTACTED,
        OpportunityStage.REPLIED,
        OpportunityStage.MEETING,
        OpportunityStage.PROPOSAL,
        OpportunityStage.NEGOTIATION,
        OpportunityStage.WON,
      ])
    );
  });
});
