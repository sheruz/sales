import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { PitchStatus } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission, hasOrgPermission } from "@/lib/tenant/scope";
import { outboundJobService } from "@/services/outbound-job.service";
import { outreachSequenceService } from "@/services/outreach-sequence.service";
import { websiteAuditService } from "@/services/website-audit.service";
import { mailboxPoolService } from "@/services/mailbox-pool.service";
import { cronTickService } from "@/services/cron-tick.service";
import { PitchReviewPanel } from "@/components/autopilot/pitch-review-panel";
import { OutboundPanel } from "@/components/autopilot/outbound-panel";

type OutreachTab = "pitch" | "sequences" | "scheduled" | "sent" | "mailboxes";

const TAB_KEYS: OutreachTab[] = [
  "pitch",
  "sequences",
  "scheduled",
  "sent",
  "mailboxes",
];

function resolveTab(raw: string | undefined): OutreachTab {
  if (raw === "pitches") return "pitch";
  if (raw === "outbound") return "mailboxes";
  return TAB_KEYS.includes(raw as OutreachTab) ? (raw as OutreachTab) : "pitch";
}

function fmt(d: Date | null | undefined, pattern = "MMM d, h:mm a") {
  return d ? format(d, pattern) : "—";
}

async function safeCount(fn: () => Promise<number>): Promise<number | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

type PitchDrafts = Awaited<
  ReturnType<typeof websiteAuditService.listDraftPitches>
>;
type Sequences = Awaited<ReturnType<typeof outreachSequenceService.list>>;
type OutboxRows = Awaited<ReturnType<typeof outboundJobService.listOutbox>>;
type OutboundDash = Awaited<ReturnType<typeof outboundJobService.dashboard>>;
type AvailableAccounts = Awaited<
  ReturnType<typeof mailboxPoolService.listAvailableAccounts>
>;

type TabData =
  | { tab: "pitch"; drafts: PitchDrafts }
  | { tab: "sequences"; sequences: Sequences }
  | { tab: "scheduled" | "sent"; rows: OutboxRows }
  | {
      tab: "mailboxes";
      outbound: OutboundDash;
      availableAccounts: AvailableAccounts;
      lastCronRun: {
        startedAt: string;
        finishedAt: string | null;
        ok: boolean;
        skipped: boolean;
        skipReason: string | null;
        stale: boolean;
      } | null;
    };

