/** Shared status → Badge variant / label for platform console */

export type PlatformStatusTone =
  | "default"
  | "secondary"
  | "destructive"
  | "outline";

const MAP: Record<
  string,
  { label: string; variant: PlatformStatusTone }
> = {
  ACTIVE: { label: "Active", variant: "default" },
  TRIALING: { label: "Trialing", variant: "secondary" },
  PAST_DUE: { label: "Past due", variant: "destructive" },
  SUSPENDED: { label: "Suspended", variant: "destructive" },
  CANCELED: { label: "Canceled", variant: "outline" },
  CANCELLED: { label: "Canceled", variant: "outline" },
  ARCHIVED: { label: "Archived", variant: "outline" },
  OPEN: { label: "Open", variant: "secondary" },
  OVERDUE: { label: "Overdue", variant: "destructive" },
  PAID: { label: "Paid", variant: "default" },
  VOID: { label: "Void", variant: "outline" },
  completed: { label: "Completed", variant: "default" },
  paid: { label: "Paid", variant: "default" },
  succeeded: { label: "Succeeded", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  unmatched: { label: "Unmatched", variant: "destructive" },
  skipped: { label: "Skipped", variant: "outline" },
  pending: { label: "Pending", variant: "secondary" },
};

export function platformStatusBadge(status: string): {
  label: string;
  variant: PlatformStatusTone;
} {
  const hit = MAP[status] || MAP[status.toUpperCase()];
  if (hit) return hit;
  return { label: status, variant: "secondary" };
}
