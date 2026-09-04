"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AnalyticsPayload {
  dashboard: {
    revenueTarget: number;
    revenueAchieved: number;
    revenueProgress: number | null;
    currency: string;
    pipelineValue: number;
    weightedPipeline: number;
    opportunities: number;
    qualifiedOpportunities: number;
    meetings: number;
    proposals: number;
    dealsWon: number;
    winRate: number;
    averageDealSize: number;
    salesCycleDays: number;
    outreachReplyRate: number;
    funnel: Record<string, number>;
  };
  sources: Array<{
    source: string;
    opportunities: number;
    meetings: number;
    deals: number;
    revenue: number;
    conversion: number;
    averageDealValue: number;
  }>;
  services: Array<{
    serviceName: string;
    opportunities: number;
    meetings: number;
    proposals: number;
    wins: number;
    revenue: number;
  }>;
  conversions: {
    contactTitle: Array<{
      title: string;
      opportunities: number;
      wins: number;
      conversion: number;
    }>;
    offer: Array<{
      offerName: string;
      opportunities: number;
      wins: number;
      conversion: number;
    }>;
    campaign: Array<{
      campaignName: string;
      opportunities: number;
      wins: number;
      conversion: number;
    }>;
  };
}

interface LearningPayload {
  baselineWinRate: number;
  closedDeals: number;
  insights: Array<{
    dimension: string;
    pattern: string;
    confidence: number;
    lift: number;
    recommendation: string;
    requiresApproval: boolean;
  }>;
  guardrail: string;
}

export function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [learning, setLearning] = useState<LearningPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [aRes, lRes] = await Promise.all([
        fetch("/api/analytics"),
        fetch("/api/learning?patterns=1"),
      ]);
      const aJson = await aRes.json();
      const lJson = await lRes.json();
      if (!aJson.success) throw new Error(aJson.error?.message);
      setData(aJson.data);
      if (lJson.success) setLearning(lJson.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading revenue analytics…
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        No analytics available.{" "}
        <Button variant="link" className="px-0" onClick={load}>
          Retry
        </Button>
      </p>
    );
  }

  const d = data.dashboard;
  const fmt = (n: number) => `${d.currency} ${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Target", fmt(d.revenueTarget)],
          ["Achieved", fmt(d.revenueAchieved)],
          ["Pipeline", fmt(d.pipelineValue)],
          ["Weighted", fmt(d.weightedPipeline)],
          ["Win rate", `${d.winRate}%`],
          ["Avg deal", fmt(d.averageDealSize)],
          ["Sales cycle", `${d.salesCycleDays}d`],
          ["Reply rate", `${d.outreachReplyRate}%`],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue funnel</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {Object.entries(d.funnel).map(([k, v]) => (
            <div key={k} className="rounded-md border px-3 py-2">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="text-lg font-semibold">{v}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source analytics</CardTitle>
            <CardDescription>
              Hiring, funding, RFP, web, CRM, imports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No source data yet.</p>
            ) : (
              data.sources.map((s) => (
                <div
                  key={s.source}
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0"
                >
                  <span className="font-medium">{s.source}</span>
                  <span className="text-muted-foreground">
                    {s.opportunities} opps · {s.meetings} mtgs · {s.deals} won ·{" "}
                    {s.conversion}% · avg {fmt(s.averageDealValue)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service analytics</CardTitle>
            <CardDescription>Which services produce revenue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.services.length === 0 ? (
              <p className="text-sm text-muted-foreground">No service attribution yet.</p>
            ) : (
              data.services.map((s) => (
                <div
                  key={s.serviceName}
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0"
                >
                  <span className="font-medium">{s.serviceName}</span>
                  <span className="text-muted-foreground">
                    {s.opportunities} opps · {s.meetings} mtgs · {s.proposals}{" "}
                    props · {s.wins} wins · {fmt(s.revenue)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Title conversion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.conversions.contactTitle.slice(0, 8).map((r) => (
              <div key={r.title} className="flex justify-between gap-2">
                <span className="truncate">{r.title}</span>
                <span>{r.conversion}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offer conversion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.conversions.offer.length === 0 ? (
              <p className="text-muted-foreground">No offer data</p>
            ) : (
              data.conversions.offer.map((r) => (
                <div key={r.offerName} className="flex justify-between gap-2">
                  <span className="truncate">{r.offerName}</span>
                  <span>{r.conversion}%</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign conversion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.conversions.campaign.length === 0 ? (
              <p className="text-muted-foreground">No campaign data</p>
            ) : (
              data.conversions.campaign.map((r) => (
                <div key={r.campaignName} className="flex justify-between gap-2">
                  <span className="truncate">{r.campaignName}</span>
                  <span>{r.conversion}%</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales learning insights</CardTitle>
          <CardDescription>
            {learning?.guardrail ??
              "Patterns recommend and explain — approval required before strategy changes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!learning || learning.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not enough closed-won/lost learning events yet. As deals close,
              patterns will appear here.
              {learning
                ? ` (${learning.closedDeals} closed · baseline win ${learning.baselineWinRate}%)`
                : ""}
            </p>
          ) : (
            learning.insights.map((insight, i) => (
              <div key={i} className="rounded-md border p-3 space-y-1">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{insight.dimension}</Badge>
                  <Badge variant="secondary">{insight.confidence}% conf.</Badge>
                  <Badge>{insight.lift}x lift</Badge>
                  {insight.requiresApproval && (
                    <Badge variant="outline">Requires approval</Badge>
                  )}
                </div>
                <p className="text-sm">{insight.pattern}</p>
                <p className="text-xs text-muted-foreground">
                  {insight.recommendation}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
