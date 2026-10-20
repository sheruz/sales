import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { env } from "@/lib/config/env";
import { appHome } from "@/lib/app-paths";
import prisma from "@/lib/db/prisma";
import { getProviderForOrganization } from "@/services/billing/provider-registry";
import { paddleEnvironment, isPaddleConfigured } from "@/services/billing/paddle-client";

const schema = z.object({
  planVersionId: z.string().uuid(),
  interval: z.enum(["MONTHLY", "YEARLY"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("billing.manage");
    if (!env.PAYMENTS_ENABLED) {
      throw new ValidationError("Payments are not enabled yet");
    }
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    if (org.billingProvider !== "PADDLE") {
      throw new ValidationError(
        "This workspace uses manual billing — request an invoice instead"
      );
    }
    if (!isPaddleConfigured()) {
      throw new ValidationError("Paddle is not configured");
    }

    const body = schema.parse(await request.json());
    const provider = await getProviderForOrganization(user.organizationId);

    const admin = await prisma.organizationUser.findFirst({
      where: {
        organizationId: user.organizationId,
        isPrimaryAdmin: true,
      },
      include: { user: true },
    });
    const email =
      org.billingEmail || admin?.user.email || user.email;

    const result = await provider.createCheckout({
      organizationId: user.organizationId,
      planVersionId: body.planVersionId,
      interval: body.interval,
      customerEmail: email,
      successUrl: `${env.APP_URL}${appHome("/billing/activating")}`,
      cancelUrl: `${env.APP_URL}${appHome("/billing/choose-plan")}?cancelled=1`,
    });

    return NextResponse.json(
      apiSuccess({
        ...result,
        environment: paddleEnvironment(),
        taxNote: "Taxes may apply depending on your location",
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
