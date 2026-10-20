import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { env } from "@/lib/config/env";
import { appHome } from "@/lib/app-paths";
import prisma from "@/lib/db/prisma";
import { getProviderForOrganization } from "@/services/billing/provider-registry";

export async function POST() {
  try {
    const user = await requireOrgPermission("billing.manage");
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    if (org.billingProvider === "STRIPE") {
      return NextResponse.json(
        { success: false, error: { message: "Stripe is not enabled", code: "GONE" } },
        { status: 410 }
      );
    }
    if (org.billingProvider !== "PADDLE") {
      throw new ValidationError("Portal is only available for Paddle billing");
    }
    const provider = await getProviderForOrganization(user.organizationId);
    const session = await provider.createPortalSession({
      organizationId: user.organizationId,
      returnUrl: `${env.APP_URL}${appHome("/settings")}?tab=billing`,
    });
    return NextResponse.json(apiSuccess(session));
  } catch (error) {
    return handleApiError(error);
  }
}
