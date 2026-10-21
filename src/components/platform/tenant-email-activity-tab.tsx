"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPlatformDate } from "@/lib/platform/format";

type SendRow = {
  id: string;
  toEmail: string;
  templateKey: string;
  eventKey: string;
  status: string;
  attempts: number;
  providerMessageId: string | null;
  error: string | null;
  subject: string | null;
  sentAt: string | null;
  createdAt: string;
};

export function TenantEmailActivityTab({
  organizationId,
}: {
  organizationId: string;
}) {
  const [rows, setRows] = useState<SendRow[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      const res = await fetch(
        `/api/platform/organizations/${organizationId}/email-sends?${sp}`
      );
      const json = await res.json();
      if (json.success) {
        setRows(json.data.rows || []);
        setTotal(json.data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function statusVariant(s: string) {
    if (s === "SENT") return "default" as const;
    if (s === "FAILED" || s === "BOUNCED") return "destructive" as const;
    return "secondary" as const;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Platform emails</CardTitle>
          <CardDescription>
            Lifecycle emails sent to this organization ({total})
          </CardDescription>
        </div>
        <select
          className="border rounded-md h-9 px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="QUEUED">Queued</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
          <option value="BOUNCED">Bounced</option>
        </select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No platform emails yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subject</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatPlatformDate(r.sentAt || r.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.templateKey}
                  </TableCell>
                  <TableCell className="text-xs">{r.toEmail}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)}>
                      {r.status}
                      {r.attempts > 1 ? ` ×${r.attempts}` : ""}
                    </Badge>
                    {r.error ? (
                      <p className="text-xs text-destructive mt-1 max-w-[200px] truncate">
                        {r.error}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs max-w-[240px] truncate">
                    {r.subject || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
