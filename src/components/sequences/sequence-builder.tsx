"use client";
import { appHome } from "@/lib/app-paths";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type BuilderStep = {
  key: string;
  stepOrder: number;
  delayMinutes: number;
  channel: "EMAIL" | "LINKEDIN" | "WHATSAPP";
  subjectTemplate: string;
  bodyTemplate: string;
  emailStyle: "BRANDED" | "PLAIN";
  isActive: boolean;
};

type SequenceBuilderProps = {
  sequenceId?: string;
  initial?: {
    name: string;
    description: string | null;
    status: string;
    stopOnReply: boolean;
    stopOnMeeting: boolean;
    stopOnUnsubscribe: boolean;
    steps: {
      stepOrder: number;
      delayMinutes: number;
      channel: string;
      subjectTemplate: string | null;
      bodyTemplate: string;
      emailStyle?: string;
      isActive: boolean;
    }[];
  };
  canManage: boolean;
};

function newStep(order: number, key?: string): BuilderStep {
  return {
    key: key ?? `draft-step-${order}`,
    stepOrder: order,
    delayMinutes: order === 0 ? 0 : 60 * 24 * 2,
    channel: "EMAIL",
    subjectTemplate: "",
    bodyTemplate: "",
    emailStyle: order <= 1 ? "BRANDED" : "PLAIN",
    isActive: true,
  };
}

function statusVariant(status: string) {
  if (status === "ACTIVE") return "default" as const;
  if (status === "DRAFT") return "secondary" as const;
  if (status === "PAUSED") return "outline" as const;
  return "secondary" as const;
}

