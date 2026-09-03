"use client";

import { useState } from "react";
import Link from "next/link";
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

export type ServiceRow = {
  id: string;
  name: string;
  description: string;
  category: string | null;
  status: string;
  idealCustomer: string | null;
  pricingModel: string | null;
  minBudget: number | null;
  maxBudget: number | null;
  currency: string;
  typicalTimeline: string | null;
  problemsSolved: string[];
  technologies: string[];
};

function splitCsv(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const emptyForm = {
  name: "",
  description: "",
  category: "",
  pricingModel: "",
  minBudget: "",
  maxBudget: "",
  currency: "USD",
  typicalTimeline: "",
  idealCustomer: "",
  problemsSolved: "",
  technologies: "",
};

export function ServicesPageClient({
  initialServices,
}: {
  initialServices: ServiceRow[];
}) {
  const router = useRouter();
  const [services, setServices] = useState(initialServices);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function createService() {
    if (!form.name.trim() || !form.description.trim()) {
      toast.error("Name and description are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category || undefined,
          pricingModel: form.pricingModel || undefined,
          minBudget: form.minBudget ? Number(form.minBudget) : null,
          maxBudget: form.maxBudget ? Number(form.maxBudget) : null,
          currency: form.currency || "USD",
          typicalTimeline: form.typicalTimeline || undefined,
          idealCustomer: form.idealCustomer || undefined,
          problemsSolved: splitCsv(form.problemsSolved),
          technologies: splitCsv(form.technologies),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      const created = data.data;
      setServices([
        {
          id: created.id,
          name: created.name,
          description: created.description,
          category: created.category ?? null,
          status: created.status,
          idealCustomer: created.idealCustomer ?? null,
          pricingModel: created.pricingModel ?? null,
          minBudget:
            created.minBudget != null ? Number(created.minBudget) : null,
          maxBudget:
            created.maxBudget != null ? Number(created.maxBudget) : null,
          currency: created.currency ?? "USD",
          typicalTimeline: created.typicalTimeline ?? null,
          problemsSolved: created.problemsSolved ?? [],
          technologies: created.technologies ?? [],
        },
        ...services,
      ]);
      toast.success("Service created");
      setForm(emptyForm);
      setShowForm(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeService(id: string) {
    if (!confirm("Deactivate this service?")) return;
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setServices(services.filter((s) => s.id !== id));
      toast.success("Service removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Settings → Services still works for a quick add.{" "}
          <Link
            href="/dashboard/settings?tab=services"
            className="underline underline-offset-2"
          >
            Open quick add
          </Link>
        </p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Add service
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New service</CardTitle>
            <CardDescription>
              Full catalog fields for pricing and ideal customers.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Pricing model</Label>
              <Input
                value={form.pricingModel}
                onChange={(e) =>
                  setForm({ ...form, pricingModel: e.target.value })
                }
                placeholder="Fixed, Retainer…"
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>
            <div>
              <Label>Min budget</Label>
              <Input
                type="number"
                value={form.minBudget}
                onChange={(e) =>
                  setForm({ ...form, minBudget: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Max budget</Label>
              <Input
                type="number"
                value={form.maxBudget}
                onChange={(e) =>
                  setForm({ ...form, maxBudget: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Typical timeline</Label>
              <Input
                value={form.typicalTimeline}
                onChange={(e) =>
                  setForm({ ...form, typicalTimeline: e.target.value })
                }
                placeholder="4–8 weeks"
              />
            </div>
            <div>
              <Label>Ideal customer</Label>
              <Input
                value={form.idealCustomer}
                onChange={(e) =>
                  setForm({ ...form, idealCustomer: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <Label>Problems solved (comma-separated)</Label>
              <Input
                value={form.problemsSolved}
                onChange={(e) =>
                  setForm({ ...form, problemsSolved: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <Label>Technologies (comma-separated)</Label>
              <Input
                value={form.technologies}
                onChange={(e) =>
                  setForm({ ...form, technologies: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <Button onClick={createService} disabled={submitting}>
                {submitting ? "Creating…" : "Create service"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No services yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ideal customer</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div className="font-medium">{service.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {service.description}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {service.category ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          service.status === "ACTIVE" ? "default" : "secondary"
                        }
                      >
                        {service.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {service.idealCustomer ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeService(service.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
