"use client";

import { useEffect, useRef, useState } from "react";

export type PowPreviewView = {
  pageId: string;
  publicSlug: string;
  expiresAt: string;
  companyName: string;
  contactFirstName: string;
  tenant: {
    name: string;
    logoPath: string | null;
    websiteUrl: string;
    ctaLabel: string;
    bookingUrl: string;
  };
  findings: Array<Record<string, unknown> | null>;
  screenshots: Array<{ id: string; kind: string; url: string }>;
  offer: {
    name: string;
    price: number;
    currency: string;
    deliveryDays: number;
    includes: string;
  } | null;
  caseStudy: {
    clientType: string;
    problem: string;
    whatBuilt: string;
    result: string;
  } | null;
  replyMailto: string | null;
};

export function PowPreviewPageClient({ initial }: { initial: PowPreviewView }) {
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const visited = useRef(false);

  useEffect(() => {
    if (visited.current) return;
    visited.current = true;
    void fetch(`/api/pow/for/${encodeURIComponent(initial.publicSlug)}/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dwellMs: 0 }),
    }).catch(() => undefined);

    const onHide = () => {
      const dwellMs = Date.now() - started.current;
      const payload = JSON.stringify({ dwellMs });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `/api/pow/for/${encodeURIComponent(initial.publicSlug)}/visit`,
          new Blob([payload], { type: "application/json" })
        );
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [initial.publicSlug]);

  async function removeMe() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/pow/for/${encodeURIComponent(initial.publicSlug)}/remove`,
        { method: "POST" }
      );
      if (res.ok) setRemoved(true);
    } finally {
      setBusy(false);
    }
  }

  if (removed) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">You&apos;re removed</h1>
        <p className="mt-2 text-sm text-neutral-600">
          We won&apos;t email this address again from this sender.
        </p>
      </main>
    );
  }

  const findings = initial.findings.filter(Boolean) as Array<
    Record<string, unknown>
  >;

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          {initial.tenant.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={initial.tenant.logoPath}
              alt=""
              className="h-8 w-auto object-contain"
            />
          ) : null}
          <div>
            <p className="text-sm font-semibold">{initial.tenant.name}</p>
            <p className="text-xs text-neutral-500">Website notes for you</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <section>
          <h1 className="text-2xl font-bold tracking-tight">
            {initial.contactFirstName
              ? `${initial.contactFirstName}, a few notes on ${initial.companyName}`
              : `Notes on ${initial.companyName}`}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Personal link — not indexed. Expires{" "}
            {new Date(initial.expiresAt).toLocaleDateString()}.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">What we found</h2>
          {findings.length === 0 ? (
            <p className="text-sm text-neutral-600">No findings listed.</p>
          ) : (
            findings.map((f, i) => (
              <article
                key={i}
                className="rounded-lg border border-neutral-200 bg-white p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {String(f.severity || f.confidence || "")}
                </p>
                <h3 className="mt-1 font-semibold">{String(f.title || "Finding")}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">
                  {String(f.evidence || f.summary || "")}
                </p>
              </article>
            ))
          )}
        </section>

        {initial.screenshots.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Screenshots</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {initial.screenshots.map((s) => (
                <figure
                  key={s.id}
                  className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.url}
                    alt={s.kind}
                    className="w-full object-contain"
                  />
                  <figcaption className="px-2 py-1 text-xs text-neutral-500">
                    {s.kind}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {initial.offer ? (
          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Suggested starter</h2>
            <p className="mt-1 font-medium">{initial.offer.name}</p>
            <p className="text-sm text-neutral-600">
              {initial.offer.currency} {initial.offer.price} ·{" "}
              {initial.offer.deliveryDays} days
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {initial.offer.includes}
            </p>
          </section>
        ) : null}

        {initial.caseStudy ? (
          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Similar work</h2>
            <p className="text-sm text-neutral-500">
              {initial.caseStudy.clientType}
            </p>
            <p className="mt-2 text-sm">
              <span className="font-medium">Problem: </span>
              {initial.caseStudy.problem}
            </p>
            <p className="mt-1 text-sm">
              <span className="font-medium">Built: </span>
              {initial.caseStudy.whatBuilt}
            </p>
            <p className="mt-1 text-sm">
              <span className="font-medium">Result: </span>
              {initial.caseStudy.result}
            </p>
          </section>
        ) : null}

        <section className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-6">
          {initial.replyMailto ? (
            <a
              href={initial.replyMailto}
              className="inline-flex rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
            >
              Reply
            </a>
          ) : null}
          {initial.tenant.bookingUrl ? (
            <a
              href={initial.tenant.bookingUrl}
              className="inline-flex rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium"
            >
              {initial.tenant.ctaLabel}
            </a>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void removeMe()}
            className="text-sm text-neutral-500 underline"
          >
            Not relevant?
          </button>
        </section>
      </div>
    </main>
  );
}
