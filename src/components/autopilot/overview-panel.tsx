"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { StatusBadge } from "@/components/status/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  data: {
    funnel: Array<{
      key: string;
      label: string;
      phase: number;
      comingSoon?: boolean;
      count: number;
      href: string;
    }>;
    checklist: Array<{
      key: string;
      label: string;
      done: boolean;
      comingSoon?: boolean;
      phase?: number;
    }>;
    health: {
      lastCronRun: {
        startedAt: string;
        finishedAt: string | null;
        ok: boolean;
        stale: boolean;
      } | null;
      googleSpendTodayUsd: number;
      hunterCreditsRemaining: number | null;
      hunterCreditsUsedToday: number;
      errorsLast24h: number;
    };
    toggles: {
      sourcing: boolean;
      autoCrawl: boolean;
      enrichment: boolean;
      audit: boolean;
      outbound: boolean;
      shadowMode?: boolean;
    };
  };
};

export function OverviewPanel({ data }: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funnel</CardTitle>
          <CardDescription>
            Found → Crawled → Enriched → later stages. Click a count to open the
            filtered list.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.funnel.map((s) => (
            <Link
              key={s.key}
              href={s.comingSoon ? "#" : s.href}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                s.comingSoon
                  ? "cursor-default opacity-50"
                  : "hover:bg-muted/50"
              )}
              onClick={(e) => s.comingSoon && e.preventDefault()}
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold">
                {s.comingSoon ? "—" : s.count}
              </p>
              {s.comingSoon ? (
                <p className="text-xs text-muted-foreground">
                  Coming in Phase {s.phase}
                </p>
              ) : null}
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Setup checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.checklist.map((item) => (
              <div
                key={item.key}
                className={cn(
                  "flex items-center gap-2",
                  item.comingSoon && "opacity-50"
                )}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span>
                  {item.label}
                  {item.comingSoon ? ` (Phase ${item.phase})` : ""}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Last cron</span>
              <span>
                {data.health.lastCronRun
                  ? new Date(
                      data.health.lastCronRun.finishedAt ||
                        data.health.lastCronRun.startedAt
                    ).toLocaleString()
                  : "Never"}
                {data.health.lastCronRun?.stale ? " · stale" : ""}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Google spend today</span>
              <span>${data.health.googleSpendTodayUsd.toFixed(3)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Hunter credits left</span>
              <span>
                {data.health.hunterCreditsRemaining ?? "—"}
                <span className="text-muted-foreground">
                  {" "}
                  (used {data.health.hunterCreditsUsedToday})
                </span>
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Errors (24h)</span>
              <span>{data.health.errorsLast24h}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Master toggles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <StatusBadge
            label={`Sourcing ${data.toggles.sourcing ? "ON" : "OFF"}`}
            tone={data.toggles.sourcing ? "success" : "muted"}
          />
          <StatusBadge
            label={`Auto-crawl ${data.toggles.autoCrawl ? "ON" : "OFF"}`}
            tone={data.toggles.autoCrawl ? "success" : "muted"}
          />
          <StatusBadge
            label={`Enrichment ${data.toggles.enrichment ? "ON" : "OFF"}`}
            tone={data.toggles.enrichment ? "success" : "muted"}
          />
          <StatusBadge
            label={`Audit ${data.toggles.audit ? "ON" : "OFF"}`}
            tone={data.toggles.audit ? "success" : "muted"}
          />
          <StatusBadge
            label={`Outbound ${data.toggles.outbound ? "ON" : "OFF"}`}
            tone={data.toggles.outbound ? "success" : "muted"}
          />
          {data.toggles.shadowMode !== false ? (
            <StatusBadge label="Shadow mode" tone="warning" />
          ) : (
            <StatusBadge label="Live send" tone="danger" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
