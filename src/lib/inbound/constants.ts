/** OpportunitySource.key values created by the public website. */
export const INBOUND_SOURCE_KEYS = ["website", "autopilot_waitlist"] as const;

export type InboundSourceKey = (typeof INBOUND_SOURCE_KEYS)[number];

export function isInboundSourceKey(
  key: string | null | undefined
): key is InboundSourceKey {
  return (
    key === "website" ||
    key === "autopilot_waitlist"
  );
}

export const INBOUND_SOURCE_LABELS: Record<InboundSourceKey, string> = {
  website: "Website brief",
  autopilot_waitlist: "Autopilot waitlist",
};
