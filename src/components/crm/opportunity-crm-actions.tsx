"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface OpportunityCrmActionsProps {
  opportunityId: string;
  companyId: string;
  contactId?: string | null;
  currency: string;
  estimatedValue?: number | null;
}

export function OpportunityCrmActions({
  opportunityId,
  companyId,
  contactId,
  currency,
  estimatedValue,
}: OpportunityCrmActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const [meetingTitle, setMeetingTitle] = useState("Discovery call");
  const [meetingStart, setMeetingStart] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");

  const [proposalTitle, setProposalTitle] = useState("Proposal");
  const [proposalTotal, setProposalTotal] = useState(
    estimatedValue != null ? String(estimatedValue) : ""
  );
  const [proposalContent, setProposalContent] = useState("");

  const [taskTitle, setTaskTitle] = useState("Follow up");

  async function bookMeeting() {
    if (!meetingStart) {
      toast.error("Pick a start time");
      return;
    }
    setBusy("meeting");
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meetingTitle,
          startAt: new Date(meetingStart).toISOString(),
          meetingUrl: meetingUrl || null,
          opportunityId,
          companyId,
          contactId,
          advanceOpportunity: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Meeting booked — stage set to Meeting");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function createProposal() {
    setBusy("proposal");
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: proposalTitle,
          content: proposalContent || null,
          total: proposalTotal ? Number(proposalTotal) : null,
          currency,
          opportunityId,
          companyId,
          contactId,
          advanceOpportunity: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Proposal created — stage set to Proposal");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function createTask() {
    setBusy("task");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          type: "FOLLOW_UP",
          opportunityId,
          companyId,
          contactId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Task created");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function markWon() {
    setBusy("won");
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "WON" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Won — deal closed and revenue recognized");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Book meeting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} />
          </div>
          <div>
            <Label>Start</Label>
            <Input
              type="datetime-local"
              value={meetingStart}
              onChange={(e) => setMeetingStart(e.target.value)}
            />
          </div>
          <div>
            <Label>Meeting URL</Label>
            <Input
              placeholder="https://..."
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
            />
          </div>
          <Button onClick={bookMeeting} disabled={busy === "meeting"}>
            {busy === "meeting" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Book meeting
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create proposal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={proposalTitle} onChange={(e) => setProposalTitle(e.target.value)} />
          </div>
          <div>
            <Label>Total ({currency})</Label>
            <Input
              type="number"
              value={proposalTotal}
              onChange={(e) => setProposalTotal(e.target.value)}
            />
          </div>
          <div>
            <Label>Content</Label>
            <Textarea
              rows={3}
              value={proposalContent}
              onChange={(e) => setProposalContent(e.target.value)}
            />
          </div>
          <Button onClick={createProposal} disabled={busy === "proposal"}>
            {busy === "proposal" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create proposal
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          <Button onClick={createTask} disabled={busy === "task"} variant="outline">
            Add follow-up task
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Close won</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Marks opportunity Won, syncs the deal, and creates a revenue entry.
          </p>
          <Button onClick={markWon} disabled={busy === "won"}>
            {busy === "won" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark as won → revenue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export { OpportunityCrmActions as default };
