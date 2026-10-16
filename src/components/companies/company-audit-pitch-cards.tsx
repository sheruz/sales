"use client";
import { appHome } from "@/lib/app-paths";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/crm/empty-state";
import { EmailPreview } from "@/components/email/email-preview";

type Check = {
  id: string;
  label: string;
  pass: boolean | null;
  evidence: string;
  severity: string;
};

type PitchData = {
  id: string;
  status: string;
  personalizedFirstLine: string;
  shortPitch: string;
  topIssue: string | null;
  recommendedService: string | null;
  confidence: number | null;
  websiteAuditId: string;
  editedByUser: boolean;
};

type AuditData = {
  id: string;
  status: string;
  pageSpeedMobile: number | null;
  pageSpeedDesktop: number | null;
  checks: Check[] | null;
  findings: {
    top_issues?: Array<{
      issue: string;
      evidence: string;
      business_impact: string;
    }>;
  } | null;
  createdAt: string;
  modelUsed: string | null;
  costUsd: number | null;
};

type Preview = {
  subject: string | null;
  body: string;
  missingRequired: string[];
  sequenceName: string | null;
} | null;

type Props = {
  companyId: string;
  enrichmentStatus?: string | null;
  contactCount?: number;
  latestAudit: AuditData | null;
  activePitch: PitchData | null;
  newerAuditAvailable: boolean;
  emailPreview: Preview;
};

