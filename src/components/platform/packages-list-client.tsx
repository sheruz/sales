"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { appOps } from "@/lib/app-paths";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function PackagesListClient({ canWrite }: { canWrite: boolean }) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  async function load() {
    const res = await fetch("/api/platform/plans");
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Failed to load");
      return;
    }
    setPlans(json.data.plans);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createPlan() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
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
        setError(json.error?.message || "Create failed");
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Packages</h2>
          <p className="text-muted-foreground text-sm">
            Edit plans as drafts, preview, then publish with an apply mode.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <input
              className="border rounded-md px-3 py-2 text-sm"
              placeholder="New plan name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={() => void createPlan()} disabled={creating}>
              New plan
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
          <CardDescription>
            Current published version and subscriber pins
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
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
                  <TableCell>
                    {p.currentVersion
                      ? `${p.currentVersion.currency} ${p.currentVersion.priceMonthly}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {p.currentVersion
                      ? `${p.currentVersion.currency} ${p.currentVersion.priceYearly}`
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
        </CardContent>
      </Card>
    </div>
  );
}
