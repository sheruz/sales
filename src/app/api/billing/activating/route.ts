import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import prisma from "@/lib/db/prisma";

/** Poll subscription status after Paddle checkout — activation only via webhook. */
export async function GET() {
  try {
    const user = await requireOrgPermission("billing.manage");
    const sub = await prisma.subscription.findUnique({
      where: { organizationId: user.organizationId },
      include: { plan: { select: { name: true, code: true } } },
    });
    return NextResponse.json(
      apiSuccess({
        status: sub?.status ?? "NONE",
        planName: sub?.plan?.name ?? null,
        planCode: sub?.plan?.code ?? null,
        active:
          sub?.status === "ACTIVE" || sub?.status === "TRIALING",
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
