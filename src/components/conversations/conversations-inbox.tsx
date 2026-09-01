"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { ExternalLink, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Conversation {
  id: string;
  channel: string;
  subject: string | null;
  content: string | null;
  summary: string | null;
  isInbound: boolean;
  classification: string | null;
  createdAt: string;
  lead: {
    id: string;
    fullName: string;
    companyName: string | null;
    status: string;
    automationStatus: string;
  };
}

interface ConversationsInboxProps {
  initialConversations: Conversation[];
}

export function ConversationsInbox({ initialConversations }: ConversationsInboxProps) {
  const router = useRouter();
  const [replyContent, setReplyContent] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [channel, setChannel] = useState("LINKEDIN");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uniqueLeads = Array.from(
    new Map(initialConversations.map((c) => [c.lead.id, c.lead])).values()
  );

  async function simulateReply() {
    if (!selectedLeadId || !replyContent.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLeadId,
          channel,
          content: replyContent,
          autoRespond: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Reply processed — AI response generated");
      setReplyContent("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process reply");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm font-medium">Simulate Inbound Reply (for testing)</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Lead</Label>
              <Select value={selectedLeadId} onValueChange={(v) => v && setSelectedLeadId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select lead" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueLeads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.fullName} — {lead.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => v && setChannel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea
            placeholder="Paste client reply here..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={3}
          />
          <Button onClick={simulateReply} disabled={isSubmitting} size="sm">
            <Send className="mr-2 h-4 w-4" />
            Process with AI
          </Button>
        </CardContent>
      </Card>

      {initialConversations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No conversations yet. Run AI automation on leads to generate outreach.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {initialConversations.map((conv) => (
            <Card key={conv.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/dashboard/leads/${conv.lead.id}`}
                        className="font-medium hover:underline flex items-center gap-1"
                      >
                        {conv.lead.fullName}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      <Badge variant="outline" className="text-xs">{conv.channel}</Badge>
                      <Badge variant={conv.isInbound ? "secondary" : "default"} className="text-xs">
                        {conv.isInbound ? "Inbound" : "Outbound"}
                      </Badge>
                      {conv.classification && (
                        <Badge variant="outline" className="text-xs">{conv.classification}</Badge>
                      )}
                    </div>
                    {conv.subject && (
                      <p className="text-sm font-medium text-muted-foreground">{conv.subject}</p>
                    )}
                    <p className="text-sm mt-2 whitespace-pre-wrap">{conv.content}</p>
                    {conv.summary && (
                      <p className="text-xs text-muted-foreground mt-2 italic">AI: {conv.summary}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(conv.createdAt), "MMM d, h:mm a")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
