import { appHome } from "@/lib/app-paths";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";
import { sourcingJobService } from "@/services/sourcing-job.service";
import { enrichmentJobService } from "@/services/enrichment-job.service";
import { websiteAuditService } from "@/services/website-audit.service";
import { outboundJobService } from "@/services/outbound-job.service";
import { cronTickService } from "@/services/cron-tick.service";
import { autopilotOverviewService } from "@/services/autopilot-overview.service";
import { aiReplyService } from "@/services/ai-reply.service";
import { aiReplyConfigService } from "@/services/ai-reply-config.service";
import { RepliesPanel } from "@/components/autopilot/replies-panel";
import { SourcingPanel } from "@/components/autopilot/sourcing-panel";
import { EnrichmentPanel } from "@/components/autopilot/enrichment-panel";
import { AuditPanel } from "@/components/autopilot/audit-panel";
import {
  AutopilotMasterButtons,
  StageToggle,
} from "@/components/autopilot/autopilot-controls";

const SETUP_HREFS: Record<string, string> = {
  ai: appHome("/settings?tab=integrations"),
  places: appHome("/settings?tab=integrations"),
  pagespeed: appHome("/settings?tab=integrations"),
  hunter: appHome("/settings?tab=integrations"),
  icp: appHome("/icp"),
  services: appHome("/services"),
  cron: appHome("/autopilot"),
  outbound_compliance: appHome("/outreach?tab=outbound"),
  inboxes: appHome("/outreach?tab=outbound"),
};

