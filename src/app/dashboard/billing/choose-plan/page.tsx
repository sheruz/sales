import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { appHome } from "@/lib/app-paths";
import { ChoosePlanClient } from "@/components/billing/choose-plan-client";
import { hasOrgPermission } from "@/lib/tenant/scope";
import prisma from "@/lib/db/prisma";
import { PlanVisibility } from "@prisma/client";
import { env } from "@/lib/config/env";
import { tenantAccessService } from "@/services/tenant-access.service";
import { paymentConfigService } from "@/services/billing/payment-config.service";
import { getPaddleRuntime } from "@/services/billing/paddle-client";

export const dynamic = "force-dynamic";

export default async function ChoosePlanPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/login");

  const access = await tenantAccessService.getAccess(user.organizationId);
  const canManageBilling = hasOrgPermission(user, "billing.manage");

  const [org, sub, paymentsLive, checkoutMethods, provider] =
    await Promise.all([
      prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { name: true, billingProvider: true },
      }),
      prisma.subscription.findUnique({
        where: { organizationId: user.organizationId },
        select: {
          status: true,
          planId: true,
          trialEndsAt: true,
          plan: { select: { id: true, code: true, name: true } },
        },
      }),
      paymentConfigService.isPaymentsLive(),
      paymentConfigService.resolveCheckoutMethods(user.organizationId),
      paymentConfigService.resolveOrgProvider(user.organizationId),
    ]);

  let paddleClientToken: string | null = null;
  let paddleEnv = "sandbox";
  if (checkoutMethods.includes("CARD_PADDLE")) {
    try {
      const rt = await getPaddleRuntime();
      paddleClientToken = rt.clientToken || null;
      paddleEnv = rt.environment;
    } catch {
      /* not configured */
    }
  }

  const plans = await prisma.plan.findMany({
    where: {
      active: true,
      archivedAt: null,
      visibility: PlanVisibility.PUBLIC,
      currentVersionId: { not: null },
    },
    orderBy: { sortOrder: "asc" },
    include: {
      versions: { include: { features: true }, orderBy: { version: "desc" } },
    },
  });

  const cards = plans
    .map((p) => {
      const version =
        p.versions.find((v) => v.id === p.currentVersionId) ?? p.versions[0];
      if (!version) return null;
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        mostPopular: p.mostPopular,
        sortOrder: p.sortOrder,
        versionId: version.id,
        priceMonthly: Number(version.priceMonthly),
        priceYearly: Number(version.priceYearly),
        currency: version.currency,
        monthlyCredits: version.monthlyCredits,
        creditRolloverEnabled: version.creditRolloverEnabled,
        creditRolloverCapMonths: version.creditRolloverCapMonths,
        features: version.features.map((f) => ({
          key: f.featureKey,
          enabled: f.enabled,
          limitValue: f.limitValue,
        })),
      };
    })
    .filter(Boolean);

  const contact =
    env.BILLING_CONTACT_EMAIL ?? env.NOTIFY_EMAIL ?? env.SMTP_FROM_EMAIL ?? "";

  return (
    <ChoosePlanClient
      companyName={org?.name ?? "your company"}
      plans={cards as NonNullable<(typeof cards)[number]>[]}
      canManageBilling={canManageBilling}
      contactEmail={contact}
      accessMode={access.accessMode}
      homeHref={appHome()}
      paymentsEnabled={paymentsLive}
      billingProvider={provider}
      checkoutMethods={checkoutMethods}
      paddleClientToken={paddleClientToken}
      paddleEnv={paddleEnv}
      current={
        sub
          ? {
              status: sub.status,
              planId: sub.planId,
              planCode: sub.plan.code,
              planName: sub.plan.name,
              trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
