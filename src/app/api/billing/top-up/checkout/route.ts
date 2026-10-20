import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { env } from "@/lib/config/env";
import { appHome } from "@/lib/app-paths";
import prisma from "@/lib/db/prisma";
import { getProviderForOrganization } from "@/services/billing/provider-registry";

const schema = z.object({
  topUpPackId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("billing.manage");
    const body = schema.parse(await request.json());
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    const isManual = org.billingProvider.startsWith("MANUAL");
    if (!env.PAYMENTS_ENABLED && !isManual) {
      throw new ValidationError("Payments are not enabled yet");
    }
    const admin = await prisma.organizationUser.findFirst({
      where: { organizationId: user.organizationId, isPrimaryAdmin: true },
      include: { user: true },
    });
    const email = org.billingEmail || admin?.user.email || user.email;
    const provider = await getProviderForOrganization(user.organizationId);
    const result = await provider.createTopUpCheckout({
      organizationId: user.organizationId,
      topUpPackId: body.topUpPackId,
      customerEmail: email,
      successUrl: `${env.APP_URL}${appHome("/settings")}?tab=billing&topup=1`,
      cancelUrl: `${env.APP_URL}${appHome("/settings")}?tab=billing`,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