async function fetchTabData(
  organizationId: string,
  activeTab: OutreachTab
): Promise<{ data: TabData | null; error: string | null }> {
  try {
    if (activeTab === "pitch") {
      const drafts =
        await websiteAuditService.listDraftPitches(organizationId);
      return { data: { tab: "pitch", drafts }, error: null };
    }
    if (activeTab === "sequences") {
      const sequences = await outreachSequenceService.list(organizationId);
      return { data: { tab: "sequences", sequences }, error: null };
    }
    if (activeTab === "scheduled" || activeTab === "sent") {
      const rows = await outboundJobService.listOutbox(
        organizationId,
        activeTab
      );
      return { data: { tab: activeTab, rows }, error: null };
    }
    const [outbound, availableAccounts, lastTick] = await Promise.all([
      outboundJobService.dashboard(organizationId),
      mailboxPoolService.listAvailableAccounts(organizationId),
      cronTickService.lastTick(),
    ]);
    return {
      data: {
        tab: "mailboxes",
        outbound,
        availableAccounts,
        lastCronRun: lastTick
          ? {
              startedAt: lastTick.startedAt.toISOString(),
              finishedAt: lastTick.finishedAt?.toISOString() ?? null,
              ok: lastTick.ok,
              skipped: lastTick.skipped,
              skipReason: lastTick.skipReason,
              stale: cronTickService.isStale(lastTick),
            }
          : null,
      },
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[outreach] load failed", msg);
    return { data: null, error: msg };
  }
}

function renderTab(
  data: TabData,
  canManageSequences: boolean
): React.ReactNode {
  if (data.tab === "pitch") {
    return (
      <PitchReviewPanel
        initial={{
          pitches: data.drafts.map((p) => ({
            id: p.id,
            personalizedFirstLine: p.personalizedFirstLine,
            shortPitch: p.shortPitch,
            topIssue: p.topIssue,
            recommendedService: p.recommendedService,
            confidence: p.confidence,
            company: p.company,
            contact: p.contact,
            findings: p.websiteAudit.findings,
            pageSpeedMobile: p.websiteAudit.pageSpeedMobile,
          })),
        }}
      />
    );
  }

  if (data.tab === "sequences") {
    return (
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sequence</th>
              <th>Status</th>
              <th>Steps</th>
              <th>Enrolled</th>
            </tr>
          </thead>
          <tbody>
            {data.sequences.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="muted"
                  style={{ textAlign: "center", padding: 32 }}
                >
                  No sequences yet.
                  {canManageSequences ? (
                    <>
                      {" "}
                      <Link
                        href="/dashboard/sequences/new"
                        className="cell-main"
                      >
                        Create one
                      </Link>
                    </>
                  ) : null}
                </td>
              </tr>
            ) : (
              data.sequences.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/dashboard/sequences/${s.id}`}
                      className="cell-main"
                    >
                      {s.name}
                    </Link>
                    {s.description ? (
                      <div className="cell-sub">{s.description}</div>
                    ) : null}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        s.status === "ACTIVE"
                          ? "ok"
                          : s.status === "PAUSED"
                            ? "warn"
                            : ""
                      }`.trim()}
                    >
                      {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td>{s.steps.length}</td>
                  <td>{s._count.enrollments}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.tab === "scheduled" || data.tab === "sent") {
    const isSent = data.tab === "sent";
    return (
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Subject</th>
              <th>Status</th>
              <th className="hide-sm">From</th>
              <th>{isSent ? "Sent" : "Scheduled for"}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="muted"
                  style={{ textAlign: "center", padding: 32 }}
                >
                  {isSent
                    ? "Nothing sent yet."
                    : "Nothing scheduled. Approved pitches are queued here for the next send window."}
                </td>
              </tr>
            ) : (
              data.rows.map((r) => {
                const tone =
                  r.status === "SENT"
                    ? "ok"
                    : r.status === "FAILED"
                      ? "bad"
                      : r.status === "HELD"
                        ? "warn"
                        : "info";
                const label =
                  r.status === "SENT" && r.shadowMode
                    ? "Shadow sent"
                    : r.status === "HELD"
                      ? "Held"
                      : r.status.charAt(0) + r.status.slice(1).toLowerCase();
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="cell-main">
                        {r.company ? (
                          <Link href={`/dashboard/companies/${r.company.id}`}>
                            {r.company.name}
                          </Link>
                        ) : (
                          r.contact.fullName
                        )}
                      </div>
                      <div className="cell-sub">{r.toEmail}</div>
                    </td>
                    <td>
                      <div>{r.subject}</div>
                      <div className="cell-sub">
                        Step {r.stepOrder}
                        {r.heldReason
                          ? ` · ${r.heldReason.replace(/_/g, " ")}`
                          : ""}
                        {r.lastError ? ` · ${r.lastError}` : ""}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${tone}`}>{label}</span>
                    </td>
                    <td className="hide-sm muted">{r.emailAccount.email}</td>
                    <td className="muted">
                      {isSent
                        ? fmt(r.sentAt ?? r.createdAt)
                        : fmt(r.scheduledFor)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mailbox</th>
              <th>Status</th>
              <th>Sent today</th>
              <th className="hide-sm">Bounce rate</th>
            </tr>
          </thead>
          <tbody>
            {data.outbound.mailboxes.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="muted"
                  style={{ textAlign: "center", padding: 32 }}
                >
                  No mailboxes in the sending pool yet. Add one below, or
                  connect an account in{" "}
                  <Link
                    href="/dashboard/settings?tab=integrations"
                    className="cell-main"
                  >
                    Settings
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              data.outbound.mailboxes.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="cell-main">{m.emailAccount.email}</div>
                    <div className="cell-sub">{m.emailAccount.provider}</div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        m.status === "ACTIVE"
                          ? "ok"
                          : m.status === "PAUSED"
                            ? "warn"
                            : "bad"
                      }`}
                    >
                      {m.status.charAt(0) + m.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td>
                    {m.sentToday} / {m.effectiveLimit}
                  </td>
                  <td className="hide-sm muted">
                    {(m.bounceRate * 100).toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <OutboundPanel
        initial={{
          ...data.outbound,
          availableAccounts: data.availableAccounts,
          lastCronRun: data.lastCronRun,
        }}
      />
    </div>
  );
}

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.organizationId) redirect("/dashboard");
  const organizationId = user.organizationId;

  const canSequences = hasAnyOrgPermission(user, [
    "sequences.view",
    "sequences.manage",
  ]);
  const canOutbound = hasAnyOrgPermission(user, [
    "integrations.manage",
    "campaigns.manage",
    "business_brain.manage",
  ]);
  if (!canSequences && !canOutbound) redirect("/dashboard");
  const canManageSequences = hasOrgPermission(user, "sequences.manage");

  const params = await searchParams;
  const tab = resolveTab(params.tab);

  const [pitchCount, sequenceCount, scheduledCount] = await Promise.all([
    canOutbound
      ? safeCount(() =>
          prisma.pitch.count({
            where: { organizationId, status: PitchStatus.DRAFT },
          })
        )
      : Promise.resolve(null),
    canSequences
      ? safeCount(() =>
          prisma.outreachSequence.count({ where: { organizationId } })
        )
      : Promise.resolve(null),
    canOutbound
      ? safeCount(() =>
          prisma.emailOutbox.count({
            where: { organizationId, status: { in: ["QUEUED", "HELD"] } },
          })
        )
      : Promise.resolve(null),
  ]);

  const tabs: Array<{
    key: OutreachTab;
    label: string;
    count: number | null;
    show: boolean;
  }> = [
    { key: "pitch", label: "Pitch review", count: pitchCount, show: canOutbound },
    {
      key: "sequences",
      label: "Sequences",
      count: sequenceCount,
      show: canSequences,
    },
    {
      key: "scheduled",
      label: "Scheduled",
      count: scheduledCount,
      show: canOutbound,
    },
    { key: "sent", label: "Sent", count: null, show: canOutbound },
    { key: "mailboxes", label: "Mailboxes", count: null, show: canOutbound },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const activeTab = visibleTabs.some((t) => t.key === tab)
    ? tab
    : (visibleTabs[0]?.key ?? "sequences");

  const { data, error } = await fetchTabData(organizationId, activeTab);

  return (
    <div className="dx">
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Outreach</h1>
            <p className="page-sub">What gets sent, to whom, and when.</p>
          </div>
          {canManageSequences ? (
            <div className="page-actions">
              <Link href="/dashboard/sequences/new" className="btn primary">
                <Plus />
                New sequence
              </Link>
            </div>
          ) : null}
        </div>

        <div className="tabs">
          {visibleTabs.map((t) => (
            <Link
              key={t.key}
              href={`/dashboard/outreach?tab=${t.key}`}
              className={`tab${t.key === activeTab ? " active" : ""}`}
            >
              {t.label}
              {t.count != null ? <span className="n">{t.count}</span> : null}
            </Link>
          ))}
        </div>

        {error || !data ? (
          <div className="banner">
            <div className="t">
              <div className="cell-main">Failed to load outreach data.</div>
              <div className="cell-sub" style={{ wordBreak: "break-all" }}>
                {error ?? "Unknown error"}
              </div>
            </div>
          </div>
        ) : (
          renderTab(data, canManageSequences)
        )}
      </div>
    </div>
  );
}
