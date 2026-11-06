"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { PlatformEmptyState } from "@/components/platform/ui/empty-state";

type EngagementPlan = {
  id: string;
  slug: string;
  name: string;
  priceLabel: string;
  priceUnit: string;
  description: string;
  includes: string[];
  ctaLabel: string;
  ctaHref: string;
  featured: boolean;
  active: boolean;
  sortOrder: number;
};

type StarterOffer = {
  id: string;
  name: string;
  priceLabel: string;
  description: string;
  deliveryDays: number | null;
  href: string | null;
  active: boolean;
  sortOrder: number;
};

const emptyPlan = (): EngagementPlan => ({
  id: "",
  slug: "",
  name: "",
  priceLabel: "From $X",
  priceUnit: "per project",
  description: "",
  includes: [],
  ctaLabel: "Get a quote",
  ctaHref: "/contact?type=quote",
  featured: false,
  active: true,
  sortOrder: 0,
});

const emptyOffer = (): StarterOffer => ({
  id: "",
  name: "",
  priceLabel: "$X",
  description: "",
  deliveryDays: 7,
  href: "/contact?type=starter",
  active: true,
  sortOrder: 0,
});

export function WebsiteAgencyPlansClient({ canWrite }: { canWrite: boolean }) {
  const [plans, setPlans] = useState<EngagementPlan[]>([]);
  const [offers, setOffers] = useState<StarterOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingPlan, setEditingPlan] = useState<EngagementPlan | null>(null);
  const [editingOffer, setEditingOffer] = useState<StarterOffer | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/website-plans");
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Failed to load");
        return;
      }
      setPlans(json.data.engagementPlans);
      setOffers(json.data.starterOffers);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function savePlan() {
    if (!editingPlan || !canWrite) return;
    setBusy(true);
    try {
      const payload = {
        kind: "plan" as const,
        slug: editingPlan.slug || editingPlan.name,
        name: editingPlan.name,
        priceLabel: editingPlan.priceLabel,
        priceUnit: editingPlan.priceUnit,
        description: editingPlan.description,
        includes: editingPlan.includes,
        ctaLabel: editingPlan.ctaLabel,
        ctaHref: editingPlan.ctaHref,
        featured: editingPlan.featured,
        active: editingPlan.active,
        sortOrder: editingPlan.sortOrder,
      };
      const res = await fetch(
        editingPlan.id
          ? `/api/platform/website-plans/${editingPlan.id}`
          : "/api/platform/website-plans",
        {
          method: editingPlan.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Save failed");
        return;
      }
      toast.success(editingPlan.id ? "Plan updated" : "Plan created");
      setEditingPlan(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveOffer() {
    if (!editingOffer || !canWrite) return;
    setBusy(true);
    try {
      const payload = {
        kind: "offer" as const,
        name: editingOffer.name,
        priceLabel: editingOffer.priceLabel,
        description: editingOffer.description,
        deliveryDays: editingOffer.deliveryDays,
        href: editingOffer.href,
        active: editingOffer.active,
        sortOrder: editingOffer.sortOrder,
      };
      const res = await fetch(
        editingOffer.id
          ? `/api/platform/website-plans/${editingOffer.id}`
          : "/api/platform/website-plans",
        {
          method: editingOffer.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Save failed");
        return;
      }
      toast.success(editingOffer.id ? "Offer updated" : "Offer created");
      setEditingOffer(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(kind: "plan" | "offer", id: string) {
    if (!canWrite) return;
    if (!confirm(`Delete this ${kind}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/platform/website-plans/${id}?kind=${kind}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "Delete failed");
        return;
      }
      toast.success("Deleted");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Engagement models</CardTitle>
            <CardDescription>
              Fixed-price / retainer / dedicated — shown on the public{" "}
              <code>/pricing</code> page for the studio website (not SaaS).
            </CardDescription>
          </div>
          {canWrite ? (
            <Button
              size="sm"
              onClick={() => setEditingPlan(emptyPlan())}
              disabled={busy}
            >
              Add plan
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <PlatformEmptyState title="No website plans yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.slug}
                        {p.featured ? " · Most common" : ""}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {p.priceLabel}{" "}
                      <span className="text-muted-foreground">
                        {p.priceUnit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "secondary" : "outline"}>
                        {p.active ? "Active" : "Hidden"}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.sortOrder}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      {canWrite ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingPlan({ ...p })}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove("plan", p.id)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {editingPlan ? (
            <div className="mt-6 space-y-3 rounded-lg border p-4">
              <div className="text-sm font-medium">
                {editingPlan.id ? "Edit plan" : "New plan"}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editingPlan.name}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input
                    value={editingPlan.slug}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, slug: e.target.value })
                    }
                    placeholder="fixed-price"
                  />
                </div>
                <div>
                  <Label>Price label</Label>
                  <Input
                    value={editingPlan.priceLabel}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        priceLabel: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Price unit</Label>
                  <Input
                    value={editingPlan.priceUnit}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        priceUnit: e.target.value,
                      })
                    }
                    placeholder="per project | / month"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editingPlan.description}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        description: e.target.value,
                      })
                    }
                    rows={2}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Includes (one per line)</Label>
                  <Textarea
                    value={editingPlan.includes.join("\n")}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        includes: e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    rows={4}
                  />
                </div>
                <div>
                  <Label>CTA label</Label>
                  <Input
                    value={editingPlan.ctaLabel}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        ctaLabel: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>CTA link</Label>
                  <Input
                    value={editingPlan.ctaHref}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        ctaHref: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={editingPlan.sortOrder}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        sortOrder: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingPlan.featured}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          featured: e.target.checked,
                        })
                      }
                    />
                    Most common
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingPlan.active}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          active: e.target.checked,
                        })
                      }
                    />
                    Active on site
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void savePlan()} disabled={busy}>
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingPlan(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Starter offers</CardTitle>
            <CardDescription>
              Small fixed packages under the engagement models on{" "}
              <code>/pricing</code>.
            </CardDescription>
          </div>
          {canWrite ? (
            <Button
              size="sm"
              onClick={() => setEditingOffer(emptyOffer())}
              disabled={busy}
            >
              Add offer
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <PlatformEmptyState title="No starter offers yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium">{o.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.description}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{o.priceLabel}</TableCell>
                    <TableCell>
                      <Badge variant={o.active ? "secondary" : "outline"}>
                        {o.active ? "Active" : "Hidden"}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {canWrite ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingOffer({ ...o })}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void remove("offer", o.id)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {editingOffer ? (
            <div className="mt-6 space-y-3 rounded-lg border p-4">
              <div className="text-sm font-medium">
                {editingOffer.id ? "Edit offer" : "New offer"}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editingOffer.name}
                    onChange={(e) =>
                      setEditingOffer({ ...editingOffer, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Price label</Label>
                  <Input
                    value={editingOffer.priceLabel}
                    onChange={(e) =>
                      setEditingOffer({
                        ...editingOffer,
                        priceLabel: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editingOffer.description}
                    onChange={(e) =>
                      setEditingOffer({
                        ...editingOffer,
                        description: e.target.value,
                      })
                    }
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Delivery days</Label>
                  <Input
                    type="number"
                    value={editingOffer.deliveryDays ?? ""}
                    onChange={(e) =>
                      setEditingOffer({
                        ...editingOffer,
                        deliveryDays: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Link</Label>
                  <Input
                    value={editingOffer.href ?? ""}
                    onChange={(e) =>
                      setEditingOffer({
                        ...editingOffer,
                        href: e.target.value || null,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    value={editingOffer.sortOrder}
                    onChange={(e) =>
                      setEditingOffer({
                        ...editingOffer,
                        sortOrder: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingOffer.active}
                      onChange={(e) =>
                        setEditingOffer({
                          ...editingOffer,
                          active: e.target.checked,
                        })
                      }
                    />
                    Active on site
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void saveOffer()} disabled={busy}>
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingOffer(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
