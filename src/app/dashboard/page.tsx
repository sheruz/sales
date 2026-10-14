import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MessageDirection,
  RevenueStatus,
  MeetingOutcome,
  InboxConversationStatus,
  PitchStatus,
  TaskStatus,
} from "@prisma/client";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Mail,
  MessageSquareReply,
  Search,
  Sparkles,
  Building2,
  type LucideIcon,
} from "lucide-react";
import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserReadiness } from "@/lib/integrations/readiness";
import { hasAnyOrgPermission, hasOrgPermission } from "@/lib/tenant/scope";
import { analyticsService } from "@/services/analytics.service";
import { autopilotOverviewService } from "@/services/autopilot-overview.service";

type FeedTone = "ok" | "brand" | "warn" | "";

type FeedEvent = {
  at: Date;
  icon: LucideIcon;
  tone: FeedTone;
  label: string;
  strong: string;
  suffix?: string;
};

async function safe<T, F>(
  promise: Promise<T>,
  fallback: F
): Promise<T | F> {
  try {
    return await promise;
  } catch (err) {
    console.error(
      "[dashboard] home query failed",
      err instanceof Error ? err.message : String(err)
    );
    return fallback;
  }
}

function timeAgo(date: Date): string {
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = user.organizationId;

  const canOpps = hasOrgPermission(user, "opportunities.view");
  const canInbox = hasOrgPermission(user, "conversations.view");
  const canTasks = hasAnyOrgPermission(user, [
    "leads.view",
    "opportunities.view",
  ]);

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const empty = <T,>(v: T): Promise<T> => Promise.resolve(v);

  const [
    readiness,
    metrics,
    overview,
    monthRevenue,
    emailsSent,
    meetingsThisWeek,
    companiesFound24h,
    needsAction,
    needsActionCount,
    draftPitches,
    meetingsToday,
    tasksDue,
    sentMessages,
    inboundMessages,
    recentMeetings,
    recentCompanies,
    recentAudits,
  ] = await Promise.all([
    orgId
      ? safe(getUserReadiness(orgId, user.id), null)
      : empty(null),
    orgId
      ? safe(analyticsService.getRevenueDashboard(orgId), null)
      : empty(null),
    orgId
      ? safe(autopilotOverviewService.get(orgId, user.id), null)
      : empty(null),
    orgId
      ? safe(
          prisma.revenue.aggregate({
            where: {
              organizationId: orgId,
              status: RevenueStatus.RECOGNIZED,
              recognizedAt: { gte: startOfMonth },
            },
            _sum: { amount: true },
          }),
          null
        )
      : empty(null),
    orgId
      ? safe(
          prisma.message.count({
            where: {
              organizationId: orgId,
              direction: MessageDirection.OUTBOUND,
            },
          }),
          0
        )
      : empty(0),
    orgId
      ? safe(
          prisma.meeting.count({
            where: { organizationId: orgId, createdAt: { gte: weekAgo } },
          }),
          0
        )
      : empty(0),
    orgId
      ? safe(
          prisma.company.count({
            where: {
              organizationId: orgId,
              deletedAt: null,
              createdAt: { gte: dayAgo },
            },
          }),
          0
        )
      : empty(0),
    orgId && canInbox
      ? safe(
          prisma.inboxConversation.findMany({
            where: {
              organizationId: orgId,
              status: InboxConversationStatus.NEEDS_ACTION,
            },
            orderBy: { lastMessageAt: "desc" },
            take: 3,
            select: {
              id: true,
              subject: true,
              intent: true,
              company: { select: { name: true } },
              contact: { select: { fullName: true } },
            },
          }),
          []
        )
      : empty([]),
    orgId && canInbox
      ? safe(
          prisma.inboxConversation.count({
            where: {
              organizationId: orgId,
              status: InboxConversationStatus.NEEDS_ACTION,
            },
          }),
          0
        )
      : empty(0),
    orgId
      ? safe(
          prisma.pitch.count({
            where: { organizationId: orgId, status: PitchStatus.DRAFT },
          }),
          0
        )
      : empty(0),
    orgId
      ? safe(
          prisma.meeting.findMany({
            where: {
              organizationId: orgId,
              outcome: MeetingOutcome.SCHEDULED,
              date: { gte: startOfDay, lte: endOfDay },
            },
            orderBy: { date: "asc" },
            take: 3,
            select: {
              id: true,
              title: true,
              date: true,
              location: true,
              meetingLink: true,
            },
          }),
          []
        )
      : empty([]),
    orgId && canTasks
      ? safe(
          prisma.task.findMany({
            where: {
              organizationId: orgId,
              status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
              dueDate: { not: null, lte: endOfDay },
              OR: [{ assignedToId: user.id }, { assignedToId: null }],
            },
            orderBy: { dueDate: "asc" },
            take: 3,
            select: { id: true, title: true, dueDate: true },
          }),
          []
        )
      : empty([]),
    orgId
      ? safe(
          prisma.message.findMany({
            where: {
              organizationId: orgId,
              direction: MessageDirection.OUTBOUND,
              sentAt: { not: null },
            },
            orderBy: { sentAt: "desc" },
            take: 4,
            select: {
              sentAt: true,
              toEmail: true,
              conversation: {
                select: {
                  company: { select: { name: true } },
                  contact: { select: { fullName: true } },
                },
              },
            },
          }),
          []
        )
      : empty([]),
    orgId
      ? safe(
          prisma.message.findMany({
            where: {
              organizationId: orgId,
              direction: MessageDirection.INBOUND,
            },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              createdAt: true,
              receivedAt: true,
              fromEmail: true,
              conversation: {
                select: {
                  company: { select: { name: true } },
                  contact: { select: { fullName: true } },
                },
              },
            },
          }),
          []
        )
      : empty([]),
    orgId
      ? safe(
          prisma.meeting.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { createdAt: true, title: true },
          }),
          []
        )
      : empty([]),
    orgId
      ? safe(
          prisma.company.findMany({
            where: { organizationId: orgId, deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { createdAt: true, name: true },
          }),
          []
        )
      : empty([]),
    orgId
      ? safe(
          prisma.websiteAudit.findMany({
            where: { organizationId: orgId, status: "DONE" },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { createdAt: true, company: { select: { name: true } } },
          }),
          []
        )
      : empty([]),
  ]);

  const currency = metrics?.currency ?? "USD";
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${currency} ${Math.round(n).toLocaleString()}`;
    }
  };

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const incomplete = readiness?.steps.find((s) => !s.done) ?? null;
  const primaryCta = incomplete
    ? { href: incomplete.href, label: incomplete.label }
    : canInbox
      ? { href: "/dashboard/conversations", label: "Review inbox" }
      : canOpps
        ? { href: "/dashboard/opportunities", label: "Work opportunities" }
        : { href: "/dashboard/autopilot", label: "Open Autopilot" };

  // ── Subtitle ──
  const subtitleParts: string[] = [];
  if (needsActionCount > 0) {
    subtitleParts.push(
      `${plural(needsActionCount, "reply", "replies")} ${
        needsActionCount === 1 ? "needs" : "need"
      } you`
    );
  }
  if (meetingsToday.length > 0) {
    subtitleParts.push(`${plural(meetingsToday.length, "meeting")} today`);
  }
  if (companiesFound24h > 0) {
    subtitleParts.push(
      `Autopilot found ${plural(companiesFound24h, "new company", "new companies")}`
    );
  }
  const subtitle =
    subtitleParts.length > 0
      ? subtitleParts.join(" · ")
      : "Nothing needs you right now.";

  // ── KPIs ──
  const monthRevenueValue = Number(monthRevenue?._sum.amount ?? 0);
  const revenueTarget = metrics?.revenueTarget ?? 0;
  const revenueProgress = metrics?.revenueProgress ?? null;
  const progressWidth = Math.max(0, Math.min(100, revenueProgress ?? 0));

  // ── Funnel ──
  const overviewFunnel = new Map(
    (overview?.funnel ?? []).map((s) => [s.key, s])
  );
  const mf = metrics?.funnel;
  const funnelSteps: { label: string; value: number; href: string }[] = [
    {
      label: "Found",
      value: overviewFunnel.get("found")?.count ?? 0,
      href: "/dashboard/companies",
    },
    {
      label: "Enriched",
      value: overviewFunnel.get("enriched")?.count ?? 0,
      href: "/dashboard/companies?funnel=enriched",
    },
    {
      label: "Audited",
      value: overviewFunnel.get("audited")?.count ?? 0,
      href: "/dashboard/companies?funnel=audited",
    },
    {
      label: "Contacted",
      value: mf?.Contacted ?? 0,
      href: "/dashboard/opportunities?filter=contacted",
    },
    {
      label: "Replied",
      value: mf?.Replied ?? 0,
      href: "/dashboard/opportunities?filter=replied",
    },
    {
      label: "Positive",
      value: mf?.Positive ?? 0,
      href: "/dashboard/opportunities?filter=positive",
    },
    {
      label: "Meeting",
      value: mf?.Meeting ?? 0,
      href: "/dashboard/opportunities?filter=meeting",
    },
    {
      label: "Proposal",
      value: mf?.Proposal ?? 0,
      href: "/dashboard/proposals",
    },
    {
      label: "Won",
      value: mf?.Won ?? 0,
      href: "/dashboard/opportunities?filter=won",
    },
  ];

  // ── Live activity ──
  const events: FeedEvent[] = [];
  for (const m of sentMessages) {
    if (!m.sentAt) continue;
    const who =
      m.conversation.contact?.fullName ??
      m.conversation.company?.name ??
      m.toEmail ??
      "a contact";
    events.push({
      at: m.sentAt,
      icon: Mail,
      tone: "brand",
      label: "Email sent to ",
      strong: who,
    });
  }
  for (const m of inboundMessages) {
    const who =
      m.conversation.contact?.fullName ??
      m.conversation.company?.name ??
      m.fromEmail ??
      "a contact";
    events.push({
      at: m.receivedAt ?? m.createdAt,
      icon: MessageSquareReply,
      tone: "ok",
      label: "Reply from ",
      strong: who,
    });
  }
  for (const m of recentMeetings) {
    events.push({
      at: m.createdAt,
      icon: CheckCircle2,
      tone: "ok",
      label: "Meeting booked: ",
      strong: m.title,
    });
  }
  for (const c of recentCompanies) {
    events.push({
      at: c.createdAt,
      icon: Search,
      tone: "",
      label: "Found ",
      strong: c.name,
    });
  }
  for (const a of recentAudits) {
    events.push({
      at: a.createdAt,
      icon: Sparkles,
      tone: "",
      label: "Audited ",
      strong: a.company.name,
    });
  }
  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  const feed = events.slice(0, 6);

  const hasNeeds =
    needsAction.length > 0 ||
    draftPitches > 0 ||
    meetingsToday.length > 0 ||
    tasksDue.length > 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            {greeting}, {user.firstName}
          </h1>
          <p className="page-sub">{subtitle}</p>
        </div>
        <div className="page-actions">
          <Link href={primaryCta.href} className="btn primary">
            {primaryCta.label}
          </Link>
        </div>
      </div>

      {readiness && readiness.percentComplete < 100 && incomplete ? (
        <div className="banner">
          <AlertTriangle />
          <div className="t">
            <b>Setup {readiness.percentComplete}% complete.</b>{" "}
            <span className="muted">Next: {incomplete.label}</span>
          </div>
          <Link href={incomplete.href} className="btn">
            Continue
          </Link>
        </div>
      ) : null}

      <div className="grid g4">
        <Link href="/dashboard/revenue-goals" className="card kpi block">
          <div className="kpi-label">Revenue this month</div>
          <div className="kpi-value">{fmt(monthRevenueValue)}</div>
          <div className="progress">
            <span style={{ width: `${progressWidth}%` }} />
          </div>
          <div className="kpi-delta muted">
            {revenueTarget > 0 && revenueProgress != null
              ? `${Math.round(revenueProgress)}% of ${fmt(revenueTarget)} goal`
              : "No active revenue goal"}
          </div>
        </Link>
        <Link href="/dashboard/pipeline" className="card kpi block">
          <div className="kpi-label">Open pipeline</div>
          <div className="kpi-value">{fmt(metrics?.pipelineValue ?? 0)}</div>
          <div className="kpi-delta muted">
            {metrics
              ? `Weighted ${fmt(metrics.weightedPipeline)}`
              : "No pipeline data yet"}
          </div>
        </Link>
        <Link href="/dashboard/meetings" className="card kpi block">
          <div className="kpi-label">Meetings booked</div>
          <div className="kpi-value">{metrics?.meetings ?? 0}</div>
          <div
            className={`kpi-delta${meetingsThisWeek > 0 ? "" : " muted"}`}
          >
            {meetingsThisWeek > 0
              ? `+${meetingsThisWeek} this week`
              : "None this week"}
          </div>
        </Link>
        <Link href="/dashboard/conversations" className="card kpi block">
          <div className="kpi-label">Reply rate</div>
          <div className="kpi-value">
            {(metrics?.outreachReplyRate ?? 0).toFixed(1)}%
          </div>
          <div className="kpi-delta muted">
            {emailsSent.toLocaleString()} emails sent
          </div>
        </Link>
      </div>

      <div className="mt">
        <div className="funnel">
          {funnelSteps.map((step, i) => {
            const prev = i === 0 ? 0 : funnelSteps[i - 1].value;
            const pct =
              i === 0
                ? step.value > 0
                  ? 100
                  : 0
                : prev > 0
                  ? Math.min(100, Math.round((step.value / prev) * 100))
                  : 0;
            const rate =
              i === 0 ? "companies" : prev > 0 ? `${pct}%` : "\u2014";
            return (
              <Link key={step.label} href={step.href} className="f-step">
                <div className="l">{step.label}</div>
                <div className="v">{step.value.toLocaleString()}</div>
                <div className="r">{rate}</div>
                <span className="bar" style={{ width: `${pct}%` }} />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid g21 mt">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Needs you</div>
              <div className="card-sub">Things the AI handed over</div>
            </div>
          </div>

          {needsAction.map((c) => {
            const who = c.contact?.fullName ?? c.company?.name ?? "A contact";
            return (
              <div className="task" key={c.id}>
                <div className="feed-icon brand">
                  <MessageSquareReply />
                </div>
                <div className="task-text">
                  <div className="task-title">
                    {who}
                    {c.subject ? `: ${c.subject}` : " replied"}
                  </div>
                  <div className="cell-sub">
                    {c.intent
                      ? `Hand-off: ${c.intent.replace(/_/g, " ")}`
                      : "Waiting for your reply"}
                  </div>
                </div>
                <Link
                  href="/dashboard/conversations"
                  className="btn primary"
                >
                  Review
                </Link>
              </div>
            );
          })}

          {draftPitches > 0 ? (
            <div className="task">
              <div className="feed-icon warn">
                <Sparkles />
              </div>
              <div className="task-text">
                <div className="task-title">
                  {plural(draftPitches, "pitch", "pitches")} waiting for
                  approval
                </div>
                <div className="cell-sub">
                  Approve to start sending in the next window
                </div>
              </div>
              <Link href="/dashboard/outreach?tab=pitch" className="btn">
                Review
              </Link>
            </div>
          ) : null}

          {meetingsToday.map((m) => (
            <div className="task" key={m.id}>
              <div className="feed-icon">
                <CalendarClock />
              </div>
              <div className="task-text">
                <div className="task-title">
                  {m.title} ·{" "}
                  {m.date.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                <div className="cell-sub">
                  {m.location ?? (m.meetingLink ? "Online" : "Today")}
                </div>
              </div>
              <Link href="/dashboard/meetings" className="btn">
                Prep
              </Link>
            </div>
          ))}

          {tasksDue.map((t) => (
            <div className="task" key={t.id}>
              <div className="feed-icon">
                <CheckSquare />
              </div>
              <div className="task-text">
                <div className="task-title">{t.title}</div>
                <div className="cell-sub">
                  Due{" "}
                  {t.dueDate
                    ? t.dueDate.getTime() < startOfDay.getTime()
                      ? "overdue"
                      : "today"
                    : ""}
                </div>
              </div>
              <Link href="/dashboard/tasks" className="btn">
                Open
              </Link>
            </div>
          ))}

          {!hasNeeds ? (
            <div className="task">
              <div className="feed-icon ok">
                <CheckCircle2 />
              </div>
              <div className="task-text">
                <div className="task-title">You&apos;re all caught up</div>
                <div className="cell-sub">
                  Replies, pitches, meetings and tasks that need you will show
                  up here.
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Live activity</div>
            <span className="live" style={{ marginLeft: "auto" }}>
              <span className="dot" />
              Live
            </span>
          </div>
          {feed.length === 0 ? (
            <div className="feed-item">
              <div className="feed-icon">
                <Building2 />
              </div>
              <div className="feed-text muted">
                No activity yet. Autopilot events will appear here.
              </div>
            </div>
          ) : (
            feed.map((e, i) => (
              <div className="feed-item" key={`${e.strong}-${i}`}>
                <div className={`feed-icon ${e.tone}`.trim()}>
                  <e.icon />
                </div>
                <div className="feed-text">
                  {e.label}
                  <b>{e.strong}</b>
                  {e.suffix ?? ""}
                </div>
                <div className="feed-time">{timeAgo(e.at)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
