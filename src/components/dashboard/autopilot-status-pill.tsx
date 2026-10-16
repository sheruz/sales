import { appHome } from "@/lib/app-paths";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AutopilotShellStatus } from "@/lib/autopilot/shell-status";

function lastRunLabel(status: AutopilotShellStatus): string {
  if (status.minutesAgo == null) return "No run yet";
  if (status.minutesAgo < 1) return "Last run just now";
  if (status.minutesAgo < 60) return `Last run ${status.minutesAgo} min ago`;
  const hours = Math.floor(status.minutesAgo / 60);
  if (hours < 48) return `Last run ${hours}h ago`;
  return `Last run ${Math.floor(hours / 24)}d ago`;
}

function title(status: AutopilotShellStatus): string {
  if (status.tone === "ok") return "Autopilot running";
  if (status.tone === "warn") return "Autopilot paused";
  return "Autopilot not running";
}

export function AutopilotStatusPill({
  status,
}: {
  status: AutopilotShellStatus;
}) {
  return (
    <Link
      href={appHome("/autopilot")}
      className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-2.5 py-2.5 text-[12.5px] transition-colors hover:bg-sidebar-accent"
      title={status.lastRunAt ? `Last run ${status.lastRunAt}` : undefined}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          status.tone === "ok" &&
            "bg-[color:var(--success)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--success)_12%,transparent)]",
          status.tone === "warn" &&
            "bg-[color:var(--warning)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--warning)_12%,transparent)]",
          status.tone === "bad" &&
            "bg-destructive shadow-[0_0_0_3px_color-mix(in_srgb,var(--destructive)_12%,transparent)]"
        )}
      />
      <div className="min-w-0 leading-tight">
        <div className="truncate font-semibold text-sidebar-foreground">
          {title(status)}
        </div>
        <div className="truncate text-[11.5px] text-muted-foreground">
          {lastRunLabel(status)}
        </div>
      </div>
    </Link>
  );
}
