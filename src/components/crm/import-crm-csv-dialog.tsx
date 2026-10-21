"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CRM_IMPORT_HEADERS } from "@/lib/crm/import/types";
import type {
  ColumnMapping,
  ImportSummary,
  MappedCrmRow,
  ValidationReport,
} from "@/lib/crm/import/types";

type Step = "upload" | "preview" | "report" | "done";

type PreviewData = {
  jobId: string;
  headers: string[];
  mapping: ColumnMapping;
  runAuditAfterImport: boolean;
  totalRows: number;
  previewRows: MappedCrmRow[];
  validation: ValidationReport;
};

export function ImportCrmCsvDialog({
  variant = "default",
}: {
  variant?: "default" | "dx";
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [runAuditAfterImport, setRunAuditAfterImport] = useState(true);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  function reset() {
    setStep("upload");
    setPreview(null);
    setSummary(null);
    setJobId(null);
    setRunAuditAfterImport(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleUploadPreview() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a CSV file");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "runAuditAfterImport",
        runAuditAfterImport ? "true" : "false"
      );
      const res = await fetch("/api/crm/import/preview", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message ?? "Preview failed");
      }
      setPreview(data.data);
      setJobId(data.data.jobId);
      setRunAuditAfterImport(data.data.runAuditAfterImport ?? true);
      setStep("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!jobId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/crm/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          mapping: preview?.mapping,
          runAuditAfterImport,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message ?? "Import failed");
      }
      setSummary(data.data.summary);
      setStep("done");
      toast.success(
        `Import done: ${data.data.summary.imported} new, ${data.data.summary.updated} updated`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      {variant === "dx" ? (
        <DialogTrigger className="btn">
          <Upload />
          Import CSV
        </DialogTrigger>
      ) : (
        <DialogTrigger>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Companies & Contacts</DialogTitle>
          <DialogDescription>
            Template:{" "}
            <a href="/docs/import-template.csv" className="underline">
              import-template.csv
            </a>
            . Prospects pass enrichment (valid_manual) — no Hunter on import.
            Clients / DNC are never audited or enrolled.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="w-full text-sm"
            />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={runAuditAfterImport}
                onChange={(e) => setRunAuditAfterImport(e.target.checked)}
              />
              <span>
                Run audit + pitch for prospects after import
                <span className="block text-muted-foreground text-xs">
                  Default on. Draft pitches land in Pitch review. Clients /
                  partners / do-not-contact are skipped.
                </span>
              </span>
            </label>
            <p className="text-muted-foreground text-xs">
              Built-in checks only: syntax, MX/DNS, disposable blocklist,
              role-address label. Failed emails → invalid (not enrollable).
            </p>
            <DialogFooter>
              <Button onClick={handleUploadPreview} disabled={loading}>
                {loading ? "Parsing…" : "Upload & preview"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            <p className="text-sm">
              {preview.totalRows} rows · showing first{" "}
              {preview.previewRows.length}. Mapped columns:{" "}
              {Object.keys(preview.mapping).length}/
              {CRM_IMPORT_HEADERS.length}
            </p>
            <div className="overflow-x-auto rounded border text-xs">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-1">#</th>
                    <th className="p-1">Company</th>
                    <th className="p-1">Website</th>
                    <th className="p-1">Contact</th>
                    <th className="p-1">Email</th>
                    <th className="p-1">Relationship</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((r) => (
                    <tr key={r._rowNumber} className="border-b">
                      <td className="p-1">{r._rowNumber}</td>
                      <td className="p-1">{r.company_name}</td>
                      <td className="p-1">{r.website}</td>
                      <td className="p-1">
                        {r.first_name} {r.last_name}
                      </td>
                      <td className="p-1">{r.email}</td>
                      <td className="p-1">{r.relationship || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={() => setStep("report")}>
                Continue to validation
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "report" && preview && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Rows" value={preview.validation.totalRows} />
              <Stat
                label="Missing company"
                value={preview.validation.missingCompanyName}
              />
              <Stat label="Bad emails" value={preview.validation.badEmails} />
              <Stat
                label="Typo hints"
                value={preview.validation.typoSuggestions}
              />
              <Stat
                label="Dupes in file"
                value={preview.validation.duplicatesInFile}
              />
              <Stat
                label="Existing companies"
                value={preview.validation.existingCompanies}
              />
            </div>
            {preview.validation.issues.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded border text-xs">
                <ul className="divide-y">
                  {preview.validation.issues.slice(0, 50).map((issue, i) => (
                    <li key={i} className="p-2">
                      Row {issue.row}: {issue.message}
                      {issue.typoSuggestion
                        ? ` → ${issue.typoSuggestion}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={runAuditAfterImport}
                onChange={(e) => setRunAuditAfterImport(e.target.checked)}
              />
              <span>Run audit + pitch for prospects after import</span>
            </label>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("preview")}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={loading}>
                {loading ? "Importing…" : "Confirm import"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && summary && jobId && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Imported" value={summary.imported} />
              <Stat label="Updated" value={summary.updated} />
              <Stat label="Skipped" value={summary.skipped} />
              <Stat label="Failed" value={summary.failed} />
            </div>
            <div className="text-xs text-muted-foreground">
              Email checks — valid_manual: {summary.emailChecks.validManual},
              invalid: {summary.emailChecks.invalid}, generic:{" "}
              {summary.emailChecks.roleGeneric}, typo hints:{" "}
              {summary.emailChecks.typoSuggestions} · Audits queued:{" "}
              {summary.auditsQueued} · WON: {summary.wonOpportunities} ·
              Suppressions: {summary.suppressionsAdded}
            </div>
            <DialogFooter className="gap-2">
              <a
                href={`/api/crm/import/${jobId}/errors`}
                className="btn"
                download
              >
                Download error CSV
              </a>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
