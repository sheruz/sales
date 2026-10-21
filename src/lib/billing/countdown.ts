/** Live countdown helpers for plan-limit / downgrade deadlines. */

export function formatCountdown(deadlineAt: Date | string, now = new Date()): {
  expired: boolean;
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
} {
  const end =
    typeof deadlineAt === "string" ? new Date(deadlineAt) : deadlineAt;
  const totalMs = end.getTime() - now.getTime();
  if (totalMs <= 0) {
    return {
      expired: true,
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      label: "Deadline passed — extras pause soon",
    };
  }
  const days = Math.floor(totalMs / 86_400_000);
  const hours = Math.floor((totalMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  let label: string;
  if (days >= 1) {
    label = `${days}d ${hours}h left`;
  } else if (hours >= 1) {
    label = `${hours}h ${minutes}m left`;
  } else {
    label = `${minutes}m ${seconds}s left`;
  }
  return { expired: false, totalMs, days, hours, minutes, seconds, label };
}

export function deadlineExplanation(featureKey: string, allowedCount: number) {
  const nice = featureKey.replace(/_/g, " ");
  return `At the deadline, anything beyond ${allowedCount} ${nice} is soft-paused (not deleted). You can reactivate later by upgrading or freeing a seat. Your primary admin is never paused.`;
}