export function SequenceBuilder({
  sequenceId,
  initial,
  canManage,
}: SequenceBuilderProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState(initial?.status ?? "DRAFT");
  const [steps, setSteps] = useState<BuilderStep[]>(() =>
    initial?.steps?.length
      ? initial.steps.map((s, i) => ({
          key: `s-${i}-${s.stepOrder}`,
          stepOrder: s.stepOrder,
          delayMinutes: s.delayMinutes,
          channel:
            s.channel === "EMAIL" ||
            s.channel === "LINKEDIN" ||
            s.channel === "WHATSAPP"
              ? s.channel
              : "EMAIL",
          subjectTemplate: s.subjectTemplate ?? "",
          bodyTemplate: s.bodyTemplate,
          emailStyle: s.emailStyle === "BRANDED" ? "BRANDED" : "PLAIN",
          isActive: s.isActive,
        }))
      : [newStep(0)]
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(!sequenceId);

  const markDirty = useCallback(() => setDirty(true), []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!name.trim()) errors.push("Sequence name is required");
    if (!steps.length) errors.push("Add at least one step");
    steps.forEach((s, i) => {
      if (!s.bodyTemplate.trim()) {
        errors.push(`Step ${i + 1}: email body is required`);
      }
      if (s.channel !== "EMAIL") {
        errors.push(
          `Step ${i + 1}: ${s.channel} is not executable yet (email only)`
        );
      }
    });
    return errors;
  }, [name, steps]);

  function renumber(next: BuilderStep[]) {
    return next.map((s, i) => ({ ...s, stepOrder: i }));
  }

  function updateStep(key: string, patch: Partial<BuilderStep>) {
    setSteps((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s))
    );
    markDirty();
  }

  function addStep() {
    setSteps((prev) =>
      renumber([
        ...prev,
        newStep(prev.length, `draft-step-${prev.length}-${Date.now()}`),
      ])
    );
    markDirty();
  }

  function removeStep(key: string) {
    if (steps.length <= 1) {
      toast.error("Keep at least one step");
      return;
    }
    if (!window.confirm("Delete this step?")) return;
    setSteps((prev) => renumber(prev.filter((s) => s.key !== key)));
    markDirty();
  }

  function moveStep(key: string, dir: -1 | 1) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = tmp;
      return renumber(copy);
    });
    markDirty();
  }

  async function persist(nextStatus?: string) {
    if (!canManage) return;
    if (status === "ARCHIVED" && nextStatus !== "DRAFT" && nextStatus !== "ACTIVE" && nextStatus !== "PAUSED") {
      toast.error("Restore an archived sequence before editing content");
      return;
    }
    if (validationErrors.length && nextStatus === "ACTIVE") {
      toast.error(validationErrors[0]);
      return;
    }
    if (!name.trim()) {
      toast.error("Sequence name is required");
      return;
    }

    setSaving(true);
    try {
      const targetStatus =
        nextStatus ??
        (status === "ARCHIVED" ? "ARCHIVED" : status === "ACTIVE" ? "ACTIVE" : status);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        status: targetStatus,
        steps: steps.map((s) => ({
          stepOrder: s.stepOrder,
          delayMinutes: Math.max(0, Number(s.delayMinutes) || 0),
          channel: s.channel,
          subjectTemplate: s.subjectTemplate || null,
          bodyTemplate: s.bodyTemplate,
          emailStyle: s.emailStyle,
          isActive: s.isActive,
        })),
      };

      const res = await fetch(
        sequenceId ? `/api/sequences/${sequenceId}` : "/api/sequences",
        {
          method: sequenceId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Save failed");

      const saved = json.data;
      setStatus(saved.status);
      setDirty(false);
      toast.success(
        nextStatus === "ACTIVE"
          ? "Sequence activated"
          : sequenceId
            ? "Draft saved"
            : "Sequence created"
      );

      if (saved.editSafety?.openEnrollments > 0 && payload.steps) {
        toast.message(
          `Running enrollments (${saved.editSafety.openEnrollments}) keep their step snapshot — only new enrollments use these edits.`
        );
      }

      if (!sequenceId && saved.id) {
        router.push(appHome(`/sequences/${saved.id}`));
        router.refresh();
        return;
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setLifecycle(next: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DRAFT") {
    if (!canManage || !sequenceId) return;
    if (next === "ARCHIVED" && !window.confirm("Archive this sequence?")) {
      return;
    }
    if (next === "ACTIVE") {
      await persist("ACTIVE");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Update failed");
      setStatus(json.data.status);
      toast.success(`Sequence ${next.toLowerCase()}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const readOnly = !canManage;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
              placeholder="Sequence name"
              className="max-w-md text-lg font-semibold"
              disabled={readOnly || saving}
              aria-label="Sequence name"
            />
            <Badge variant={statusVariant(status)}>{status}</Badge>
            {dirty ? (
              <span className="text-xs text-amber-600">Unsaved changes</span>
            ) : null}
          </div>
          <Textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              markDirty();
            }}
            placeholder="Description (optional)"
            rows={2}
            className="max-w-2xl"
            disabled={readOnly || saving}
          />
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={saving || !dirty || status === "ARCHIVED"}
              onClick={() => persist()}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
            {status !== "ACTIVE" ? (
              <Button disabled={saving} onClick={() => setLifecycle("ACTIVE")}>
                Activate
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => setLifecycle("PAUSED")}
              >
                Pause
              </Button>
            )}
            {status === "PAUSED" ? (
              <Button disabled={saving} onClick={() => setLifecycle("ACTIVE")}>
                Resume
              </Button>
            ) : null}
            {status !== "ARCHIVED" ? (
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => setLifecycle("ARCHIVED")}
              >
                Archive
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">View only</p>
        )}
      </div>

      {validationErrors.length > 0 && canManage ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {validationErrors.slice(0, 3).map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.key} className="relative">
            <Card className="transition-shadow hover:shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    Step {index + 1}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      Email
                    </span>
                  </CardTitle>
                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={saving || index === 0}
                        onClick={() => moveStep(step.key, -1)}
                        aria-label="Move step up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={saving || index === steps.length - 1}
                        onClick={() => moveStep(step.key, 1)}
                        aria-label="Move step down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => removeStep(step.key)}
                        aria-label="Delete step"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`delay-${step.key}`}>Wait (days)</Label>
                    <Input
                      id={`delay-${step.key}`}
                      type="number"
                      min={0}
                      step={1}
                      value={Math.round(step.delayMinutes / (60 * 24))}
                      onChange={(e) =>
                        updateStep(step.key, {
                          delayMinutes:
                            Math.max(0, Number(e.target.value) || 0) *
                            60 *
                            24,
                        })
                      }
                      disabled={readOnly || saving}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {step.delayMinutes === 0
                        ? "Send immediately when due"
                        : `Delay ${step.delayMinutes} minutes from previous`}
                    </p>
                  </div>
                  <div>
                    <Label>Channel</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge>EMAIL</Badge>
                      {step.channel !== "EMAIL" ? (
                        <span className="text-xs text-muted-foreground">
                          Unsupported — will be skipped at runtime
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="space-y-1">
                    <Label>Email style</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          step.emailStyle === "BRANDED" ? "default" : "outline"
                        }
                        disabled={readOnly || saving}
                        onClick={() =>
                          updateStep(step.key, { emailStyle: "BRANDED" })
                        }
                      >
                        BRANDED
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          step.emailStyle === "PLAIN" ? "default" : "outline"
                        }
                        disabled={readOnly || saving}
                        onClick={() =>
                          updateStep(step.key, { emailStyle: "PLAIN" })
                        }
                      >
                        PLAIN
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor={`subject-${step.key}`}>Subject</Label>
                  <Input
                    id={`subject-${step.key}`}
                    value={step.subjectTemplate}
                    onChange={(e) =>
                      updateStep(step.key, {
                        subjectTemplate: e.target.value,
                      })
                    }
                    placeholder="Following up with {{company.name}}"
                    disabled={readOnly || saving}
                  />
                </div>
                <div>
                  <Label htmlFor={`body-${step.key}`}>Message</Label>
                  <Textarea
                    id={`body-${step.key}`}
                    value={step.bodyTemplate}
                    onChange={(e) =>
                      updateStep(step.key, { bodyTemplate: e.target.value })
                    }
                    rows={6}
                    placeholder="Hi {{contact.firstName}}, …"
                    disabled={readOnly || saving}
                  />
                </div>
              </CardContent>
            </Card>
            {index < steps.length - 1 ? (
              <div className="flex justify-center py-2 text-muted-foreground">
                ↓
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {canManage ? (
        <Button
          type="button"
          variant="outline"
          onClick={addStep}
          disabled={saving}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add step
        </Button>
      ) : null}
    </div>
  );
}
