"use client";

import { useMemo, useState } from "react";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURE_KEY_LABELS } from "@/lib/billing/features";
import { MODULE_KEYS } from "@/lib/billing/modules";

type PlanCard = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  mostPopular: boolean;
  versionId: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  monthlyCredits: number | null;
  creditRolloverEnabled: boolean;
  creditRolloverCapMonths: number | null;
  features: { key: string; enabled: boolean; limitValue: number | null }[];
};

const COMPARE_KEYS = [
  "users",
  "outbound_mailboxes",
  "emails_daily",
  "emails",
  "icps",
  "campaigns",
  "monthlyCredits",
  ...Object.values(MODULE_KEYS),
] as const;

export function ChoosePlanClient(props: {
  companyName: string;
  plans: PlanCard[];
  canManageBilling: boolean;
  contactEmail: string;
  accessMode: string;
  homeHref: string;
}) {
  const [yearly, setYearly] = useState(false);

  const mailto = useMemo(() => {
    if (!props.contactEmail) return null;
    const subject = encodeURIComponent(
      `Plan inquiry — ${props.companyName}`
    );
    return `mailto:${props.contactEmail}?subject=${subject}`;
  }, [props.contactEmail, props.companyName]);

  if (!props.canManageBilling) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <Lock className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Workspace not active yet
        </h1>
        <p className="mt-3 text-muted-foreground">
          Ask your admin to choose a plan to unlock {props.companyName}.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {props.companyName}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Choose a plan to activate your workspace.
          {props.accessMode === "locked"
            ? " Modules stay locked until a plan is active."
            : null}
        </p>
        <div className="mt-6 inline-flex rounded-lg border p-1 text-sm">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 ${!yearly ? "bg-foreground text-background" : ""}`}
            onClick={() => setYearly(false)}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 ${yearly ? "bg-foreground text-background" : ""}`}
            onClick={() => setYearly(true)}
          >
            Yearly
            <span className="ml-1 text-xs opacity-80">save ~17%</span>
          </button>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {props.plans.map((plan) => {
          const price = yearly ? plan.priceYearly : plan.priceMonthly;
          const modulesOn = plan.features.filter(
            (f) =>
              Object.values(MODULE_KEYS).includes(
                f.key as (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS]
              ) && f.enabled
          );
          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-xl border p-5 ${
                plan.mostPopular ? "border-foreground shadow-sm" : ""
              }`}
            >
              {plan.mostPopular ? (
                <span className="absolute -top-3 left-4 rounded-full bg-foreground px-2 py-0.5 text-xs text-background">
                  Most popular
                </span>
              ) : null}
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="mt-1 min-h-[2.5rem] text-sm text-muted-foreground">
                {plan.description}
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-tight">
                ${price}
                <span className="text-sm font-normal text-muted-foreground">
                  /{yearly ? "yr" : "mo"}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.monthlyCredits?.toLocaleString() ?? "—"} credits/mo
                {plan.creditRolloverEnabled
                  ? ` · rollover ${plan.creditRolloverCapMonths ?? 1} mo`
                  : " · no rollover"}
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                {modulesOn.slice(0, 8).map((f) => (
                  <li key={f.key} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    {FEATURE_KEY_LABELS[f.key] ?? f.key}
                  </li>
                ))}
              </ul>
              {mailto ? (
                <a
                  href={mailto}
                  className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                >
                  Online payment coming soon — contact us
                </a>
              ) : (
                <Button className="mt-6 w-full" disabled>
                  Online payment coming soon — contact us
                </Button>
              )}
            </article>
          );
        })}
      </div>

      {props.plans.length > 0 ? (
        <section className="mt-14 overflow-x-auto">
          <h3 className="mb-4 text-lg font-semibold">Compare plans</h3>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-medium">Feature</th>
                {props.plans.map((p) => (
                  <th key={p.id} className="px-2 py-2 font-medium">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_KEYS.map((key) => (
                <tr key={key} className="border-b border-border/60">
                  <td className="py-2 pr-4 text-muted-foreground">
                    {key === "monthlyCredits"
                      ? "Credits / month"
                      : (FEATURE_KEY_LABELS[key] ?? key)}
                  </td>
                  {props.plans.map((p) => {
                    if (key === "monthlyCredits") {
                      return (
                        <td key={p.id} className="px-2 py-2">
                          {p.monthlyCredits?.toLocaleString() ?? "—"}
                        </td>
                      );
                    }
                    const f = p.features.find((x) => x.key === key);
                    const cell = !f
                      ? "—"
                      : !f.enabled
                        ? "—"
                        : f.limitValue == null
                          ? "✓"
                          : String(f.limitValue);
                    return (
                      <td key={p.id} className="px-2 py-2">
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <p className="mt-8 text-muted-foreground">
          Plans are not seeded yet. Super Admin: run{" "}
          <code className="text-xs">node scripts/b1-apply.js</code> after dry-run
          GO.
        </p>
      )}

      {mailto ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Need Agency or a custom package?{" "}
          <a className="underline" href={mailto}>
            Talk to us
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
