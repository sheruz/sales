import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { env } from "@/lib/config/env";
import { appHome } from "@/lib/app-paths";
import { paymentConfigService } from "@/services/billing/payment-config.service";
import { getProvider } from "@/services/billing/provider-registry";
import prisma from "@/lib/db/prisma";

export async function POST() {
  try {
    const user = await requireOrgPermission("billing.manage");
    const sub = await prisma.subscription.findUnique({
      where: { organizationId: user.organizationId },
    });
    const providerId =
      sub?.provider === "STRIPE" || sub?.provider === "PADDLE"
        ? sub.provider
        : await paymentConfigService.resolveOrgProvider(user.organizationId);

    if (providerId.startsWith("MANUAL")) {
      throw new ValidationError(
        "Customer portal is not available for manual billing"
      );
    }

    const provider = getProvider(providerId);
    const result = await provider.createPortalSession({
      organizationId: user.organizationId,
      returnUrl: `${env.APP_URL}${appHome("/settings")}?tab=billing`,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
