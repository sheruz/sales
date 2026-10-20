import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { env } from "@/lib/config/env";
import { appHome } from "@/lib/app-paths";
import prisma from "@/lib/db/prisma";
import { paddleProvider } from "@/services/billing/paddle.provider";
import {
  isPaddleConfigured,
  paddleEnvironment,
} from "@/services/billing/paddle-client";
import { paymentConfigService } from "@/services/billing/payment-config.service";

const schema = z.object({
  planVersionId: z.string().uuid(),
  interval: z.enum(["MONTHLY", "YEARLY"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("billing.manage");
    if (!(await paymentConfigService.isPaymentsLive())) {
      throw new ValidationError("Payments are not enabled yet");
    }
    const methods = await paymentConfigService.resolveCheckoutMethods(
      user.organizationId
    );
    if (!methods.includes("CARD_PADDLE")) {
      throw new ValidationError("Paddle checkout is not available for this org");
    }
    if (!(await isPaddleConfigured())) {
      throw new ValidationError("Paddle is not configured");
    }

    const body = schema.parse(await request.json());
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    const admin = await prisma.organizationUser.findFirst({
      where: {
        organizationId: user.organizationId,
        isPrimaryAdmin: true,
      },
      include: { user: true },
    });
    const email = org.billingEmail || admin?.user.email || user.email;

    const result = await paddleProvider.createCheckout({
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
        environment: await paddleEnvironment(),
        taxNote: "Taxes may apply depending on your location",
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
