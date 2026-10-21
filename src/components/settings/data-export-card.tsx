"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Job = {
  id: string;
  status: string;
  downloadToken: string;
  fileSizeBytes: number | null;
  error: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
  downloadPath: string | null;
};

export function DataExportCard({ autoStart = false }: { autoStart?: boolean }) {
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/privacy/export");
    const json = await res.json();
    if (json.success) setJob(json.data.job);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoStart) return;
    void (async () => {
      await refresh();
    })();
  }, [autoStart, refresh]);

  useEffect(() => {
    if (!job) return;
    if (job.status !== "PENDING" && job.status !== "PROCESSING") return;
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [job, refresh]);

  async function startExport() {
    setBusy(true);
    try {
      const res = await fetch("/api/privacy/export", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success("Export started");
        await refresh();
      } else {
        toast.error(json.error?.message || "Export failed to start");
      }
    } finally {
      setBusy(false);
    }
  }

  function statusVariant(s: string) {
    if (s === "READY") return "default" as const;
    if (s === "FAILED" || s === "EXPIRED") return "destructive" as const;
    return "secondary" as const;
  }

  return (
    <Card id="data-export">
      <CardHeader>
        <CardTitle>Data export</CardTitle>
        <CardDescription>
          Download a ZIP of CSVs (companies, contacts, opportunities,
          conversations/messages, campaigns, invoices). Link valid 24 hours.
          Available even when canceled or suspended.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {job ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
            <span className="text-muted-foreground">
              Started {new Date(job.createdAt).toLocaleString()}
            </span>
            {job.expiresAt && job.status === "READY" ? (
              <span className="text-muted-foreground">
                · expires {new Date(job.expiresAt).toLocaleString()}
              </span>
            ) : null}
            {job.fileSizeBytes != null ? (
              <span className="text-muted-foreground">
                · {(job.fileSizeBytes / 1024).toFixed(1)} KB
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No export yet.</p>
        )}

        {job?.error ? (
          <p className="text-sm text-destructive">{job.error}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => void startExport()}
          >
            {busy ? "Starting…" : "Generate export"}
          </Button>
          {job?.status === "READY" && job.downloadPath ? (
            <a
              href={job.downloadPath}
              className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              Download ZIP
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
