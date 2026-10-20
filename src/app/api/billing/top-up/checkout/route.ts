import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { env } from "@/lib/config/env";
import { appHome } from "@/lib/app-paths";
import { getProviderForOrganization } from "@/services/billing/provider-registry";
import { billingContactService } from "@/services/billing/billing-contact.service";

const schema = z.object({
  topUpPackId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("billing.manage");
    const body = schema.parse(await request.json());
    const { paymentConfigService } = await import(
      "@/services/billing/payment-config.service"
    );
    const providerId = await paymentConfigService.resolveOrgProvider(
      user.organizationId
    );
    const isManual = providerId.startsWith("MANUAL");
    if (!(await paymentConfigService.isPaymentsLive()) && !isManual) {
      throw new ValidationError("Payments are not enabled yet");
    }
    const email = await billingContactService.resolveBillingEmail(
      user.organizationId
    );
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
