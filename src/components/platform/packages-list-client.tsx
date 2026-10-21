"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { appOps } from "@/lib/app-paths";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformPageHeader } from "@/components/platform/ui/page-header";
import { PlatformEmptyState } from "@/components/platform/ui/empty-state";
import { formatMoney } from "@/lib/platform/format";

type PlanRow = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  visibility: string;
  mostPopular: boolean;
  subscriberCount: number;
  currentVersion: {
    version: number;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    subscriberCount: number;
  } | null;
  draft: { id: string; editorRevision: number; version: number } | null;
};

type TabKey = "PUBLIC" | "INTERNAL" | "ARCHIVED";

export function PackagesListClient({ canWrite }: { canWrite: boolean }) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [tab, setTab] = useState<TabKey>("PUBLIC");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/plans");
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Failed to load");
        return;
      }
      setPlans(json.data.plans);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      if (tab === "ARCHIVED") return p.status === "ARCHIVED";
      if (p.status === "ARCHIVED") return false;
      if (tab === "INTERNAL") return p.visibility === "INTERNAL";
      return p.visibility === "PUBLIC" || p.visibility === "UNASSIGNED";
    });
  }, [plans, tab]);

  async function createPlan() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/platform/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          reason: "Created from Packages UI",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Create failed");
        return;
      }
      setName("");
      window.location.href = appOps(`/packages/${json.data.plan.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Packages"
        description="Edit plans as drafts, preview, then publish."
        actions={
          canWrite ? (
            <div className="flex gap-2">
              <Input
                className="w-48"
                placeholder="New plan name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button onClick={() => void createPlan()} disabled={creating}>
                New plan
              </Button>
            </div>
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => v && setTab(v as TabKey)}
      >
        <TabsList>
          <TabsTrigger value="PUBLIC">Public</TabsTrigger>
          <TabsTrigger value="INTERNAL">Internal</TabsTrigger>
          <TabsTrigger value="ARCHIVED">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>
            {tab === "PUBLIC"
              ? "Public plans"
              : tab === "INTERNAL"
                ? "Internal plans"
                : "Archived plans"}
          </CardTitle>
          <CardDescription>
            Current published version and subscriber pins
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <PlatformEmptyState title="No plans in this tab" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Subscribers</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Yearly</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {p.code || "—"}
                        {p.mostPopular ? " · popular" : ""}
                        {p.draft ? " · has draft" : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.status}</Badge>
                    </TableCell>
                    <TableCell>{p.visibility}</TableCell>
                    <TableCell>
                      {p.currentVersion ? `v${p.currentVersion.version}` : "—"}
                    </TableCell>
                    <TableCell>
                      {p.currentVersion?.subscriberCount ?? p.subscriberCount}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {p.currentVersion
                        ? formatMoney(p.currentVersion.priceMonthly, {
                            currency: p.currentVersion.currency,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {p.currentVersion
                        ? formatMoney(p.currentVersion.priceYearly, {
                            currency: p.currentVersion.currency,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={appOps(`/packages/${p.id}`)}
                        className="text-sm underline"
                      >
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
