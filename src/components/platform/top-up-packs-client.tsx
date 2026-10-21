"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformPageHeader } from "@/components/platform/ui/page-header";
import { PlatformEmptyState } from "@/components/platform/ui/empty-state";
import { PlatformConfirmDialog } from "@/components/platform/ui/confirm-dialog";
import { formatMoney } from "@/lib/platform/format";

type Pack = {
  id: string;
  name: string;
  credits: number;
  price: string | number;
  currency: string;
  active: boolean;
  archivedAt: string | null;
};

type OrgHit = { id: string; name: string; slug: string };

export function TopUpPacksClient({ canWrite }: { canWrite: boolean }) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [name, setName] = useState("2,000 credits");
  const [credits, setCredits] = useState(2000);
  const [price, setPrice] = useState(99);
  const [grantPackId, setGrantPackId] = useState("");
  const [orgQ, setOrgQ] = useState("");
  const [orgHits, setOrgHits] = useState<OrgHit[]>([]);
  const [orgId, setOrgId] = useState("");
  const [orgLabel, setOrgLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/top-up-packs?includeArchived=1");
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Load failed");
        return;
      }
      setPacks(json.data.packs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!grantOpen || orgQ.trim().length < 2) {
      setOrgHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch("/api/platform/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search_orgs", q: orgQ.trim() }),
      });
      const json = await res.json();
      if (json.success) setOrgHits(json.data.orgs || json.data.organizations || []);
    }, 250);
    return () => clearTimeout(t);
  }, [orgQ, grantOpen]);

  async function create(reason: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/top-up-packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, credits, price, reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Create failed");
      toast.success("Pack created");
      setCreateOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function archive(reason: string) {
    if (!archiveId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/top-up-packs/${archiveId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Archive failed");
      toast.success("Pack archived");
      setArchiveId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    } finally {
      setBusy(false);
    }
  }

  async function grant(reason: string) {
    if (!grantPackId || !orgId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/top-up-packs/${grantPackId}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          reason,
          idempotencyKey: `manual:${orgId}:${grantPackId}:${Date.now()}`,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Grant failed");
      toast.success(
        `Granted ${json.data.pack.credits} credits (balance ${json.data.balanceAfter})`
      );
      setGrantOpen(false);
      setOrgId("");
      setOrgLabel("");
      setOrgQ("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Grant failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Top-up packs"
        description="Create packs and grant credits to a tenant."
        actions={
          canWrite ? (
            <>
              <Button variant="outline" onClick={() => setGrantOpen(true)}>
                Grant pack
              </Button>
              <Button onClick={() => setCreateOpen(true)}>New pack</Button>
            </>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Packs</CardTitle>
          <CardDescription>Active and archived</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : packs.length === 0 ? (
            <PlatformEmptyState title="No top-up packs yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {packs.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.credits.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatMoney(p.price, { currency: p.currency })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.archivedAt ? "outline" : "default"}>
                        {p.archivedAt
                          ? "Archived"
                          : p.active
                            ? "Active"
                            : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canWrite && !p.archivedAt && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setArchiveId(p.id)}
                        >
                          Archive
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create top-up pack</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Credits</Label>
                <Input
                  type="number"
                  value={credits}
                  onChange={(e) => setCredits(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Price (USD)</Label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => void create("Create top-up pack")}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant pack to organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Pack</Label>
              <Select
                value={grantPackId}
                onValueChange={(v) => v && setGrantPackId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pack" />
                </SelectTrigger>
                <SelectContent>
                  {packs
                    .filter((p) => !p.archivedAt && p.active)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.credits})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Input
                placeholder="Search by name…"
                value={orgQ}
                onChange={(e) => setOrgQ(e.target.value)}
              />
              {orgLabel && (
                <p className="text-xs text-muted-foreground">
                  Selected: {orgLabel}
                </p>
              )}
              {orgHits.length > 0 && (
                <div className="max-h-40 overflow-auto rounded border">
                  {orgHits.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setOrgId(o.id);
                        setOrgLabel(`${o.name} (${o.slug})`);
                        setOrgHits([]);
                        setOrgQ(o.name);
                      }}
                    >
                      {o.name}{" "}
                      <span className="text-muted-foreground">/{o.slug}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !grantPackId || !orgId}
              onClick={() => void grant("Manual pack grant")}
            >
              Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlatformConfirmDialog
        open={!!archiveId}
        onOpenChange={(o) => !o && setArchiveId(null)}
        title="Archive this pack?"
        description="Archived packs can no longer be granted or sold."
        requireReason
        destructive
        confirmLabel="Archive"
        busy={busy}
        onConfirm={({ reason }) => archive(reason || "Archive pack")}
      />
    </div>
  );
}
