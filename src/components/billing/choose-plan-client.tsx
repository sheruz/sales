"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURE_KEY_LABELS } from "@/lib/billing/features";
import { MODULE_KEYS } from "@/lib/billing/modules";
import { appHome } from "@/lib/app-paths";

type PlanCard = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  mostPopular: boolean;
  sortOrder: number;
  versionId: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  monthlyCredits: number | null;
  creditRolloverEnabled: boolean;
  creditRolloverCapMonths: number | null;
  features: { key: string; enabled: boolean; limitValue: number | null }[];
};

type CurrentSub = {
  status: string;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  trialEndsAt: string | null;
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

/** Modules that differentiate tiers (shown in “plus” lists). */
const TIER_PLUS_MODULES = [
  MODULE_KEYS.AI_AUTO_SEND,
  MODULE_KEYS.MEETINGS,
  MODULE_KEYS.META_LEAD_ADS,
  MODULE_KEYS.LINKEDIN_ASSIST,
  MODULE_KEYS.ANALYTICS_ADVANCED,
  MODULE_KEYS.WHITE_LABEL,
  MODULE_KEYS.API_ACCESS,
] as const;

function featLimit(
  plan: PlanCard,
  key: string
): number | null | undefined {
  const f = plan.features.find((x) => x.key === key);
  if (!f?.enabled) return undefined;
  return f.limitValue;
}

function enabledModules(plan: PlanCard): Set<string> {
  return new Set(
    plan.features
      .filter((f) => f.enabled && Object.values(MODULE_KEYS).includes(f.key as never))
      .map((f) => f.key)
  );
}

function plusOverPrevious(plan: PlanCard, previous: PlanCard | null): string[] {
  const mine = enabledModules(plan);
  const prev = previous ? enabledModules(previous) : new Set<string>();
  const labels: string[] = [];
  for (const key of TIER_PLUS_MODULES) {
    if (mine.has(key) && !prev.has(key)) {
      labels.push(FEATURE_KEY_LABELS[key] ?? key);
    }
  }
  // Starter: show core modules (not dashboard — always on)
  if (!previous) {
    const core = [
      MODULE_KEYS.LEADS,
      MODULE_KEYS.AUTOPILOT_SOURCING,
      MODULE_KEYS.AUTOPILOT_ENRICHMENT,
      MODULE_KEYS.AUTOPILOT_AUDIT,
      MODULE_KEYS.OUTREACH,
      MODULE_KEYS.INBOX,
      MODULE_KEYS.AI_REPLIES,
      MODULE_KEYS.DEALS,
    ];
    return core
      .filter((k) => mine.has(k))
      .map((k) => FEATURE_KEY_LABELS[k] ?? k);
  }
  return labels;
}

export function ChoosePlanClient(props: {
  companyName: string;
  plans: PlanCard[];
  canManageBilling: boolean;
  contactEmail: string;
  accessMode: string;
  homeHref: string;
  current: CurrentSub | null;
  paymentsEnabled?: boolean;
  billingProvider?: string;
  paddleClientToken?: string | null;
  paddleEnv?: string;
}) {
  const router = useRouter();
  const [yearly, setYearly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paddleLive =
    !!props.paymentsEnabled &&
    props.billingProvider === "PADDLE" &&
    !!props.paddleClientToken;

  async function changePlan(plan: PlanCard) {
    setError(null);
    setBusy(plan.id);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change",
          planVersionId: plan.versionId,
          interval: yearly ? "YEARLY" : "MONTHLY",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Plan change failed");
        return;
      }
      router.push(appHome("/settings") + "?tab=billing");
    } finally {
      setBusy(null);
    }
  }

  async function startCheckout(plan: PlanCard) {
    setError(null);
    setBusy(plan.id);
    try {
      const res = await fetch("/api/billing/checkout/paddle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planVersionId: plan.versionId,
          interval: yearly ? "YEARLY" : "MONTHLY",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Checkout failed");
        return;
      }
      const { transactionId, clientToken } = json.data;
      // Load Paddle.js if needed
      const w = window as unknown as {
        Paddle?: {
          Environment: { set: (e: string) => void };
          Initialize: (o: { token: string }) => void;
          Checkout: { open: (o: Record<string, unknown>) => void };
        };
      };
      if (!w.Paddle) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Paddle.js"));
          document.body.appendChild(s);
        });
      }
      w.Paddle!.Environment.set(
        props.paddleEnv === "production" ? "production" : "sandbox"
      );
      w.Paddle!.Initialize({ token: clientToken || props.paddleClientToken! });
      w.Paddle!.Checkout.open({
        transactionId,
        settings: {
          successUrl: `${window.location.origin}${appHome("/billing/activating")}`,
          locale: "en",
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function requestInvoice(plan: PlanCard) {
    setBusy(plan.id);
    setError(null);
    try {
      const res = await fetch("/api/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planVersionId: plan.versionId,
          interval: yearly ? "YEARLY" : "MONTHLY",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Invoice request failed");
        return;
      }
      router.push(appHome("/settings") + "?tab=billing");
    } finally {
      setBusy(null);
    }
  }
  const locked =
    props.accessMode === "locked" ||
    props.current?.status === "NONE" ||
    props.current?.status === "EXPIRED" ||
    !props.current?.planId;
  const activeLike =
    props.current?.status === "ACTIVE" ||
    props.current?.status === "TRIALING" ||
    props.current?.status === "PAST_DUE";

  const sorted = useMemo(
    () => [...props.plans].sort((a, b) => a.sortOrder - b.sortOrder),
    [props.plans]
  );

  const mailto = useMemo(() => {
    if (!props.contactEmail) return null;
    const subject = encodeURIComponent(
      `Plan inquiry — ${props.companyName}`
    );
    return `mailto:${props.contactEmail}?subject=${subject}`;
  }, [props.contactEmail, props.companyName]);

  const trialDaysLeft = useMemo(() => {
    if (props.current?.status !== "TRIALING" || !props.current.trialEndsAt) {
      return null;
    }
    const ms = new Date(props.current.trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  }, [props.current]);

  if (!props.canManageBilling) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <Lock className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">
          {locked
            ? "Workspace not active yet"
            : `Your plan: ${props.current?.planName ?? "Active"}`}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {locked
            ? `Ask your admin to choose a plan to unlock ${props.companyName}.`
            : "Ask your admin to change billing or upgrade."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          {locked
            ? `Welcome, ${props.companyName}`
            : `Your plan: ${props.current?.planName ?? "Active"}`}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {locked
            ? "Choose a plan to activate your workspace. Modules stay locked until a plan is active."
            : props.current?.status === "TRIALING" && trialDaysLeft != null
              ? `Trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"}. Upgrade anytime.`
              : "Manage your package or contact us to change plans."}
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
        {sorted.map((plan, idx) => {
          const previous = idx > 0 ? sorted[idx - 1]! : null;
          const price = yearly ? plan.priceYearly : plan.priceMonthly;
          const isCurrent =
            activeLike &&
            (plan.id === props.current?.planId ||
              (plan.code != null &&
                plan.code === props.current?.planCode));
          const currentIdx = sorted.findIndex(
            (p) =>
              p.id === props.current?.planId ||
              (p.code != null && p.code === props.current?.planCode)
          );
          let ctaKind: "subscribe" | "current" | "upgrade" | "downgrade" =
            "subscribe";
          if (activeLike && currentIdx >= 0) {
            if (isCurrent) ctaKind = "current";
            else if (idx > currentIdx) ctaKind = "upgrade";
            else ctaKind = "downgrade";
          }

          const users = featLimit(plan, "users");
          const mailboxes = featLimit(plan, "outbound_mailboxes");
          const emailsDay = featLimit(plan, "emails_daily");
          const plus = plusOverPrevious(plan, previous);

          const ctaLabel =
            ctaKind === "current"
              ? "Current plan"
              : ctaKind === "upgrade"
                ? "Upgrade"
                : ctaKind === "downgrade"
                  ? "Downgrade"
                  : paddleLive
                    ? `Choose ${plan.name}`
                    : props.billingProvider?.startsWith("MANUAL")
                      ? "Request invoice"
                      : "Contact us to subscribe";

          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-xl border p-5 ${
                isCurrent
                  ? "border-primary ring-1 ring-primary/30"
                  : plan.mostPopular
                    ? "border-foreground shadow-sm"
                    : ""
              }`}
            >
              {isCurrent ? (
                <span className="absolute -top-3 left-4 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  Current plan
                </span>
              ) : plan.mostPopular ? (
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
              <p className="text-xs text-muted-foreground mt-1">
                Taxes may apply depending on your location
              </p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>
                  {(plan.monthlyCredits ?? 0).toLocaleString()} credits/mo
                  {plan.creditRolloverEnabled
                    ? ` · ${plan.creditRolloverCapMonths ?? 1} mo rollover`
                    : " · no rollover"}
                </li>
                <li>
                  {users == null ? "Unlimited" : users} user
                  {users === 1 ? "" : "s"} ·{" "}
                  {mailboxes == null ? "Unlimited" : mailboxes} mailbox
                  {mailboxes === 1 ? "" : "es"}
                </li>
                <li>
                  {emailsDay == null ? "Unlimited" : emailsDay} emails/day
                </li>
              </ul>
              <div className="mt-4 flex-1 text-sm">
                {previous ? (
                  <p className="mb-2 font-medium text-foreground">
                    Everything in {previous.name}, plus:
                  </p>
                ) : (
                  <p className="mb-2 font-medium text-foreground">Includes:</p>
                )}
                <ul className="space-y-1.5">
                  {plus.map((label) => (
                    <li key={label} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" />
                      {label}
                    </li>
                  ))}
                  {plus.length === 0 ? (
                    <li className="text-muted-foreground">Higher limits</li>
                  ) : null}
                </ul>
              </div>
              {ctaKind === "current" ? (
                <Button className="mt-6 w-full whitespace-nowrap" disabled>
                  {ctaLabel}
                </Button>
              ) : paddleLive ? (
                <Button
                  className="mt-6 w-full whitespace-nowrap"
                  disabled={busy === plan.id}
                  onClick={() =>
                    void (ctaKind === "upgrade" || ctaKind === "downgrade"
                      ? changePlan(plan)
                      : startCheckout(plan))
                  }
                >
                  {busy === plan.id ? "…" : ctaLabel}
                </Button>
              ) : props.billingProvider?.startsWith("MANUAL") ? (
                <Button
                  className="mt-6 w-full whitespace-nowrap"
                  disabled={busy === plan.id}
                  onClick={() => void requestInvoice(plan)}
                >
                  {ctaLabel}
                </Button>
              ) : mailto ? (
                <a
                  href={mailto}
                  className="mt-6 inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                >
                  {ctaLabel}
                </a>
              ) : (
                <Button className="mt-6 w-full whitespace-nowrap" disabled>
                  {ctaLabel}
                </Button>
              )}
            </article>
          );
        })}
      </div>

      {error && (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {sorted.length > 0 ? (
        <section className="mt-14 overflow-x-auto">
          <h3 className="mb-4 text-lg font-semibold">Compare plans</h3>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-medium">Feature</th>
                {sorted.map((p) => (
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
                  {sorted.map((p) => {
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
      ) : null}

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
