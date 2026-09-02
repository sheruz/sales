/** Safe defaults to protect Claude budget and avoid LinkedIn automation */
export const AUTOPILOT_SAFE_DEFAULTS = {
  dailySearchLimit: 5,
  dailyMessageLimit: 5,
  maxLeadsPerRun: 5,
  maxLeadsPerDay: 10,
  maxAiCallsPerDay: 15,
  minHoursBetweenRuns: 6,
} as const;
