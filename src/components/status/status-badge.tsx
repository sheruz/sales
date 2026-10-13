"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  funnelStageLabel,
  type FunnelStageKey,
} from "@/lib/crm/funnel-stage";

type Tone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "brand"
  | "ok"
  | "warn"
  | "bad";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "rounded-full border-border bg-muted text-foreground",
  muted: "rounded-full border-border bg-muted/50 text-muted-foreground",
  success:
    "rounded-full border-[color:var(--success)]/35 bg-[color:var(--success)]/12 text-[color:var(--success)]",
  ok: "rounded-full border-[color:var(--success)]/35 bg-[color:var(--success)]/12 text-[color:var(--success)]",
  warning:
    "rounded-full border-[color:var(--warning)]/35 bg-[color:var(--warning)]/12 text-[color:var(--warning)]",
  warn: "rounded-full border-[color:var(--warning)]/35 bg-[color:var(--warning)]/12 text-[color:var(--warning)]",
  danger:
    "rounded-full border-destructive/35 bg-destructive/12 text-destructive",
  bad: "rounded-full border-destructive/35 bg-destructive/12 text-destructive",
  info: "rounded-full border-[color:var(--info)]/35 bg-[color:var(--info)]/12 text-[color:var(--info)]",
  brand:
    "rounded-full border-primary/35 bg-primary/12 text-primary",
};

function toSentenceCase(label: string): string {
  const t = label.trim();
  if (!t || /[a-z]/.test(t)) return t; // already mixed / sentence
  return t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ");
}

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
      className={cn(
        "px-2 py-0.5 text-[11px] font-medium capitalize",
        TONE_CLASS[tone],
        className
      )}
    >
      {toSentenceCase(label)}
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
        title="Not available yet"
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
