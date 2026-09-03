"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  Mail,
  RefreshCw,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface InboxMessage {
  id: string;
  direction: string;
  subject: string | null;
  body: string | null;
  fromEmail: string | null;
  toEmail: string | null;
  aiClassification: string | null;
  aiSummary: string | null;
  suggestedNextAction: string | null;
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
}

interface InboxConversation {
  id: string;
  subject: string | null;
  status: string;
  sentiment: string | null;
  intent: string | null;
  lastMessageAt: string | null;
  company: { id: string; name: string; domain: string | null } | null;
  contact: {
    id: string;
    fullName: string;
    email: string | null;
    title: string | null;
  } | null;
  opportunity: { id: string; stage: string; score: number } | null;
  messages: InboxMessage[];
}

interface UnifiedInboxProps {
  initialConversations: InboxConversation[];
}

export function UnifiedInbox({ initialConversations }: UnifiedInboxProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(
    initialConversations[0]?.id ?? ""
  );
  const [detail, setDetail] = useState<InboxConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const selected = useMemo(() => {
    if (detail && detail.id === selectedId) return detail;
    return initialConversations.find((c) => c.id === selectedId) ?? null;
  }, [detail, selectedId, initialConversations]);

  async function openConversation(id: string) {
    setSelectedId(id);
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setDetail({
        ...data.data,
        lastMessageAt: data.data.lastMessageAt,
        messages: data.data.messages.map(
          (m: InboxMessage & { createdAt: string | Date }) => ({
            ...m,
            createdAt:
              typeof m.createdAt === "string"
                ? m.createdAt
                : new Date(m.createdAt).toISOString(),
          })
        ),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load thread");
    } finally {
      setLoading(false);
    }
  }

  async function syncInbox() {
    setSyncing(true);
    try {
      const res = await fetch("/api/inbox/sync", { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Inbox synced from Gmail/Outlook");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Unified inbox — replies attach to company, contact, and opportunity.
        </p>
        <Button variant="outline" size="sm" onClick={syncInbox} disabled={syncing}>
          {syncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync inbox
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Threads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
            {initialConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No inbox conversations yet. Connect Gmail or Outlook in Settings,
                then sync — or send outreach from an opportunity.
              </p>
            ) : (
              initialConversations.map((c) => {
                const preview = c.messages[0];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition ${
                      selectedId === c.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {c.contact?.fullName ||
                          c.company?.name ||
                          c.subject ||
                          "Conversation"}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {c.status}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.subject || preview?.body || "—"}
                    </p>
                    {preview?.aiClassification && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {preview.aiClassification}
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {selected?.subject || "Select a conversation"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">
                Choose a thread to view messages and AI next actions.
              </p>
            ) : loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {selected.company && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {selected.company.name}
                    </span>
                  )}
                  {selected.contact && (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {selected.contact.fullName}
                      {selected.contact.email ? ` · ${selected.contact.email}` : ""}
                    </span>
                  )}
                  {selected.opportunity && (
                    <Link
                      href={`/dashboard/opportunities/${selected.opportunity.id}`}
                      className="text-primary hover:underline"
                    >
                      Opportunity · {selected.opportunity.stage} · score{" "}
                      {selected.opportunity.score}
                    </Link>
                  )}
                </div>

                {(selected.sentiment || selected.intent) && (
                  <div className="flex flex-wrap gap-2">
                    {selected.sentiment && (
                      <Badge variant="outline">Sentiment: {selected.sentiment}</Badge>
                    )}
                    {selected.intent && (
                      <Badge variant="outline">Intent: {selected.intent}</Badge>
                    )}
                  </div>
                )}

                <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                  {(detail?.messages ?? selected.messages).map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-md border p-3 ${
                        m.direction === "INBOUND"
                          ? "bg-muted/40"
                          : "bg-primary/5"
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{m.direction}</Badge>
                        <span>
                          {m.fromEmail} → {m.toEmail}
                        </span>
                        <span>
                          {format(
                            new Date(m.receivedAt || m.sentAt || m.createdAt),
                            "MMM d, HH:mm"
                          )}
                        </span>
                      </div>
                      {m.aiClassification && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          <Badge>{m.aiClassification}</Badge>
                          {m.suggestedNextAction && (
                            <span className="text-xs text-muted-foreground">
                              Next: {m.suggestedNextAction}
                            </span>
                          )}
                        </div>
                      )}
                      {m.aiSummary && (
                        <p className="mb-2 text-xs text-muted-foreground">
                          {m.aiSummary}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-sm">
                        {m.body || "(no body)"}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
