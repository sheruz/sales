import type { Metadata } from "next";
import { Check, Globe, Link2, FileCheck, Lock, Smartphone, Target } from "lucide-react";
import { AuditForm } from "@/components/marketing/audit-form";
import { SlotImage } from "@/components/marketing/slot-image";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Free Website Audit | Delvix Studio",
  description: "Get a free report with screenshots of what's broken on your website and what to fix first.",
  path: "/free-audit",
});

const checks = [
  {
    icon: Target,
    title: "Mobile speed",
    text: "How long your pages take to show content on a phone, measured with Google PageSpeed.",
  },
  {
    icon: Link2,
    title: "Broken pages and links",
    text: "Pages and menu links that return errors or lead nowhere.",
  },
  {
    icon: FileCheck,
    title: "Forms",
    text: "Whether contact, quote and booking forms load and work on mobile.",
  },
  {
    icon: Lock,
    title: "SSL and security basics",
    text: "Certificate status, HTTPS redirects and mixed content warnings.",
  },
  {
    icon: Smartphone,
    title: "Mobile layout",
    text: "Sideways scrolling, overlapping elements and buttons too small to tap.",
  },
  {
    icon: Globe,
    title: "Calls to action",
    text: "Whether visitors can call, book or ask for a quote without searching.",
  },
];

const howSteps = [
  {
    n: "01",
    title: "Send your website",
    text: "Fill in the form. It takes under a minute.",
  },
  {
    n: "02",
    title: "We run the checks",
    text: "A real browser opens your site on desktop and iPhone and records evidence.",
  },
  {
    n: "03",
    title: "Get your report",
    text: "A short email with the top issues, screenshots and what to fix first.",
  },
];

export default function FreeAuditPage() {
  return (
    <>
      {/* Hero + Form */}
      <section className="mkt-section mkt-section--dark mkt-grid-bg">
        <div className="mkt-wrap">
          <div className="grid gap-14 lg:grid-cols-2">
            <div className="space-y-6">
              <span className="mkt-badge-primary">Free · No sales pitch</span>
              <h1 className="text-4xl font-extrabold text-balance leading-tight sm:text-5xl lg:text-6xl">
                Find out what your website is costing you.
              </h1>
              <p className="text-lg leading-relaxed text-muted-foreground">
                We open your site in a real browser on desktop and iPhone, check the things that lose customers, and send you a short report with screenshots.
              </p>
              <SlotImage
                slot="AUDIT-01"
                alt="Sample audit report"
                aspectRatio="16/10"
                className="w-full rounded-2xl border-2 border-dashed border-[var(--mkt-line)]"
              />
            </div>

            <div className="mkt-card mkt-card--light">
              <h2 className="mb-4 text-2xl font-bold">Request your free audit</h2>
              <AuditForm />
            </div>
          </div>
        </div>
      </section>

      {/* What We Check */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-11">
          <div className="max-w-3xl space-y-4">
            <p className="mkt-eyebrow">What we check</p>
            <h2 className="text-3xl font-extrabold text-balance sm:text-4xl">
              The things that quietly lose customers.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((check) => (
              <div key={check.title} className="mkt-card space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--mkt-accent-soft)]">
                  <check.icon className="h-5 w-5 text-[var(--mkt-accent)]" />
                </div>
                <h3 className="text-lg font-bold">{check.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {check.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mkt-section mkt-section--subtle">
        <div className="mkt-wrap space-y-10">
          <h2 className="text-3xl font-extrabold text-balance sm:text-4xl">
            How it works
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {howSteps.map((step) => (
              <div key={step.n} className="mkt-card mkt-card--light space-y-3">
                <span className="text-3xl font-extrabold text-[var(--mkt-accent)]">
                  {step.n}
                </span>
                <h3 className="text-lg font-bold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