export function CompanyAuditPitchCards({
  companyId,
  enrichmentStatus,
  contactCount = 0,
  latestAudit,
  activePitch,
  newerAuditAvailable,
  emailPreview,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [firstLine, setFirstLine] = useState(
    activePitch?.personalizedFirstLine ?? ""
  );
  const [shortPitch, setShortPitch] = useState(activePitch?.shortPitch ?? "");

  const needsManualEnrich =
    enrichmentStatus !== "ENRICHED" && enrichmentStatus !== "SKIPPED";

  async function useClientDetails() {
    setBusy("manual");
    try {
      const res = await fetch("/api/autopilot/enrichment/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success(
        json.data?.status === "ALREADY_ENRICHED"
          ? "Already enriched — you can audit now"
          : "Marked enriched from client details — Audit now is ready"
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function auditNow() {
    setBusy("audit");
    try {
      const res = await fetch("/api/autopilot/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: [companyId], limit: 1 }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      const processed = json.data?.processed ?? 0;
      if (processed === 0) {
        toast.error(
          "Nothing audited — mark enriched (Use client details) or check website + contact email"
        );
      } else {
        toast.success("Audit started");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setBusy(null);
    }
  }

  async function pitchAction(action: "approve" | "edit" | "regenerate") {
    if (!activePitch) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/autopilot/pitches/${activePitch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          personalizedFirstLine: firstLine,
          shortPitch,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      toast.success(
        action === "approve"
          ? "Pitch approved"
          : action === "regenerate"
            ? "Regenerating…"
            : "Saved"
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const checks = Array.isArray(latestAudit?.checks) ? latestAudit!.checks : [];
  const issues = latestAudit?.findings?.top_issues ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Website audit</CardTitle>
            <CardDescription>
              PageSpeed + rule checks. History kept; latest shown.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {needsManualEnrich ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === "manual" || contactCount === 0}
                onClick={useClientDetails}
                title={
                  contactCount === 0
                    ? "Add a contact with email first"
                    : "Skip Hunter — use contacts you already entered"
                }
              >
                {busy === "manual" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Use client details
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "audit"}
              onClick={auditNow}
            >
              {busy === "audit" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Audit now
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!latestAudit ? (
            <EmptyState
              title="Not audited yet"
              description={
                needsManualEnrich
                  ? "For manual leads: click Use client details (needs website + contact email), then Audit now. Or run Hunter enrichment."
                  : "Ready — click Audit now (or Autopilot → Audit)."
              }
              actionHref={appHome("/autopilot?tab=audit")}
              actionLabel="Open Audit"
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{latestAudit.status}</Badge>
                <span>
                  Mobile{" "}
                  <strong>{latestAudit.pageSpeedMobile ?? "—"}</strong>
                </span>
                <span>
                  Desktop{" "}
                  <strong>{latestAudit.pageSpeedDesktop ?? "—"}</strong>
                </span>
              </div>
              {checks.length > 0 ? (
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {checks.map((c) => (
                    <li key={c.id} className="flex gap-2 text-xs">
                      <span className="w-12 shrink-0 font-medium">
                        {c.pass === true
                          ? "Pass"
                          : c.pass === false
                            ? "Fail"
                            : "—"}
                      </span>
                      <span>
                        {c.label}: {c.evidence}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {issues.length > 0 ? (
                <div className="space-y-2 border-t pt-3">
                  <p className="font-medium">Top issues</p>
                  {issues.map((i) => (
                    <div key={i.issue} className="text-xs space-y-0.5">
                      <p className="font-medium">{i.issue}</p>
                      <p className="text-muted-foreground">
                        Evidence: {i.evidence}
                      </p>
                      <p className="text-muted-foreground">
                        Impact: {i.business_impact}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              {latestAudit.findings &&
              typeof latestAudit === "object" &&
              activePitch?.recommendedService ? (
                <p className="text-xs">
                  Recommended service: {activePitch.recommendedService}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pitch</CardTitle>
          <CardDescription>
            Separate from audit history. Re-audit does not replace an APPROVED
            pitch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!activePitch ? (
            <EmptyState
              title="No pitch yet"
              description="A successful audit creates a DRAFT pitch for the primary contact."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    activePitch.status === "APPROVED" ? "default" : "outline"
                  }
                >
                  {activePitch.status}
                </Badge>
                {newerAuditAvailable ? (
                  <span className="text-amber-700 dark:text-amber-400 text-xs">
                    Newer audit available — regenerate?
                  </span>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  First line
                </label>
                <Textarea
                  value={firstLine}
                  onChange={(e) => setFirstLine(e.target.value)}
                  rows={2}
                />
                <label className="text-xs text-muted-foreground">
                  Short pitch
                </label>
                <Textarea
                  value={shortPitch}
                  onChange={(e) => setShortPitch(e.target.value)}
                  rows={4}
                />
              </div>
              {activePitch.status === "APPROVED" ? (
                <p className="text-xs text-muted-foreground rounded-md border border-dashed p-2">
                  Approved for the contact below. Outbound uses this pitch —
                  enroll/queue on Autopilot → Outbound, then Process outbox (or
                  wait for the Mon–Fri 8–11 prospect window). You can still edit
                  + Save, or Regenerate if the audit changed.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {activePitch.status !== "APPROVED" ? (
                  <Button
                    size="sm"
                    disabled={Boolean(busy)}
                    onClick={() => pitchAction("approve")}
                  >
                    Approve
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => pitchAction("edit")}
                >
                  Save edits
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(busy)}
                  onClick={() => pitchAction("regenerate")}
                >
                  Regenerate
                </Button>
              </div>
              <div className="pt-2">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Rendered email
                </p>
                <EmailPreview pitchId={activePitch.id} />
              </div>
            </>
          )}

          {emailPreview ? (
            <div className="border-t pt-3 space-y-2">
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                Email preview
                {emailPreview.sequenceName
                  ? ` · ${emailPreview.sequenceName}`
                  : " · default template"}
              </p>
              {emailPreview.subject ? (
                <p className="text-xs">
                  <span className="text-muted-foreground">Subject: </span>
                  {emailPreview.subject}
                </p>
              ) : null}
              <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
                {emailPreview.body}
              </pre>
              {emailPreview.missingRequired.length > 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Fallback used for: {emailPreview.missingRequired.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
