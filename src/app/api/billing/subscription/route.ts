import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ValidationError } from "@/lib/api/response";
import { getProviderForOrganization } from "@/services/billing/provider-registry";
import { env } from "@/lib/config/env";
import prisma from "@/lib/db/prisma";

const schema = z.object({
  action: z.enum(["change", "cancel", "resume", "interval"]),
  planVersionId: z.string().uuid().optional(),
  interval: z.enum(["MONTHLY", "YEARLY"]).optional(),
  atPeriodEnd: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("billing.manage");
    const user = await requireOrganizationContext();
    if (user.organizationId === env.PLATFORM_OWNER_ORG_ID) {
      throw new ValidationError("Platform owner is never billed");
    }
    const body = schema.parse(await request.json());
    const provider = await getProviderForOrganization(user.organizationId);

    if (body.action === "cancel") {
      await provider.cancelSubscription({
        organizationId: user.organizationId,
        atPeriodEnd: body.atPeriodEnd !== false,
      });
      await prisma.subscription.update({
        where: { organizationId: user.organizationId },
        data: { cancelAtPeriodEnd: body.atPeriodEnd !== false },
      });
      return NextResponse.json(apiSuccess({ ok: true }));
    }

    if (body.action === "resume") {
      await provider.resumeSubscription({
        organizationId: user.organizationId,
      });
      await prisma.subscription.update({
        where: { organizationId: user.organizationId },
        data: { cancelAtPeriodEnd: false },
      });
      return NextResponse.json(apiSuccess({ ok: true }));
    }

    if (body.action === "change" || body.action === "interval") {
      if (!body.planVersionId || !body.interval) {
        throw new ValidationError("planVersionId and interval required");
      }
      const sub = await prisma.subscription.findUnique({
        where: { organizationId: user.organizationId },
        include: { planVersion: true },
      });
      const currentPrice = Number(sub?.planVersion?.priceMonthly ?? 0);
      const next = await prisma.planVersion.findUniqueOrThrow({
        where: { id: body.planVersionId },
      });
      const nextPrice =
        body.interval === "YEARLY"
          ? Number(next.priceYearly ?? next.priceMonthly) / 12
          : Number(next.priceMonthly);
      const isUpgrade = nextPrice > currentPrice;
      await provider.changeSubscription({
        organizationId: user.organizationId,
        planVersionId: body.planVersionId,
        interval: body.interval,
        proration: isUpgrade,
        effective: isUpgrade ? "immediate" : "period_end",
      });
      return NextResponse.json(
        apiSuccess({
          ok: true,
          effective: isUpgrade ? "immediate" : "period_end",
        })
      );
    }

    throw new ValidationError("Unknown action");
  } catch (error) {
    return handleApiError(error);
  }
}
