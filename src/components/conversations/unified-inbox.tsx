"use client";
import { appHome } from "@/lib/app-paths";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";

interface InboxMessage {
  id: string;
  direction: string;
  subject: string | null;
  body: string | null;
  bodyHtml?: string | null;
  fromEmail: string | null;
  toEmail: string | null;
  status?: string | null;
  aiClassification: string | null;
  aiConfidence?: number | string | null;
  aiSummary: string | null;
  holdReason?: string | null;
  sentByAi?: boolean;
  suggestedNextAction: string | null;
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
}

interface AiReplyDraftInfo {
  id: string;
  status: string; // DRAFT | HELD | QUEUED | SENT | DISMISSED | CANCELLED
  class: string;
  confidence: number;
  holdReason: string | null;
  replyText: string;
  offersBooking: boolean;
  scheduledFor: string | null;
}

interface InboxConversation {
  id: string;
  subject: string | null;
  status: string;
  sentiment: string | null;
  intent: string | null;
  lastMessageAt: string | null;
  latestClass?: string | null;
  latestConfidence?: number | string | null;
  holdReason?: string | null;
  aiReplyCount?: number;
  aiReplyDraft?: AiReplyDraftInfo | null;
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
  initialSelectedId?: string;
}

type InboxFilter =
  | "all"
  | "needs"
  | "ai_drafted"
  | "ai_sent"
  | "interested"
  | "question"
  | "not_now"
  | "not_interested"
  | "wrong_person"
  | "other";

type DraftAction =
  | "send"
  | "edit_send"
  | "regenerate"
  | "insert_booking"
  | "dismiss"
  | "reclassify";

type ThreadTag = { label: string; tone: "warn" | "ok" | "brand" | "" };

const CLASS_FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "interested", label: "Class: Interested" },
  { value: "question", label: "Class: Question" },
  { value: "not_now", label: "Class: Not now" },
  { value: "not_interested", label: "Class: Not interested" },
  { value: "wrong_person", label: "Class: Wrong person" },
  { value: "other", label: "Class: Other" },
];

const RECLASSIFY_OPTIONS = [
  "interested",
  "question",
  "not_now",
  "not_interested",
  "wrong_person",
  "unsubscribe",
  "other",
] as const;

/** Legacy enum values → Phase 5 slug (mirrors LEGACY_CLASS_MAP; no Prisma import in client code). */
const LEGACY_TO_SLUG: Record<string, string> = {
  POSITIVE: "interested",
  NEGATIVE: "not_interested",
  OBJECTION: "question",
  NOT_RELEVANT: "other",
  REFERRAL: "wrong_person",
  UNKNOWN: "other",
};

function humanize(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (ch) => ch.toUpperCase());
}

function classSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.trim().toUpperCase().replace(/\s+/g, "_");
  return LEGACY_TO_SLUG[key] ?? key.toLowerCase();
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pct(v: number | string | null | undefined): string {
  const n = num(v);
  return n == null ? "" : `${Math.round(n * 100)}%`;
}

