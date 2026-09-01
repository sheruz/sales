import { LeadStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS } from "@/lib/constants/leads";
import { cn } from "@/lib/utils";

interface LeadStatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn("font-medium", LEAD_STATUS_COLORS[status], className)}
    >
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}
