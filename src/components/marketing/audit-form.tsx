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
        "Free website and systems audit request.",
        website ? `Website: ${website}` : null,
        problem ? `Biggest problem: ${problem}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      website_url: "",
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
      <div
        className="mkt-card space-y-2"
        role="status"
        aria-live="polite"
      >
        <p className="font-semibold">Request received</p>
        <p className="mkt-muted text-sm leading-relaxed">
          Thanks — we will reply by email with a short written read of your site.
        </p>
        <button
          type="button"
          className="mkt-link text-sm"
          onClick={() => setDone(false)}
        >
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mkt-card space-y-4" noValidate>
      <input
        type="text"
        name="website_url"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-[var(--mkt-muted)]">
            Name
          </span>
          <input
            required
            name="name"
            autoComplete="name"
            className="mkt-input h-12 w-full rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-navy)] px-3"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-[var(--mkt-muted)]">
            Email
          </span>
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            className="mkt-input h-12 w-full rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-navy)] px-3"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-[var(--mkt-muted)]">
          Website
        </span>
        <input
          name="website"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://"
          className="mkt-input h-12 w-full rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-navy)] px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-[var(--mkt-muted)]">
          Biggest problem
        </span>
        <select
          name="problem"
          required
          className="mkt-input h-12 w-full rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-navy)] px-3"
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
      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="mkt-btn mkt-btn--primary w-full sm:w-auto"
        disabled={busy}
      >
        {busy ? "Sending…" : "Request free audit"}
      </button>
      <p className="mkt-muted text-xs leading-relaxed">
        We use your details only to reply about this audit. See our{" "}
        <a href="/privacy" className="mkt-link">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}
