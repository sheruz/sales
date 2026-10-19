import { NextResponse } from "next/server";
import { requireBillingAccess } from "@/lib/auth/require-module";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import prisma from "@/lib/db/prisma";
import { PlanVersionStatus, PlanVisibility } from "@prisma/client";

/** Public catalog for Choose Plan — current published versions only (never drafts). */
export async function GET() {
  try {
    await requireBillingAccess();
    const plans = await prisma.plan.findMany({
      where: {
        active: true,
        archivedAt: null,
        visibility: PlanVisibility.PUBLIC,
        currentVersionId: { not: null },
      },
      orderBy: { sortOrder: "asc" },
      include: {
        versions: {
          where: { status: PlanVersionStatus.PUBLISHED },
          include: { features: true },
          orderBy: { version: "desc" },
          take: 5,
        },
      },
    });

    const cards = plans
      .map((p) => {
        const version =
          p.versions.find((v) => v.id === p.currentVersionId) ??
          p.versions[0];
        // Never expose DRAFT versions on Choose Plan
        if (!version || version.status !== PlanVersionStatus.PUBLISHED) {
          return null;
        }
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description,
          mostPopular: p.mostPopular,
          sortOrder: p.sortOrder,
          versionId: version.id,
          version: version.version,
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

    return NextResponse.json(apiSuccess(cards));
  } catch (error) {
    return handleApiError(error);
  }
}
