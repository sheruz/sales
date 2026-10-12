"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  funnelStageLabel,
  type FunnelStageKey,
} from "@/lib/crm/funnel-stage";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border bg-muted text-foreground",
  success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200",
  danger: "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300",
  info: "border-sky-500/40 bg-sky-500/15 text-sky-800 dark:text-sky-200",
  muted: "border-border bg-muted/50 text-muted-foreground",
};

export function StatusBadge({
  label,
  tone = "neutral",
  title,
  className,
}: {
  label: string;
  tone?: Tone;
  title?: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      title={title}
      className={cn("font-normal", TONE_CLASS[tone], className)}
    >
      {label}
    </Badge>
  );
}

export function FunnelStageBadge({
  stage,
  comingSoon,
}: {
  stage: FunnelStageKey;
  comingSoon?: boolean;
}) {
  if (comingSoon) {
    return (
      <StatusBadge
        label={`${funnelStageLabel(stage)} · soon`}
        tone="muted"
        title="Coming in a later Autopilot phase"
      />
    );
  }
  const tone: Tone =
    stage === "won"
      ? "success"
      : stage === "enriched" || stage === "crawled"
        ? "info"
        : "neutral";
  return (
    <StatusBadge
      label={funnelStageLabel(stage)}
      tone={tone}
      title={`Funnel stage: ${funnelStageLabel(stage)}`}
    />
  );
}

export function CrawlStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  if (!status) return <StatusBadge label="—" tone="muted" />;
  const tone: Tone =
    status === "DONE"
      ? "success"
      : status === "PENDING"
        ? "warning"
        : status === "BLOCKED" || status === "FAILED"
          ? "danger"
          : "neutral";
  return (
    <StatusBadge
      label={status}
      tone={tone}
      title="Website crawl status"
    />
  );
}

export function EnrichmentStatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  if (!status) return <StatusBadge label="Pending" tone="muted" />;
  const tone: Tone =
    status === "ENRICHED"
      ? "success"
      : status === "PENDING"
        ? "warning"
        : status === "SKIPPED"
          ? "muted"
          : status === "NO_CONTACT" || status === "FAILED"
            ? "danger"
            : "neutral";
  return (
    <StatusBadge
      label={status.replace(/_/g, " ")}
      tone={tone}
      title="Hunter enrichment status"
    />
  );
}

export function VerificationBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  if (!status) return <StatusBadge label="Unknown" tone="muted" />;
  const s = status.toLowerCase();
  if (s === "valid") {
    return <StatusBadge label="Valid" tone="success" title="Verified deliverable" />;
  }
  if (s === "accept_all") {
    return (
      <StatusBadge
        label="Risky"
        tone="warning"
        title="accept_all — risky for enrollment"
      />
    );
  }
  if (s === "invalid") {
    return <StatusBadge label="Invalid" tone="danger" />;
  }
  return <StatusBadge label="Unknown" tone="muted" />;
}

export function SourceBadge({ source }: { source: string | null | undefined }) {
  const label =
    source === "google_places"
      ? "Google Places"
      : source === "hunter"
        ? "Hunter"
        : source === "website_crawl"
          ? "Website"
          : source || "Unknown";
  return <StatusBadge label={label} tone="info" title={`Source: ${label}`} />;
}
