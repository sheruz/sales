"use client";

import { useEffect, useState } from "react";
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

type Pack = {
  id: string;
  name: string;
  credits: number;
  price: string | number;
  currency: string;
  active: boolean;
  archivedAt: string | null;
};

export function TopUpPacksClient({ canWrite }: { canWrite: boolean }) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [name, setName] = useState("2,000 credits");
  const [credits, setCredits] = useState(2000);
  const [price, setPrice] = useState(99);
  const [orgId, setOrgId] = useState("");
  const [grantPackId, setGrantPackId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/platform/top-up-packs?includeArchived=1");
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Load failed");
      return;
    }
    setPacks(json.data.packs);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    const res = await fetch("/api/platform/top-up-packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        credits,
        price,
        reason: reason || "Create top-up pack",
      }),
    });
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Create failed");
      return;
    }
    setMsg("Pack created");
    await load();
  }

  async function archive(id: string) {
    const res = await fetch(`/api/platform/top-up-packs/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || "Archive pack" }),
    });
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Archive failed");
      return;
    }
    await load();
  }

  async function grant() {
    if (!grantPackId || !orgId) return;
    const res = await fetch(
      `/api/platform/top-up-packs/${grantPackId}/grant`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          reason: reason || "Manual pack grant",
          idempotencyKey: `manual:${orgId}:${grantPackId}:${Date.now()}`,
        }),
      }
    );
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Grant failed");
      return;
    }
    setMsg(
      `Granted ${json.data.pack.credits} credits (balance ${json.data.balanceAfter}${
        json.data.alreadyExists ? ", idempotent hit" : ""
      })`
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Top-up packs</h2>
        <p className="text-muted-foreground text-sm">
          Tenants see Contact us until B3. Super Admin can grant manually.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}

      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle>Create pack</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 items-end">
            <Input
              className="w-40"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
            />
            <Input
              className="w-28"
              type="number"
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
            />
            <Input
              className="w-28"
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
            <Input
              className="w-64"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason"
            />
            <Button onClick={() => void create()}>Create</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Packs</CardTitle>
          <CardDescription>Active and archived</CardDescription>
        </CardHeader>
        <CardContent>
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
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.credits}</TableCell>
                  <TableCell>
                    {p.currency} {String(p.price)}
                  </TableCell>
                  <TableCell>
                    {p.archivedAt ? "archived" : p.active ? "active" : "inactive"}
                  </TableCell>
                  <TableCell>
                    {canWrite && !p.archivedAt && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void archive(p.id)}
                      >
                        Archive
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle>Grant pack to tenant</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 items-end">
            <Input
              className="w-72"
              placeholder="Organization UUID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            />
            <select
              className="border rounded-md h-9 px-2 text-sm"
              value={grantPackId}
              onChange={(e) => setGrantPackId(e.target.value)}
            >
              <option value="">Select pack</option>
              {packs
                .filter((p) => !p.archivedAt && p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.credits})
                  </option>
                ))}
            </select>
            <Button onClick={() => void grant()}>Grant pack</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
