import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SubscriptionStatus } from "@prisma/client";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { entitlementService } from "@/services/entitlement.service";
import { organizationService } from "@/services/organization.service";
import prisma from "@/lib/db/prisma";
import { env } from "@/lib/config/env";

const schema = z.object({
  action: z.enum([
    "assign",
    "trial",
    "manual",
    "complimentary",
    "set_none",
  ]),
  planVersionId: z.string().uuid().optional(),
  planCode: z.string().optional(),
  trialDays: z.number().int().min(1).max(90).optional(),
});

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdmin();
    const { id: organizationId } = await ctx.params;
    if (organizationId === env.PLATFORM_OWNER_ORG_ID) {
      throw new ValidationError("Cannot change Delvix / platform owner subscription");
    }

    const body = schema.parse(await request.json());

    if (body.action === "set_none") {
      await entitlementService.ensureSubscription(organizationId);
      const unassigned = await entitlementService.getUnassignedPlan();
      if (!unassigned) throw new ValidationError("UNASSIGNED plan missing");
      const sub = await prisma.subscription.update({
        where: { organizationId },
        data: {
          planId: unassigned.id,
          planVersionId: null,
          status: SubscriptionStatus.NONE,
          accessMode: "none",
          trialEndsAt: null,
          pendingPlanVersionId: null,
          pendingApplyAt: null,
        },
      });
      await organizationService.writePlatformAudit({
        actorUserId: actor.id,
        action: "tenant.subscription.set_none",
        targetType: "subscription",
        targetId: sub.id,
        organizationId,
      });
      return NextResponse.json(apiSuccess(sub));
    }

    let planVersionId = body.planVersionId;
    if (!planVersionId && body.planCode) {
      const plan = await prisma.plan.findFirst({
        where: {
          OR: [{ code: body.planCode }, { name: body.planCode }],
          archivedAt: null,
        },
      });
      planVersionId = plan?.currentVersionId ?? undefined;
    }
    if (!planVersionId) {
      throw new ValidationError("planVersionId or planCode required");
    }

    const status =
      body.action === "trial"
        ? SubscriptionStatus.TRIALING
        : SubscriptionStatus.ACTIVE;
    const accessMode =
      body.action === "trial"
        ? "trial"
        : body.action === "complimentary"
          ? "complimentary"
          : body.action === "manual"
            ? "manual"
            : "manual";

    const sub = await entitlementService.assignPlanVersion({
      organizationId,
      planVersionId,
      status,
      accessMode,
      trialDays: body.trialDays,
      actorUserId: actor.id,
    });

    await organizationService.writePlatformAudit({
      actorUserId: actor.id,
      action: `tenant.subscription.${body.action}`,
      targetType: "subscription",
      targetId: sub.id,
      organizationId,
      after: {
        planVersionId,
        status,
        accessMode,
      },
    });

    return NextResponse.json(apiSuccess(sub));
  } catch (error) {
    return handleApiError(error);
  }
}
