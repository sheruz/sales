"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type IcpRow = {
  id: string;
  name: string;
  description: string | null;
  industries: string[];
  countries: string[];
  regions: string[];
  companySizes: string[];
  jobSignals: string[];
  buyingSignals: string[];
  decisionMakerTitles: string[];
  exclusions: string[];
  priority: number;
  status: string;
};

function splitCsv(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinCsv(values: string[]) {
  return values.join(", ");
}

type FormState = {
  name: string;
  description: string;
  industries: string;
  countries: string;
  regions: string;
  companySizes: string;
  jobSignals: string;
  buyingSignals: string;
  decisionMakerTitles: string;
  exclusions: string;
  priority: string;
  status: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  industries: "",
  countries: "",
  regions: "",
  companySizes: "",
  jobSignals: "",
  buyingSignals: "",
  decisionMakerTitles: "",
  exclusions: "",
  priority: "0",
  status: "ACTIVE",
};

function toForm(icp: IcpRow): FormState {
  return {
    name: icp.name,
    description: icp.description ?? "",
    industries: joinCsv(icp.industries),
    countries: joinCsv(icp.countries),
    regions: joinCsv(icp.regions),
    companySizes: joinCsv(icp.companySizes),
    jobSignals: joinCsv(icp.jobSignals),
    buyingSignals: joinCsv(icp.buyingSignals),
    decisionMakerTitles: joinCsv(icp.decisionMakerTitles),
    exclusions: joinCsv(icp.exclusions),
    priority: String(icp.priority),
    status: icp.status,
  };
}

function toPayload(form: FormState) {
  return {
    name: form.name.trim(),
    description: form.description || null,
    industries: splitCsv(form.industries),
    countries: splitCsv(form.countries),
    regions: splitCsv(form.regions),
    companySizes: splitCsv(form.companySizes),
    jobSignals: splitCsv(form.jobSignals),
    buyingSignals: splitCsv(form.buyingSignals),
    decisionMakerTitles: splitCsv(form.decisionMakerTitles),
    exclusions: splitCsv(form.exclusions),
    priority: Number(form.priority) || 0,
    status: form.status,
  };
}

export function IcpPageClient({ initialIcps }: { initialIcps: IcpRow[] }) {
  const router = useRouter();
  const [icps, setIcps] = useState(initialIcps);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(icp: IcpRow) {
    setEditingId(icp.id);
    setForm(toForm(icp));
    setShowForm(true);
  }

  async function saveIcp() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = toPayload(form);
      const res = await fetch(
        editingId ? `/api/icps/${editingId}` : "/api/icps",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      const row = data.data as IcpRow;
      if (editingId) {
        setIcps(icps.map((i) => (i.id === editingId ? { ...i, ...row } : i)));
      } else {
        setIcps([{ ...row }, ...icps]);
      }
      toast.success(editingId ? "ICP updated" : "ICP created");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivateIcp(id: string) {
    if (!confirm("Deactivate this ICP?")) return;
    try {
      const res = await fetch(`/api/icps/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setIcps(
        icps.map((i) =>
          i.id === id ? { ...i, status: "INACTIVE" } : i
        )
      );
      toast.success("ICP deactivated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add ICP
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Edit ICP" : "New ICP"}
            </CardTitle>
            <CardDescription>
              Use comma-separated lists for multi-value fields.
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
              <Label>Priority</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Industries</Label>
              <Input
                value={form.industries}
                onChange={(e) =>
                  setForm({ ...form, industries: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Countries</Label>
              <Input
                value={form.countries}
                onChange={(e) =>
                  setForm({ ...form, countries: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Regions</Label>
              <Input
                value={form.regions}
                onChange={(e) => setForm({ ...form, regions: e.target.value })}
              />
            </div>
            <div>
              <Label>Company sizes</Label>
              <Input
                value={form.companySizes}
                onChange={(e) =>
                  setForm({ ...form, companySizes: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Job signals</Label>
              <Input
                value={form.jobSignals}
                onChange={(e) =>
                  setForm({ ...form, jobSignals: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Buying signals</Label>
              <Input
                value={form.buyingSignals}
                onChange={(e) =>
                  setForm({ ...form, buyingSignals: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Decision maker titles</Label>
              <Input
                value={form.decisionMakerTitles}
                onChange={(e) =>
                  setForm({ ...form, decisionMakerTitles: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Exclusions</Label>
              <Input
                value={form.exclusions}
                onChange={(e) =>
                  setForm({ ...form, exclusions: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => v && setForm({ ...form, status: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">DRAFT</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={saveIcp} disabled={submitting}>
                {submitting ? "Saving…" : editingId ? "Update ICP" : "Create ICP"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ICPs</CardTitle>
        </CardHeader>
        <CardContent>
          {icps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ICPs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Focus</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {icps.map((icp) => (
                  <TableRow key={icp.id}>
                    <TableCell>
                      <div className="font-medium">{icp.name}</div>
                      {icp.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {icp.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{icp.priority}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          icp.status === "ACTIVE" ? "default" : "secondary"
                        }
                      >
                        {icp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {[...icp.industries, ...icp.regions]
                        .slice(0, 4)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(icp)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {icp.status !== "INACTIVE" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deactivateIcp(icp.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
