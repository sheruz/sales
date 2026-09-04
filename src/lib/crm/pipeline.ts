import {
  DealStage,
  OpportunityStage,
  type OpportunityStage as OppStage,
} from "@prisma/client";

/** Map opportunity journey stage → deal commercial stage */
export function opportunityStageToDealStage(
  stage: OppStage | OpportunityStage
): DealStage {
  switch (stage) {
    case OpportunityStage.NEW:
    case OpportunityStage.QUALIFIED:
      return DealStage.QUALIFIED;
    case OpportunityStage.CONTACTED:
      return DealStage.CONTACTED;
    case OpportunityStage.REPLIED:
      return DealStage.REPLIED;
    case OpportunityStage.DISCOVERY:
      return DealStage.DISCOVERY;
    case OpportunityStage.MEETING:
      return DealStage.MEETING;
    case OpportunityStage.PROPOSAL:
      return DealStage.PROPOSAL;
    case OpportunityStage.NEGOTIATION:
      return DealStage.NEGOTIATION;
    case OpportunityStage.WON:
      return DealStage.WON;
    case OpportunityStage.LOST:
      return DealStage.LOST;
    default:
      return DealStage.QUALIFIED;
  }
}

export function dealStageProbability(stage: DealStage): number {
  const map: Record<DealStage, number> = {
    LEAD: 5,
    CONTACTED: 10,
    REPLIED: 20,
    QUALIFIED: 25,
    DISCOVERY: 35,
    MEETING: 45,
    PROPOSAL: 60,
    NEGOTIATION: 75,
    WON: 100,
    LOST: 0,
  };
  return map[stage];
}

export const PIPELINE_STAGES: OpportunityStage[] = [
  OpportunityStage.QUALIFIED,
  OpportunityStage.CONTACTED,
  OpportunityStage.REPLIED,
  OpportunityStage.DISCOVERY,
  OpportunityStage.MEETING,
  OpportunityStage.PROPOSAL,
  OpportunityStage.NEGOTIATION,
  OpportunityStage.WON,
  OpportunityStage.LOST,
];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  LEAD: "Lead",
  CONTACTED: "Contacted",
  REPLIED: "Replied",
  QUALIFIED: "Qualified",
  DISCOVERY: "Discovery",
  MEETING: "Meeting",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};