function holdLabel(reason: string | null | undefined): string {
  if (!reason) return "needs review";
  const clean = reason.replace(/^validation:/, "").replace(/^draft_failed:.*/, "draft_failed");
  return humanize(clean);
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

function convClass(c: InboxConversation): string | null {
  return classSlug(c.latestClass ?? c.messages[0]?.aiClassification ?? null);
}

function draftOpen(c: InboxConversation): boolean {
  const s = c.aiReplyDraft?.status;
  return s === "HELD" || s === "DRAFT" || s === "QUEUED";
}

function isAiSent(c: InboxConversation): boolean {
  const last = c.messages[0];
  return (
    (c.aiReplyCount ?? 0) > 0 ||
    c.aiReplyDraft?.status === "SENT" ||
    last?.sentByAi === true
  );
}

function threadTag(c: InboxConversation): ThreadTag | null {
  const last = c.messages[0];
  const cls = convClass(c);
  if (c.aiReplyDraft?.status === "HELD") {
    return { label: "Held for you", tone: "warn" };
  }
  if (c.status === "NEEDS_ACTION") {
    return {
      label: cls === "question" ? "Needs you · question" : "Needs you",
      tone: "warn",
    };
  }
  if (cls === "interested") {
    return { label: "Interested", tone: "ok" };
  }
  if (last && last.direction === "OUTBOUND" && !isDraft(last)) {
    return {
      label: last.sentByAi ? "Sent by AI" : "Replied",
      tone: "brand",
    };
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
  if (filter === "needs") {
    return (
      c.status === "NEEDS_ACTION" ||
      c.aiReplyDraft?.status === "HELD" ||
      isUnread(c)
    );
  }
  if (filter === "ai_drafted") return draftOpen(c);
  if (filter === "ai_sent") return isAiSent(c);
  return convClass(c) === filter;
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

type RawDetail = Omit<InboxConversation, "messages" | "aiReplyDraft"> & {
  messages: Array<InboxMessage & { createdAt: string | Date }>;
  aiReplyDrafts?: Array<{
    id: string;
    status: string;
    class: string;
    humanOverrideClass?: string | null;
    confidence: number | string;
    holdReason: string | null;
    replyText: string;
    offersBooking: boolean;
    scheduledFor: string | null;
  }>;
};

function normalizeDetail(raw: RawDetail): InboxConversation {
  const d = raw.aiReplyDrafts?.[0] ?? null;
  return {
    ...raw,
    latestConfidence: num(raw.latestConfidence),
    messages: raw.messages.map((m) => ({
      ...m,
      aiConfidence: num(m.aiConfidence),
      createdAt:
        typeof m.createdAt === "string"
          ? m.createdAt
          : new Date(m.createdAt).toISOString(),
    })),
    aiReplyDraft: d
      ? {
          id: d.id,
          status: d.status,
          class: d.humanOverrideClass ?? d.class,
          confidence: Number(d.confidence),
          holdReason: d.holdReason,
          replyText: d.replyText,
          offersBooking: d.offersBooking,
          scheduledFor: d.scheduledFor,
        }
      : null,
  };
}

export function UnifiedInbox({
  initialConversations,
  initialSelectedId,
}: UnifiedInboxProps) {
  const router = useRouter();
  // Don't auto-open a thread on narrow screens (list-first mobile UX)
  const [selectedId, setSelectedId] = useState(() => {
    if (initialSelectedId) return initialSelectedId;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
      return "";
    }
    return initialConversations[0]?.id ?? "";
  });
  const [detail, setDetail] = useState<InboxConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [draftBusy, setDraftBusy] = useState<DraftAction | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const selected = useMemo(() => {
    if (detail && detail.id === selectedId) return detail;
    return initialConversations.find((c) => c.id === selectedId) ?? null;
  }, [detail, selectedId, initialConversations]);

  const visible = useMemo(
    () => initialConversations.filter((c) => matchesFilter(c, filter)),
    [initialConversations, filter]
  );

  const aiDraft = selected?.aiReplyDraft ?? null;

  // Reset the editor whenever the underlying draft (or its text) changes.
  useEffect(() => {
    setEditing(false);
    setEditText(aiDraft?.replyText ?? "");
  }, [aiDraft?.id, aiDraft?.replyText]);

  async function openConversation(id: string, opts: { quiet?: boolean } = {}) {
    setSelectedId(id);
    if (!opts.quiet) setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setDetail(normalizeDetail(data.data as RawDetail));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load thread");
    } finally {
      setLoading(false);
    }
  }

  async function draftAction(
    action: DraftAction,
    extra: Record<string, unknown> = {}
  ) {
    if (!aiDraft || !selected) return;
    setDraftBusy(action);
    try {
      const res = await fetch(`/api/inbox/replies/${aiDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Action failed");
      const labels: Record<DraftAction, string> = {
        send: "Reply sent",
        edit_send: "Edited reply sent",
        regenerate: "Draft regenerated",
        insert_booking: "Booking link added",
        dismiss: "Draft dismissed",
        reclassify: "Reclassified",
      };
      toast.success(labels[action]);
      await openConversation(selected.id, { quiet: true });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setDraftBusy(null);
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
  const legacyDraft =
    !aiDraft && drafts.length
      ? [...drafts].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0]
      : null;

  const draftActionable = aiDraft?.status === "HELD" || aiDraft?.status === "DRAFT";
  const draftQueued = aiDraft?.status === "QUEUED";
  const busy = draftBusy !== null;
  const draftSlug = classSlug(aiDraft?.class);

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
              <option value="ai_drafted">AI drafted</option>
              <option value="ai_sent">AI sent</option>
              {CLASS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
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

      <div className={`card inbox${selectedId ? " show-reader" : ""}`}>
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
              const cls = convClass(c);
              const conf = pct(c.latestConfidence ?? preview?.aiConfidence);
              const snippet = preview?.body?.trim() || c.subject || "—";
              const snipText =
                preview && preview.direction === "OUTBOUND" && !isDraft(preview)
                  ? `${preview.sentByAi ? "AI" : "You"}: ${snippet}`
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
                    {tag || cls ? (
                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {tag ? (
                          <span className={`badge ${tag.tone}`.trim()}>
                            {tag.label}
                          </span>
                        ) : null}
                        {cls && tag?.label !== humanize(cls) ? (
                          <span className="badge info plain">
                            {humanize(cls)}
                            {conf ? ` · ${conf}` : ""}
                          </span>
                        ) : null}
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
                <button
                  type="button"
                  className="btn inbox-back"
                  onClick={() => setSelectedId("")}
                  aria-label="Back to threads"
                >
                  ← Threads
                </button>
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
                    href={appHome(`/companies/${selected.company.id}`)}
                    className="btn"
                  >
                    Open company
                  </Link>
                ) : null}
              </div>

              <div className="reader-links">
                {selected.contact ? (
                  <Link href={appHome(`/contacts/${selected.contact.id}`)}>
                    Contact
                  </Link>
                ) : null}
                {selected.opportunity ? (
                  <Link
                    href={appHome(`/opportunities/${selected.opportunity.id}`)}
                  >
                    Opportunity
                  </Link>
                ) : null}
                {convClass(selected) ? (
                  <span className="badge info plain">
                    Class: {humanize(convClass(selected)!)}
                    {pct(selected.latestConfidence)
                      ? ` · ${pct(selected.latestConfidence)}`
                      : ""}
                  </span>
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
                        const mClass = classSlug(m.aiClassification);
                        const mConf = pct(m.aiConfidence);
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
                                  : m.sentByAi
                                    ? "AI"
                                    : "You"}
                              </span>
                              <span suppressHydrationWarning>
                                {format(
                                  new Date(m.receivedAt || m.sentAt || m.createdAt),
                                  "MMM d · h:mm a"
                                )}
                              </span>
                              {!inbound && m.sentByAi ? (
                                <span className="badge brand">Sent by AI</span>
                              ) : null}
                              {mClass ? (
                                <span className="badge info plain">
                                  {humanize(mClass)}
                                  {mConf ? ` · ${mConf}` : ""}
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
                            {m.bodyHtml &&
                            (m.bodyHtml.includes("<") ||
                              m.direction === "OUTBOUND") ? (
                              <div
                                className="msg-body msg-html"
                                dangerouslySetInnerHTML={{
                                  __html: m.bodyHtml,
                                }}
                              />
                            ) : (
                              <div className="msg-body">
                                {m.body || "(no body)"}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {aiDraft && (draftActionable || draftQueued) ? (
                    <>
                      {aiDraft.status === "HELD" ? (
                        <div className="banner" style={{ margin: "16px 22px 0" }}>
                          <AlertTriangle />
                          <div className="t">
                            <b>Held for you</b>{" "}
                            <span className="muted">
                              · {holdLabel(aiDraft.holdReason ?? selected.holdReason)}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      <div className="ai-box">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <Sparkles
                            width={16}
                            height={16}
                            style={{ color: "var(--dx-brand-hover)" }}
                          />
                          <b>AI draft</b>
                          <span className="muted">
                            {aiDraft.status === "HELD"
                              ? "— held for review"
                              : draftQueued
                                ? `— queued to send${
                                    aiDraft.scheduledFor
                                      ? ` ${format(new Date(aiDraft.scheduledFor), "EEE h:mm a")}`
                                      : ""
                                  }`
                                : "— ready for your review"}
                          </span>
                          {draftSlug ? (
                            <span className="badge info plain">
                              {humanize(draftSlug)} · {pct(aiDraft.confidence)}
                            </span>
                          ) : null}
                          {aiDraft.offersBooking ? (
                            <span className="badge ok plain">Booking link</span>
                          ) : null}
                        </div>

                        <textarea
                          readOnly={!editing || !draftActionable}
                          value={editing ? editText : aiDraft.replyText}
                          onChange={(e) => setEditText(e.target.value)}
                          placeholder={
                            aiDraft.replyText
                              ? undefined
                              : "No draft text was generated — write a reply and use Edit & send."
                          }
                        />

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 10,
                            alignItems: "center",
                          }}
                        >
                          {draftActionable ? (
                            <>
                              {editing ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn primary"
                                    disabled={busy || !editText.trim()}
                                    onClick={() =>
                                      draftAction("edit_send", {
                                        replyText: editText,
                                      })
                                    }
                                  >
                                    {draftBusy === "edit_send" ? (
                                      <Loader2 className="animate-spin" />
                                    ) : null}
                                    Send edited
                                  </button>
                                  <button
                                    type="button"
                                    className="btn"
                                    disabled={busy}
                                    onClick={() => {
                                      setEditing(false);
                                      setEditText(aiDraft.replyText);
                                    }}
                                  >
                                    Cancel edit
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn primary"
                                    disabled={busy || !aiDraft.replyText.trim()}
                                    onClick={() => draftAction("send")}
                                  >
                                    {draftBusy === "send" ? (
                                      <Loader2 className="animate-spin" />
                                    ) : null}
                                    Send
                                  </button>
                                  <button
                                    type="button"
                                    className="btn"
                                    disabled={busy}
                                    onClick={() => {
                                      setEditText(aiDraft.replyText);
                                      setEditing(true);
                                    }}
                                  >
                                    Edit &amp; send
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className="btn"
                                disabled={busy}
                                onClick={() => draftAction("regenerate")}
                              >
                                {draftBusy === "regenerate" ? (
                                  <Loader2 className="animate-spin" />
                                ) : (
                                  <RefreshCw />
                                )}
                                Regenerate
                              </button>
                              <button
                                type="button"
                                className="btn"
                                disabled={busy || editing}
                                title={
                                  editing
                                    ? "Finish or cancel your edit first"
                                    : undefined
                                }
                                onClick={() => draftAction("insert_booking")}
                              >
                                Insert booking link
                              </button>
                              <label className="select">
                                Reclassify:
                                <select
                                  value=""
                                  disabled={busy}
                                  aria-label="Reclassify reply"
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value) {
                                      draftAction("reclassify", { class: value });
                                    }
                                  }}
                                >
                                  <option value="">
                                    {draftSlug ? humanize(draftSlug) : "Choose…"}
                                  </option>
                                  {RECLASSIFY_OPTIONS.filter(
                                    (o) => o !== draftSlug
                                  ).map((o) => (
                                    <option key={o} value={o}>
                                      {humanize(o)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="btn danger"
                            disabled={busy}
                            onClick={() => draftAction("dismiss")}
                          >
                            {draftBusy === "dismiss" ? (
                              <Loader2 className="animate-spin" />
                            ) : null}
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </>
                  ) : legacyDraft ? (
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
                      <textarea readOnly value={legacyDraft.body ?? ""} />
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