function formatAgo(date: Date): string {
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function usd(n: number) {
  return `$${n.toFixed(2)}`;
}

export default async function AutopilotPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.organizationId) redirect(appHome());

  const canSourcing = hasAnyOrgPermission(user, [
    "integrations.manage",
    "campaigns.manage",
    "business_brain.manage",
  ]);

  if (!canSourcing) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Autopilot</h1>
            <p className="page-sub">
              Ask an admin for integrations.manage, campaigns.manage, or
              business_brain.manage.
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body muted">No permission.</div>
        </div>
      </div>
    );
  }

  const params = await searchParams;

  if (params.tab === "pitch" || params.tab === "pitches") {
    redirect(appHome("/outreach?tab=pitch"));
  }
  if (params.tab === "outbound") {
    redirect(appHome("/outreach?tab=mailboxes"));
  }

  const tab =
    params.tab === "enrichment"
      ? "enrichment"
      : params.tab === "sourcing"
        ? "sourcing"
        : params.tab === "audit"
          ? "audit"
          : params.tab === "replies"
            ? "replies"
            : "overview";

  let data;
  let enrichment;
  let audit;
  let outbound;
  let lastTick;
  let overview;
  let schemaError: string | null = null;
  try {
    [data, enrichment, audit, outbound, lastTick, overview] =
      await Promise.all([
        sourcingJobService.dashboard(user.organizationId),
        enrichmentJobService.dashboard(user.organizationId, user.id),
        websiteAuditService.dashboard(user.organizationId),
        outboundJobService.dashboard(user.organizationId),
        cronTickService.lastTick(),
        autopilotOverviewService.get(user.organizationId, user.id),
      ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[autopilot] dashboard load failed", msg);
    schemaError = msg;
  }

  if (schemaError || !data || !enrichment || !audit || !outbound || !overview) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Autopilot</h1>
            <p className="page-sub">Could not load Autopilot.</p>
          </div>
        </div>
        <div className="banner">
          <AlertTriangle />
          <div className="t">
            <b>Database schema is behind this deploy.</b>{" "}
            <span className="muted">
              Phase 4 outbound tables may be missing. On the server (after
              pg_dump):
            </span>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <pre className="muted" style={{ overflowX: "auto", fontSize: 12 }}>
              {`cd /var/www/html/sales
DRY_RUN=1 npm run db:migrate:phase4-outbound
npm run db:migrate:phase4-outbound
pm2 restart all`}
            </pre>
            <p className="muted mt" style={{ wordBreak: "break-all" }}>
              {schemaError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const lastCronRun = lastTick
    ? {
        startedAt: lastTick.startedAt.toISOString(),
        finishedAt: lastTick.finishedAt?.toISOString() ?? null,
        ok: lastTick.ok,
        skipped: lastTick.skipped,
        skipReason: lastTick.skipReason,
        stale: cronTickService.isStale(lastTick),
      }
    : null;

  // Replies tab data is loaded only when needed and never blocks the other tabs.
  let replies:
    | (Awaited<ReturnType<typeof aiReplyService.dashboard>> & {
        config: Awaited<ReturnType<typeof aiReplyConfigService.getConfig>>;
      })
    | null = null;
  let repliesError: string | null = null;
  if (tab === "replies") {
    try {
      const [dash, cfg] = await Promise.all([
        aiReplyService.dashboard(user.organizationId),
        aiReplyConfigService.getConfig(user.organizationId),
      ]);
      replies = { ...dash, config: cfg };
    } catch (err) {
      repliesError = err instanceof Error ? err.message : String(err);
      console.error("[autopilot] replies dashboard failed", repliesError);
    }
  }

  const toggles = overview.toggles;
  const anyRunning =
    toggles.sourcing ||
    toggles.enrichment ||
    toggles.audit ||
    toggles.outbound;
  const testMode = outbound.config.shadowMode !== false;
  const cronBad = !lastCronRun || lastCronRun.stale;

  const activeSearches = data.queries.filter(
    (q) => q.status === "ACTIVE"
  ).length;
  const activeMailboxes = outbound.mailboxes.length;

  const setup = overview.checklist.filter((c) => !c.comingSoon);
  const setupDone = setup.filter((c) => c.done).length;

  const health = overview.health;
  const healthBad = cronBad;
  const healthWarn = health.errorsLast24h > 0;

  const tabs: {
    key: string;
    label: string;
    href: string;
    count?: number;
  }[] = [
    { key: "overview", label: "Overview", href: appHome("/autopilot") },
    {
      key: "sourcing",
      label: "Sourcing",
      href: appHome("/autopilot?tab=sourcing"),
    },
    {
      key: "enrichment",
      label: "Enrichment",
      href: appHome("/autopilot?tab=enrichment"),
    },
    { key: "audit", label: "Audit", href: appHome("/autopilot?tab=audit") },
    {
      key: "replies",
      label: "Replies",
      href: appHome("/autopilot?tab=replies"),
    },
    {
      key: "pitch",
      label: "Pitch review",
      href: appHome("/outreach?tab=pitch"),
      count: audit.draftPitches,
    },
    {
      key: "outbound",
      label: "Outbound",
      href: appHome("/outreach?tab=outbound"),
    },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Autopilot</h1>
          <p className="page-sub">
            Finds businesses, writes pitches and emails them while you&apos;re
            away.
          </p>
        </div>
        <div className="page-actions">
          <AutopilotMasterButtons
            running={anyRunning}
            settingsHref={appHome("/autopilot")}
          />
        </div>
      </div>

      {testMode ? (
        <div className="banner">
          <AlertTriangle />
          <div className="t">
            <b>Sending is in test mode.</b>{" "}
            <span className="muted">
              Emails are queued but not delivered until you turn off shadow
              mode.
            </span>
          </div>
          <Link href={appHome("/outreach?tab=outbound")} className="btn">
            Go live
          </Link>
        </div>
      ) : null}

      {cronBad ? (
        <div className="banner">
          <AlertTriangle />
          <div className="t">
            <b>Cron warning.</b>{" "}
            <span className="muted">
              Last run is missing or older than 15 minutes. Set up{" "}
              <code>scripts/cron-tick.sh</code> on the server.
            </span>
          </div>
        </div>
      ) : null}

      <div className="tabs">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`tab${t.key === tab ? " active" : ""}`}
          >
            {t.label}
            {t.count ? <span className="n">{t.count}</span> : null}
          </Link>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Pipeline steps</div>
                <div className="card-sub">
                  Each step runs on its own every 5 minutes within your daily
                  limits
                </div>
              </div>
            </div>

            <div className="stage-row">
              <div className="stage-num">1</div>
              <div className="stage-info">
                <div className="stage-name">Find businesses</div>
                <div className="cell-sub">
                  Google Maps · {activeSearches} active{" "}
                  {activeSearches === 1 ? "search" : "searches"} ·{" "}
                  {data.pendingCrawls} awaiting crawl
                </div>
              </div>
              <div className="stat-inline hide-sm">
                <b>{data.companiesToday}</b> today / {data.config.companiesPerDay}
              </div>
              <StageToggle
                stage="sourcing"
                enabled={toggles.sourcing}
                label="Find businesses"
              />
            </div>

            <div className="stage-row">
              <div className="stage-num">2</div>
              <div className="stage-info">
                <div className="stage-name">Find decision-maker</div>
                <div className="cell-sub">
                  Hunter ·{" "}
                  {enrichment.creditsRemaining != null
                    ? `${enrichment.creditsRemaining} credits left`
                    : "credits unavailable"}{" "}
                  · {enrichment.pending} waiting
                </div>
              </div>
              <div className="stat-inline hide-sm">
                <b>{enrichment.enrichedToday}</b> today /{" "}
                {enrichment.dailyCreditLimit} credits
              </div>
              <StageToggle
                stage="enrichment"
                enabled={toggles.enrichment}
                label="Find decision-maker"
              />
            </div>

            <div className="stage-row">
              <div className="stage-num">3</div>
              <div className="stage-info">
                <div className="stage-name">Audit website &amp; write pitch</div>
                <div className="cell-sub">
                  PageSpeed + AI · {audit.draftPitches}{" "}
                  {audit.draftPitches === 1 ? "pitch needs" : "pitches need"}{" "}
                  your approval
                </div>
              </div>
              <div className="stat-inline hide-sm">
                <b>{audit.auditedToday}</b> today / {audit.config.dailyLimit}
              </div>
              <StageToggle
                stage="audit"
                enabled={toggles.audit}
                label="Audit website and write pitch"
              />
            </div>

            <div className="stage-row">
              <div className="stage-num">4</div>
              <div className="stage-info">
                <div className="stage-name">Send emails</div>
                <div className="cell-sub">
                  {activeMailboxes} {activeMailboxes === 1 ? "inbox" : "inboxes"}{" "}
                  · {outbound.queued} queued · {outbound.held} held
                  {testMode ? " · test mode" : ""}
                </div>
              </div>
              <div className="stat-inline hide-sm">
                <b>{outbound.sentToday}</b> today / {outbound.globalCap}
              </div>
              <StageToggle
                stage="outbound"
                enabled={toggles.outbound}
                label="Send emails"
              />
            </div>

            <div className="stage-row">
              <div className="stage-num">5</div>
              <div className="stage-info">
                <div className="stage-name">Answer replies &amp; book calls</div>
                <div className="cell-sub">
                  Replies land in your inbox; pricing and contract questions
                  are handed to you
                </div>
              </div>
              <div className="stat-inline hide-sm">
                <b>
                  {overview.funnel.find((f) => f.key === "replied")?.count ?? 0}
                </b>{" "}
                replied
              </div>
              <Link href={appHome("/conversations")} className="btn">
                Open inbox
              </Link>
            </div>
          </div>

          <div className="grid g2 mt">
            <div className="card">
              <div className="card-head">
                <div className="card-title">Health</div>
                <span
                  className={`badge ${
                    healthBad ? "bad" : healthWarn ? "warn" : "ok"
                  }`}
                  style={{ marginLeft: "auto" }}
                >
                  {healthBad
                    ? "Cron not running"
                    : healthWarn
                      ? "Errors"
                      : "All good"}
                </span>
              </div>
              <table>
                <tbody>
                  <tr>
                    <td className="muted">Last run</td>
                    <td style={{ textAlign: "right" }}>
                      {health.lastCronRun
                        ? formatAgo(
                            new Date(
                              health.lastCronRun.finishedAt ||
                                health.lastCronRun.startedAt
                            )
                          )
                        : "Never"}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">Google spend today</td>
                    <td style={{ textAlign: "right" }}>
                      {usd(health.googleSpendTodayUsd)}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">AI spend today</td>
                    <td style={{ textAlign: "right" }}>
                      {usd(audit.costs.claudeTodayUsd)}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">Hunter credits left</td>
                    <td style={{ textAlign: "right" }}>
                      {health.hunterCreditsRemaining ?? "\u2014"}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">Errors (24h)</td>
                    <td style={{ textAlign: "right" }}>
                      {health.errorsLast24h}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-head">
                <div className="card-title">Setup</div>
                <span className="card-sub" style={{ marginLeft: "auto" }}>
                  {setupDone} of {setup.length} done
                </span>
              </div>
              <table>
                <tbody>
                  {setup.map((item) => (
                    <tr key={item.key}>
                      <td>
                        <span
                          className={`badge ${item.done ? "ok" : "warn"} plain`}
                        >
                          {item.done ? "\u2713" : "!"}
                        </span>
                        &nbsp; {item.label}
                        {!item.done ? (
                          <Link
                            href={SETUP_HREFS[item.key] ?? appHome("/settings")}
                            className="muted"
                            style={{ float: "right" }}
                          >
                            Fix &rarr;
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {tab === "sourcing" ? (
        <SourcingPanel
          initial={{
            config: data.config,
            companiesToday: data.companiesToday,
            pendingCrawls: data.pendingCrawls,
            costs: data.costs,
            recentErrors: data.recentErrors,
            lastCronRun,
            queries: data.queries.map((q) => ({
              id: q.id,
              query: q.query,
              country: q.country,
              city: q.city,
              status: q.status,
              lastRunAt: q.lastRunAt?.toISOString() ?? null,
              resultsCount: q.resultsCount,
              pageToken: q.pageToken,
              lastError: q.lastError,
            })),
          }}
        />
      ) : null}

      {tab === "enrichment" ? (
        <EnrichmentPanel
          initial={{
            ...enrichment,
            lastCronRun,
          }}
        />
      ) : null}

      {tab === "replies" ? (
        replies ? (
          <RepliesPanel
            initial={{
              timezone: replies.timezone,
              today: replies.today,
              open: {
                ...replies.open,
                oldestHeldAt: replies.open.oldestHeldAt?.toISOString() ?? null,
              },
              config: replies.config,
            }}
          />
        ) : (
          <div className="card">
            <div className="card-body muted">
              Could not load the reply agent.
              {repliesError ? (
                <p className="mt" style={{ wordBreak: "break-all" }}>
                  {repliesError}
                </p>
              ) : null}
            </div>
          </div>
        )
      ) : null}

      {tab === "audit" ? (
        <AuditPanel
          initial={{
            ...audit,
            lastCronRun,
          }}
        />
      ) : null}
    </div>
  );
}
