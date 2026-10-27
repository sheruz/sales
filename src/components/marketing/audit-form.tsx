"use client";

import { useState } from "react";
import { auditProblemOptions } from "@/content/site";
import { trackMetaLead } from "@/components/marketing/meta-pixel";

export function AuditForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const problem = String(fd.get("problem") || "");
    const website = String(fd.get("website") || "").trim();
    const payload = {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      company: "",
      needs: ["free_audit", problem].filter(Boolean),
      message: [
        "Free website & systems audit request.",
        website ? `Website: ${website}` : null,
        problem ? `Biggest problem: ${problem}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      website_url: "", // honeypot left empty
      formType: "audit",
    };
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Could not submit");
      trackMetaLead();
      setDone(true);
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-[var(--mkt-radius)] border border-[var(--mkt-line)] bg-[var(--mkt-panel)] p-4 text-sm">
        Thanks — we received your audit request and will reply by email.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      {/* honeypot */}
      <input
        type="text"
        name="website_url"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--mkt-muted)]">Name</span>
          <input
            required
            name="name"
            className="w-full rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-navy)] px-3 py-2.5"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--mkt-muted)]">Email</span>
          <input
            required
            type="email"
            name="email"
            className="w-full rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-navy)] px-3 py-2.5"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--mkt-muted)]">Website</span>
        <input
          name="website"
          type="url"
          placeholder="https://"
          className="w-full rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-navy)] px-3 py-2.5"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--mkt-muted)]">Biggest problem</span>
        <select
          name="problem"
          required
          className="w-full rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-navy)] px-3 py-2.5"
          defaultValue=""
        >
          <option value="" disabled>
            Select one
          </option>
          {auditProblemOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button type="submit" className="mkt-btn mkt-btn--primary" disabled={busy}>
        {busy ? "Sending…" : "Request free audit"}
      </button>
    </form>
  );
}
