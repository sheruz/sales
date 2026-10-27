"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { STARTER_FINDING_TYPES } from "@/lib/pow/constants";

export type StarterOfferRow = {
  id: string;
  name: string;
  price: number;
  currency: string;
  deliveryDays: number;
  includes: string;
  findingTypes: string[];
  status: string;
};

const emptyForm = {
  name: "",
  price: "",
  currency: "USD",
  deliveryDays: "5",
  includes: "",
  findingTypes: [] as string[],
};

export function StarterOffersPageClient({
  initialOffers,
}: {
  initialOffers: StarterOfferRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialOffers);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function toggleType(t: string) {
    setForm((f) => ({
      ...f,
      findingTypes: f.findingTypes.includes(t)
        ? f.findingTypes.filter((x) => x !== t)
        : [...f.findingTypes, t],
    }));
  }

  async function createOffer() {
    if (!form.name.trim() || !form.includes.trim() || !form.findingTypes.length) {
      toast.error("Name, includes, and at least one finding type required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/starter-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          price: Number(form.price),
          currency: form.currency || "USD",
          deliveryDays: Number(form.deliveryDays),
          includes: form.includes.trim(),
          findingTypes: form.findingTypes,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      const o = json.data;
      setRows([
        {
          id: o.id,
          name: o.name,
          price: Number(o.price),
          currency: o.currency,
          deliveryDays: o.deliveryDays,
          includes: o.includes,
          findingTypes: o.findingTypes,
          status: o.status,
        },
        ...rows,
      ]);
      setForm(emptyForm);
      setShowForm(false);
      toast.success("Starter offer created");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function archive(id: string) {
    try {
      const res = await fetch(`/api/starter-offers/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setRows(rows.filter((r) => r.id !== id));
      toast.success("Archived");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" />
          Add starter offer
        </Button>
      </div>

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New starter offer</CardTitle>
            <CardDescription>
              Fixed-price package matched to deep-audit finding types (PoW Day 7).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Website fix + speed-up"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Price</Label>
                  <Input
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    type="number"
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Days</Label>
                  <Input
                    value={form.deliveryDays}
                    onChange={(e) =>
                      setForm({ ...form, deliveryDays: e.target.value })
                    }
                    type="number"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label>What&apos;s included</Label>
              <Textarea
                value={form.includes}
                onChange={(e) => setForm({ ...form, includes: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Fixes finding types</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {STARTER_FINDING_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`text-xs rounded-md border px-2 py-1 ${
                      form.findingTypes.includes(t)
                        ? "bg-primary text-primary-foreground"
                        : "bg-background"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Button disabled={submitting} onClick={createOffer}>
              Save
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Fixes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows
                .filter((r) => r.status === "ACTIVE")
                .map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {r.includes}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.currency} {r.price}
                    </TableCell>
                    <TableCell>{r.deliveryDays}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.findingTypes.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => archive(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          {rows.filter((r) => r.status === "ACTIVE").length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No starter offers yet. Add packages your Day 7 email can offer.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
