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
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/platform/credit-prices");
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Load failed");
      return;
    }
    setPrices(json.data.prices);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(p: Price) {
    const credits = edits[p.id] ?? p.credits;
    const res = await fetch("/api/platform/credit-prices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionType: p.actionType,
        keyMode: p.keyMode,
        credits,
        active: p.active,
        reason: reason || "Update credit price",
      }),
    });
    const json = await res.json();
    if (!json.success) {
      setError(json.error?.message || "Save failed");
      return;
    }
    setMsg(`Updated ${p.actionType}/${p.keyMode}`);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Credit prices</h2>
        <p className="text-muted-foreground text-sm">
          Changes apply to new authorizations only.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {canWrite && (
        <Input
          placeholder="Reason (required for save)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="max-w-md"
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle>Action costs</CardTitle>
          <CardDescription>BYOK vs MANAGED</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">
                    {p.actionType}
                  </TableCell>
                  <TableCell>{p.keyMode}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-24"
                      disabled={!canWrite}
                      value={edits[p.id] ?? p.credits}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [p.id]: Number(e.target.value),
                        }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {canWrite && (
                      <Button size="sm" onClick={() => void save(p)}>
                        Save
                      </Button>
                    )}
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
