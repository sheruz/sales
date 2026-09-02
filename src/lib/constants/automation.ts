export const AUTOMATION_STATUS_LABELS: Record<string, string> = {
  IDLE: "Idle",
  LOCKED: "Locked",
  DISCOVERING: "Discovering",
  RESEARCHING: "Researching",
  SCORING: "Scoring",
  GENERATING_OUTREACH: "Generating Outreach",
  OUTREACH_READY: "Outreach Ready",
  OUTREACH_SENT: "Outreach Sent",
  AWAITING_REPLY: "Awaiting Reply",
  PROCESSING_REPLY: "Processing Reply",
  FOLLOW_UP_SCHEDULED: "Follow-up Scheduled",
  COMPLETED: "Completed",
  FAILED: "Failed",
  PAUSED: "Paused",
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};

export const DEFAULT_FOLLOW_UP_STEPS = [
  { delayDays: 3, channel: "email", template: "follow_up_1" },
  { delayDays: 7, channel: "email", template: "follow_up_2" },
  { delayDays: 14, channel: "email", template: "follow_up_3" },
];

export const LINKEDIN_PROFILE_URL_REGEX =
  /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/;
