import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function LegacyBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-amber-500/40 text-amber-700 dark:text-amber-400",
        className
      )}
    >
      Legacy
    </Badge>
  );
}
