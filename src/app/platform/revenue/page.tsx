import { appOps } from "@/lib/app-paths";
import Link from "next/link";
import { revenueMetricsService } from "@/services/billing/revenue-metrics.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function money(n: number) {
  return `$${n.toFixed(0)}`;
}

function MetricsBlock({
  title,
  badge,
  data,
}: {
  title: string;
  badge: string;
  data: Awaited<ReturnType<typeof revenueMetricsService.snapshot>>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Badge variant={badge === "LIVE" ? "default" : "secondary"}>
          {badge}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "MRR", value: money(data.mrr) },
          { label: "ARR", value: money(data.arr) },
          { label: "Revenue this month", value: money(data.revenueThisMonth) },
          { label: "Revenue last month", value: money(data.revenueLastMonth) },
          {
            label: "Top-up revenue (mo)",
            value: money(data.topUpRevenueThisMonth),
          },
          { label: "Refunds (mo)", value: money(data.refundsThisMonth) },
          {
            label: "Outstanding invoices",
            value: String(data.outstandingManualInvoices),
          },
          {
            label: "Failed payments",
            value: String(data.failedPaymentsNeedingAttention),
          },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{c.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription counts</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {Object.entries(data.counts).map(([k, v]) => (
              <div key={k} className="rounded border px-2 py-1">
                <div className="text-muted-foreground text-xs">{k}</div>
                <div className="font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">MRR by plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {Object.keys(data.mrrByPlan).length === 0 ? (
              <p className="text-muted-foreground">No active MRR yet</p>
            ) : (
              Object.entries(data.mrrByPlan).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span className="tabular-nums">{money(v)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">MRR by provider</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {Object.entries(data.mrrByProvider).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="tabular-nums">{money(v)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">12-month revenue</CardTitle>
            <CardDescription>From synced transactions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {data.chart12m.map((row) => (
              <div key={row.month} className="flex items-center gap-2">
                <span className="w-16 text-muted-foreground">{row.month}</span>
                <div className="h-2 flex-1 rounded bg-muted">
                  <div
                    className="h-2 rounded bg-primary"
                    style={{
                      width: `${Math.min(100, (row.revenue / Math.max(1, ...data.chart12m.map((x) => x.revenue))) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-16 text-right tabular-nums">
                  {money(row.revenue)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        Trial→paid rate (active / active+trialing):{" "}
        {(data.trialToPaidRate * 100).toFixed(0)}%. Active eligible:{" "}
        {data.activeSubscriptions}. Webhooks needing attention:{" "}
        {data.webhooks.needingAttention} ({data.webhooks.skipped} skipped).
      </p>
    </div>
  );
}

export default async function PlatformRevenuePage() {
  const [live, test] = await Promise.all([
    revenueMetricsService.snapshot("production"),
    revenueMetricsService.snapshot("sandbox"),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Revenue</h2>
          <p className="text-muted-foreground text-sm">
            LIVE metrics primary; sandbox shown separately as Test.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href={appOps("/transactions")} />}>
            Transactions
          </Button>
          <Button variant="outline" size="sm" render={<Link href={appOps("/invoices")} />}>
            Invoices
          </Button>
        </div>
      </div>
      <MetricsBlock title="Live revenue" badge="LIVE" data={live} />
      <MetricsBlock title="Sandbox / Test" badge="Test" data={test} />
    </div>
  );
}
