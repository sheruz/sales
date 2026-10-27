"use client";

import { useState } from "react";
import { trackMetaLead } from "@/components/marketing/meta-pixel";

export function WaitlistForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") || "").trim(),
      name: String(fd.get("name") || "").trim(),
      website_url: "",
    };
    try {
      const res = await fetch("/api/waitlist", {
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
        You are on the list. We will email when a spot opens.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-3" noValidate>
      <input
        type="text"
        name="website_url"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />
      <label className="sr-only" htmlFor="waitlist-name">
        Name
      </label>
      <input
        id="waitlist-name"
        name="name"
        placeholder="Name"
        className="min-w-[10rem] flex-1 rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-navy)] px-3 py-2.5"
      />
      <label className="sr-only" htmlFor="waitlist-email">
        Work email
      </label>
      <input
        id="waitlist-email"
        required
        type="email"
        name="email"
        placeholder="Work email"
        className="min-w-[12rem] flex-1 rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-navy)] px-3 py-2.5"
      />
      <button type="submit" className="mkt-btn mkt-btn--primary" disabled={busy}>
        {busy ? "Sending…" : "Request early access"}
      </button>
      {error ? <p className="w-full text-sm text-red-300">{error}</p> : null}
    </form>
  );
}
