import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AutopilotShellStatus } from "@/lib/autopilot/shell-status";

const TONE: Record<AutopilotShellStatus["tone"], string> = {
  ok: "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  warn: "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[color:var(--warning)]",
  bad: "border-destructive/40 bg-destructive/10 text-destructive",
};

const DOT: Record<AutopilotShellStatus["tone"], string> = {
  ok: "bg-[color:var(--success)]",
  warn: "bg-[color:var(--warning)]",
  bad: "bg-destructive",
};

export function AutopilotStatusPill({
  status,
}: {
  status: AutopilotShellStatus;
}) {
  return (
    <Link
      href="/dashboard/autopilot"
      className={cn(
        "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-medium leading-tight transition-opacity hover:opacity-90",
        TONE[status.tone]
      )}
      title={status.lastRunAt ? `Last run ${status.lastRunAt}` : undefined}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[status.tone])} />
      <span className="truncate">{status.label}</span>
    </Link>
  );
}
