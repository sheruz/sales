import { NextResponse } from "next/server";
import { requirePlatformRead } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import prisma from "@/lib/db/prisma";
import { paymentConfigService } from "@/services/billing/payment-config.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** Sync status per enabled provider for the plan's current version. */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requirePlatformRead();
    const { id } = await ctx.params;
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan?.currentVersionId) {
      throw new ValidationError("Plan or published version not found");
    }
    const providers = await paymentConfigService.listProviderConfigs();
    const enabled = providers.filter(
      (p) => p.enabled && (p.provider === "PADDLE" || p.provider === "STRIPE")
    );
    const statuses = await Promise.all(
      enabled.map(async (p) => {
        const envName = p.mode === "LIVE" ? "production" : "sandbox";
        const maps = await prisma.providerPriceMap.findMany({
          where: {
            provider: p.provider,
            environment: envName,
            planVersionId: plan.currentVersionId!,
            active: true,
          },
        });
        const hasMonthly = maps.some((m) => m.interval === "MONTHLY");
        const hasYearly = maps.some((m) => m.interval === "YEARLY");
        return {
          provider: p.provider,
          mode: p.mode,
          environment: envName,
          synced: hasMonthly && hasYearly,
          intervals: maps.map((m) => m.interval),
        };
      })
    );
    return NextResponse.json(
      apiSuccess({ planVersionId: plan.currentVersionId, statuses })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
