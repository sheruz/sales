import { LeadStatus, LeadScoreCategory } from "@prisma/client";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  RESEARCHING: "Researching",
  QUALIFIED: "Qualified",
  CONTACTED: "Contacted",
  REPLIED: "Replied",
  INTERESTED: "Interested",
  MEETING: "Meeting",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
  DISQUALIFIED: "Disqualified",
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  RESEARCHING: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  QUALIFIED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CONTACTED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  REPLIED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  INTERESTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  MEETING: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  PROPOSAL: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  NEGOTIATION: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  WON: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  LOST: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  DISQUALIFIED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export const SCORE_CATEGORY_LABELS: Record<LeadScoreCategory, string> = {
  HOT: "Hot",
  WARM: "Warm",
  POSSIBLE: "Possible",
  LOW_PRIORITY: "Low Priority",
};

export const LEAD_SOURCES = [
  "Manual",
  "CSV Import",
  "LinkedIn",
  "Website",
  "Referral",
  "Cold Outreach",
  "Event",
  "Other",
] as const;
