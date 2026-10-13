"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

interface InboxMessage {
  id: string;
  direction: string;
  subject: string | null;
  body: string | null;
  fromEmail: string | null;
  toEmail: string | null;
  status?: string | null;
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

type InboxFilter = "all" | "needs" | "interested" | "replied";

type ThreadTag = { label: string; tone: "warn" | "ok" | "brand" | "" };

function humanize(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (ch) => ch.toUpperCase());
}

function isDraft(m: InboxMessage): boolean {
  return m.direction === "OUTBOUND" && m.status === "DRAFT";
}

function threadName(c: InboxConversation): string {
  return c.contact?.fullName || c.company?.name || c.subject || "Conversation";
}

function threadTitle(c: InboxConversation): string {
  const person = c.contact?.fullName;
  const company = c.company?.name;
  if (person && company) return `${person} · ${company}`;
  return person || company || c.subject || "Conversation";
}

function threadTag(c: InboxConversation): ThreadTag | null {
  const last = c.messages[0];
  const cls = last?.aiClassification;
  if (c.status === "NEEDS_ACTION") {
    return {
      label: cls === "QUESTION" ? "Needs you · question" : "Needs you",
      tone: "warn",
    };
  }
  if (cls === "INTERESTED" || cls === "POSITIVE") {
    return { label: "Interested", tone: "ok" };
  }
  if (last && last.direction === "OUTBOUND" && !isDraft(last)) {
    return { label: "AI replied", tone: "brand" };
  }
  if (c.status === "SNOOZED") return { label: "Snoozed", tone: "" };
  if (c.status === "CLOSED") return { label: "Closed", tone: "" };
  if (cls) return { label: humanize(cls), tone: "" };
  return null;
}

function isUnread(c: InboxConversation): boolean {
  const last = c.messages[0];
  return (
    !!last &&
    last.direction === "INBOUND" &&
    c.status !== "CLOSED" &&
    c.status !== "SNOOZED"
  );
}

function matchesFilter(c: InboxConversation, filter: InboxFilter): boolean {
  if (filter === "all") return true;
  const tag = threadTag(c);
  if (filter === "needs") return c.status === "NEEDS_ACTION" || isUnread(c);
  if (filter === "interested") return tag?.label === "Interested";
  return tag?.label === "AI replied";
}

function shortTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return format(d, "HH:mm");
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7) return format(d, "EEE");
  return format(d, "MMM d");
}

