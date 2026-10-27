"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type CaseStudyRow = {
  id: string;
  clientType: string;
  problem: string;
  whatBuilt: string;
  result: string;
  status: string;
};

const empty = {
  clientType: "",
  problem: "",
  whatBuilt: "",
  result: "",
};

export function CaseStudiesPageClient({
  initialRows,
}: {
  initialRows: CaseStudyRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(empty);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/case-studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setRows([json.data, ...rows]);
      setForm(empty);
      setShow(false);
      toast.success("Case study saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    const res = await fetch(`/api/case-studies/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message || "Failed");
      return;
    }
    setRows(rows.filter((r) => r.id !== id));
    toast.success("Archived");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShow(!show)}>
          <Plus className="mr-1 h-4 w-4" />
          Add case study
        </Button>
      </div>
      {show ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New case study</CardTitle>
            <CardDescription>
              Real numbers only — used in PoW Day 7 when present.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Client type</Label>
              <Input
                value={form.clientType}
                onChange={(e) =>
                  setForm({ ...form, clientType: e.target.value })
                }
                placeholder="Property manager in Dubai"
              />
            </div>
            <div>
              <Label>Problem</Label>
              <Textarea
                value={form.problem}
                onChange={(e) => setForm({ ...form, problem: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>What you built</Label>
              <Textarea
                value={form.whatBuilt}
                onChange={(e) =>
                  setForm({ ...form, whatBuilt: e.target.value })
                }
                rows={2}
              />
            </div>
            <div>
              <Label>Result (real numbers)</Label>
              <Textarea
                value={form.result}
                onChange={(e) => setForm({ ...form, result: e.target.value })}
                rows={2}
              />
            </div>
            <Button disabled={busy} onClick={create}>
              Save
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {rows
          .filter((r) => r.status === "ACTIVE")
          .map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{r.clientType}</CardTitle>
                  <CardDescription className="mt-1">{r.problem}</CardDescription>
                </div>
                <Button size="icon" variant="ghost" onClick={() => archive(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Built: </span>
                  {r.whatBuilt}
                </p>
                <p>
                  <span className="text-muted-foreground">Result: </span>
                  {r.result}
                </p>
              </CardContent>
            </Card>
          ))}
        {rows.filter((r) => r.status === "ACTIVE").length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No case studies yet. Day 7 will skip the case-study line until you add
            one.
          </p>
        ) : null}
      </div>
    </div>
  );
}
