"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SequenceOption = { id: string; name: string; status: string };
type ContactOption = { id: string; fullName: string; email: string | null };
type EnrollmentRow = {
  id: string;
  status: string;
  currentStepOrder: number;
  nextRunAt: string | null;
  stopReason: string | null;
  sequence: { id: string; name: string };
  contact: { id: string; fullName: string; email: string | null };
  campaign: { id: string; name: string } | null;
};

interface SequenceEnrollmentPanelProps {
  opportunityId?: string;
  contactId?: string;
  companyContactIds?: ContactOption[];
  sequences: SequenceOption[];
  campaigns?: { id: string; name: string }[];
  enrollments: EnrollmentRow[];
  canManage: boolean;
}

export function SequenceEnrollmentPanel({
  opportunityId,
  contactId,
  companyContactIds = [],
  sequences,
  campaigns = [],
  enrollments,
  canManage,
}: SequenceEnrollmentPanelProps) {
  const router = useRouter();
  const [sequenceId, setSequenceId] = useState(sequences[0]?.id ?? "");
  const [selectedContactId, setSelectedContactId] = useState(
    contactId ?? companyContactIds[0]?.id ?? ""
  );
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function enroll() {
    if (!sequenceId || !selectedContactId) {
      toast.error("Select a sequence and contact");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContactId,
          opportunityId: opportunityId || null,
          campaignId: campaignId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Enroll failed");
      toast.success("Enrolled in sequence");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enroll failed");
    } finally {
      setBusy(false);
    }
  }

  async function action(id: string, path: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/enrollments/${id}/${path}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Action failed");
      toast.success(`Enrollment ${path}d`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const activeSequences = sequences.filter((s) => s.status === "ACTIVE");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sequence enrollments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && activeSequences.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Select
              value={sequenceId}
              onValueChange={(v) => v && setSequenceId(v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sequence" />
              </SelectTrigger>
              <SelectContent>
                {activeSequences.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!contactId && companyContactIds.length > 0 && (
              <Select
                value={selectedContactId}
                onValueChange={(v) => v && setSelectedContactId(v)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Contact" />
                </SelectTrigger>
                <SelectContent>
                  {companyContactIds.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {campaigns.length > 0 && (
              <Select
                value={campaignId}
                onValueChange={(v) => v && setCampaignId(v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" disabled={busy} onClick={enroll}>
              Enroll
            </Button>
          </div>
        )}

        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sequence enrollments yet
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            {enrollments.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
              >
                <div>
                  <div className="font-medium">{e.sequence.name}</div>
                  <div className="text-muted-foreground">
                    {e.contact.fullName}
                    {e.campaign ? ` · ${e.campaign.name}` : ""}
                    {" · step "}
                    {e.currentStepOrder}
                    {e.nextRunAt
                      ? ` · next ${format(new Date(e.nextRunAt), "MMM d HH:mm")}`
                      : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{e.status}</Badge>
                  {canManage && e.status === "ACTIVE" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => action(e.id, "pause")}
                      >
                        Pause
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => action(e.id, "stop")}
                      >
                        Stop
                      </Button>
                    </>
                  )}
                  {canManage && e.status === "PAUSED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => action(e.id, "resume")}
                    >
                      Resume
                    </Button>
                  )}
                  {canManage && e.status === "FAILED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => action(e.id, "retry")}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
