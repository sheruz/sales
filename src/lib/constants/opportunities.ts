import type { OpportunityListFilter } from "@/services/opportunity.service";
import { OpportunityStage, OpportunityStatus } from "@prisma/client";

export const OPPORTUNITY_FILTERS: {
  value: OpportunityListFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "sourced", label: "Sourced" },
  { value: "hot", label: "Hot" },
  { value: "warm", label: "Warm" },
  { value: "new", label: "New" },
  { value: "needs_action", label: "Needs Action" },
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
  { value: "positive", label: "Positive reply" },
  { value: "meeting", label: "Meeting" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  SOURCED: "Sourced",
  NEW: "New",
  QUALIFIED: "Qualified",
  CONTACTED: "Contacted",
  REPLIED: "Replied",
  POSITIVE_REPLY: "Positive reply",
  DISCOVERY: "Discovery",
  MEETING: "Meeting",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  OPEN: "Open",
  WON: "Won",
  LOST: "Lost",
  DISQUALIFIED: "Disqualified",
};

export function scoreBadgeVariant(
  score: number
): "default" | "secondary" | "outline" | "destructive" {
  if (score >= 75) return "destructive";
  if (score >= 50) return "default";
  return "secondary";
}

export function scoreLabel(score: number): string {
  if (score >= 75) return "Hot";
  if (score >= 50) return "Warm";
  return "Cold";
}
