"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformPageHeader } from "@/components/platform/ui/page-header";
import { PlatformEmptyState } from "@/components/platform/ui/empty-state";
import { PlatformConfirmDialog } from "@/components/platform/ui/confirm-dialog";
import { creditActionLabel } from "@/lib/platform/action-labels";

type Price = {
  id: string;
  actionType: string;
  keyMode: "BYOK" | "MANAGED";
  credits: number;
  active: boolean;
};

export function CreditPricesClient({ canWrite }: { canWrite: boolean }) {
  const [prices, setPrices] = useState<Price[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/credit-prices");
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Load failed");
        return;
      }
      setPrices(json.data.prices);
      setEdits({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const dirty = useMemo(() => {
    return prices.filter((p) => {
      const next = edits[p.id];
      return next != null && next !== p.credits;
    });
  }, [prices, edits]);

  async function saveAll(reason: string) {
    setBusy(true);
    try {
      for (const p of dirty) {
        const credits = edits[p.id] ?? p.credits;
        const res = await fetch("/api/platform/credit-prices", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionType: p.actionType,
            keyMode: p.keyMode,
            credits,
            active: p.active,
            reason,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error?.message || "Save failed");
        }
      }
      toast.success(`Saved ${dirty.length} price${dirty.length === 1 ? "" : "s"}`);
      setConfirmOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Credit prices"
        description="Changes apply to new authorizations only."
        actions={
          canWrite ? (
            <Button
              disabled={dirty.length === 0}
              onClick={() => setConfirmOpen(true)}
            >
              Save all{dirty.length ? ` (${dirty.length})` : ""}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Action costs</CardTitle>
          <CardDescription>BYOK vs managed key pricing</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : prices.length === 0 ? (
            <PlatformEmptyState title="No credit prices configured" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.map((p) => {
                  const val = edits[p.id] ?? p.credits;
                  const isDirty = edits[p.id] != null && edits[p.id] !== p.credits;
                  return (
                    <TableRow
                      key={p.id}
                      className={isDirty ? "bg-amber-500/5" : undefined}
                    >
                      <TableCell>
                        <div className="font-medium">
                          {creditActionLabel(p.actionType)}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {p.actionType}
                        </div>
                      </TableCell>
                      <TableCell>{p.keyMode}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-24"
                          disabled={!canWrite}
                          value={val}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [p.id]: Number(e.target.value),
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PlatformConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save credit price changes"
        description={
          dirty.length
            ? dirty
                .map((p) => {
                  const next = edits[p.id] ?? p.credits;
                  return `${creditActionLabel(p.actionType)} (${p.keyMode}): ${p.credits} → ${next}`;
                })
                .join(" · ")
            : undefined
        }
        requireReason
        confirmLabel="Save changes"
        busy={busy}
        onConfirm={({ reason }) => saveAll(reason || "Update credit prices")}
      />
    </div>
  );
}
