"use client";

import { useCallback, useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PreviewItem = {
  campaignLeadId: string;
  leadId: string;
  leadEmail: string | null;
  leadName: string;
  alreadyBridged: boolean;
  enrollmentId: string | null;
  canBridge: boolean;
  blockers: string[];
  pendingFollowUpJobs: number;
  processingFollowUpJobs: number;
};

type Preview = {
  campaignId: string;
  sequenceId: string | null;
  sequenceStatus: string | null;
  totals: {
    campaignLeads: number;
    alreadyBridged: number;
    bridgeable: number;
    blocked: number;
    pendingFollowUpJobs: number;
  };
  items: PreviewItem[];
  notes: string[];
};

export function CampaignBridgePreviewPanel({
  campaignId,
  canPreview,
}: {
  campaignId: string;
  canPreview: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const runPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/bridge-preview`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Preview failed");
      setPreview(data.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  if (!canPreview) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Cutover preview</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only estimate of CampaignLead → SequenceEnrollment bridges. No bulk migrate.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runPreview} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ScanSearch className="mr-2 h-4 w-4" />
          )}
          Preview bridge
        </Button>
      </CardHeader>
      {preview ? (
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">
              Leads scanned: {preview.totals.campaignLeads}
            </Badge>
            <Badge variant="secondary">
              Already bridged: {preview.totals.alreadyBridged}
            </Badge>
            <Badge variant="default">Bridgeable: {preview.totals.bridgeable}</Badge>
            <Badge variant="outline">Blocked: {preview.totals.blocked}</Badge>
            <Badge variant="outline">
              Follow-ups at risk: {preview.totals.pendingFollowUpJobs}
            </Badge>
            {preview.sequenceStatus ? (
              <Badge variant="outline">
                Sequence: {preview.sequenceStatus}
              </Badge>
            ) : (
              <Badge variant="destructive">No default sequence</Badge>
            )}
          </div>

          <div className="max-h-64 overflow-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-muted/80">
                <tr>
                  <th className="p-2 font-medium">Lead</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Follow-ups</th>
                  <th className="p-2 font-medium">Blockers</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item) => (
                  <tr key={item.campaignLeadId} className="border-t">
                    <td className="p-2">
                      <div>{item.leadName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.leadEmail ?? "no email"}
                      </div>
                    </td>
                    <td className="p-2">
                      {item.alreadyBridged
                        ? "Bridged"
                        : item.canBridge
                          ? "Ready"
                          : "Blocked"}
                    </td>
                    <td className="p-2">
                      {item.pendingFollowUpJobs + item.processingFollowUpJobs}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {item.blockers.join("; ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {preview.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}