export function UnifiedInbox({ initialConversations }: UnifiedInboxProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(
    initialConversations[0]?.id ?? ""
  );
  const [detail, setDetail] = useState<InboxConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>("all");

  const selected = useMemo(() => {
    if (detail && detail.id === selectedId) return detail;
    return initialConversations.find((c) => c.id === selectedId) ?? null;
  }, [detail, selectedId, initialConversations]);

  const visible = useMemo(
    () => initialConversations.filter((c) => matchesFilter(c, filter)),
    [initialConversations, filter]
  );

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
      if (!data.success) throw new Error(data.error?.message || "Sync failed");

      const payload = data.data as {
        warning?: string | null;
        successMessage?: string;
        synced?: number;
        errors?: number;
        oauthAccountCount?: number;
        smtpAccountsSkipped?: number;
        results?: Array<{ error?: string; synced?: number }>;
      };

      if (payload.warning) {
        toast.warning(payload.warning);
      } else if (payload.errors && payload.errors > 0 && !(payload.synced ?? 0)) {
        const firstError = payload.results?.find((r) => r.error)?.error;
        toast.error(firstError || "Inbox sync failed");
      } else {
        toast.success(
          payload.successMessage ||
            (payload.synced
              ? `Imported ${payload.synced} new message(s)`
              : "Inbox synced — no new messages")
        );
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const allMessages = selected?.messages ?? [];
  const thread = [...allMessages]
    .filter((m) => !isDraft(m))
    .sort(
      (a, b) =>
        new Date(a.receivedAt || a.sentAt || a.createdAt).getTime() -
        new Date(b.receivedAt || b.sentAt || b.createdAt).getTime()
    );
  const drafts = allMessages.filter(isDraft);
  const draft = drafts.length
    ? [...drafts].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0]
    : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Inbox</h1>
          <p className="page-sub">
            Replies from prospects. The AI answers most of them for you.
          </p>
        </div>
        <div className="page-actions">
          <label className="select">
            Show:
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as InboxFilter)}
              aria-label="Filter threads"
            >
              <option value="all">All</option>
              <option value="needs">Needs me</option>
              <option value="interested">Interested</option>
              <option value="replied">AI replied</option>
            </select>
          </label>
          <button
            type="button"
            className="btn"
            onClick={syncInbox}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Sync inbox
          </button>
        </div>
      </div>

      <div className="card inbox">
        <div className="thread-list">
          {initialConversations.length === 0 ? (
            <div className="reader-empty">
              No inbox conversations yet. Connect Gmail or Outlook in Settings,
              then sync — or send outreach from an opportunity.
            </div>
          ) : visible.length === 0 ? (
            <div className="reader-empty">No threads match this filter.</div>
          ) : (
            visible.map((c) => {
              const preview = c.messages[0];
              const tag = threadTag(c);
              const unread = isUnread(c);
              const snippet = preview?.body?.trim() || c.subject || "—";
              const snipText =
                preview && preview.direction === "OUTBOUND" && !isDraft(preview)
                  ? `AI: ${snippet}`
                  : snippet;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openConversation(c.id)}
                  className={`thread${selectedId === c.id ? " active" : ""}`}
                >
                  {unread ? (
                    <span className="unread" />
                  ) : (
                    <span className="thread-gap" />
                  )}
                  <div className="thread-body">
                    <div className="thread-top">
                      <span className="thread-name">{threadName(c)}</span>
                      <span className="thread-time" suppressHydrationWarning>
                        {shortTime(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className="thread-snip">{snipText}</div>
                    {tag ? (
                      <div style={{ marginTop: 6 }}>
                        <span className={`badge ${tag.tone}`.trim()}>
                          {tag.label}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="reader">
          {!selected ? (
            <div className="reader-empty">
              Choose a thread to view messages and AI next actions.
            </div>
          ) : (
            <>
              <div className="reader-head">
                <div className="avatar">
                  {threadName(selected).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cell-main">{threadTitle(selected)}</div>
                  <div className="cell-sub">
                    {selected.contact?.email ?? selected.subject ?? "—"}
                    {selected.opportunity
                      ? ` · Deal: ${humanize(selected.opportunity.stage)} · score ${selected.opportunity.score}`
                      : ""}
                  </div>
                </div>
                {selected.company ? (
                  <Link
                    href={`/dashboard/companies/${selected.company.id}`}
                    className="btn"
                  >
                    Open company
                  </Link>
                ) : null}
              </div>

              <div className="reader-links">
                {selected.contact ? (
                  <Link href={`/dashboard/contacts/${selected.contact.id}`}>
                    Contact
                  </Link>
                ) : null}
                {selected.opportunity ? (
                  <Link
                    href={`/dashboard/opportunities/${selected.opportunity.id}`}
                  >
                    Opportunity
                  </Link>
                ) : null}
                {selected.sentiment ? (
                  <span className="badge plain">
                    Sentiment: {selected.sentiment}
                  </span>
                ) : null}
                {selected.intent ? (
                  <span className="badge plain">Intent: {selected.intent}</span>
                ) : null}
              </div>

              {loading ? (
                <div
                  className="reader-empty"
                  style={{ display: "flex", justifyContent: "center", gap: 8 }}
                >
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <div className="reader-body">
                    {thread.length === 0 ? (
                      <div className="reader-empty">No messages yet.</div>
                    ) : (
                      thread.map((m) => {
                        const inbound = m.direction === "INBOUND";
                        return (
                          <div
                            key={m.id}
                            className={`msg${inbound ? " in" : ""}`}
                          >
                            <div className="msg-meta">
                              <span
                                className={`badge plain ${inbound ? "" : "brand"}`.trim()}
                              >
                                {inbound
                                  ? selected.contact?.fullName?.split(" ")[0] ||
                                    "Prospect"
                                  : "You"}
                              </span>
                              <span suppressHydrationWarning>
                                {format(
                                  new Date(m.receivedAt || m.sentAt || m.createdAt),
                                  "MMM d · h:mm a"
                                )}
                              </span>
                              {m.aiClassification ? (
                                <span className="badge info plain">
                                  {humanize(m.aiClassification)}
                                </span>
                              ) : null}
                            </div>
                            {m.aiSummary ? (
                              <p className="msg-ai">
                                {m.aiSummary}
                                {m.suggestedNextAction
                                  ? ` Next: ${m.suggestedNextAction}`
                                  : ""}
                              </p>
                            ) : null}
                            <div className="msg-body">
                              {m.body || "(no body)"}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {draft ? (
                    <div className="ai-box">
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <Sparkles
                          width={16}
                          height={16}
                          style={{ color: "var(--dx-brand-hover)" }}
                        />
                        <b>AI draft</b>
                        <span className="muted">— held for review</span>
                      </div>
                      <textarea readOnly value={draft.body ?? ""} />
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
