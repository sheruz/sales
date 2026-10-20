import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import prisma from "@/lib/db/prisma";
import { invoiceService } from "@/services/billing/invoice.service";
import { getProviderForOrganization } from "@/services/billing/provider-registry";

export async function GET() {
  try {
    const user = await requireOrgPermission("billing.manage");
    const invoices = await invoiceService.list({
      organizationId: user.organizationId,
    });
    return NextResponse.json(apiSuccess({ invoices }));
  } catch (error) {
    return handleApiError(error);
  }
}

const requestSchema = z.object({
  planVersionId: z.string().uuid(),
  interval: z.enum(["MONTHLY", "YEARLY"]),
});

/** Manual-provider tenants: request an OPEN invoice */
export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("billing.manage");
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    const { paymentConfigService } = await import(
      "@/services/billing/payment-config.service"
    );
    const providerId = await paymentConfigService.resolveOrgProvider(
      user.organizationId
    );
    if (
      providerId !== "MANUAL_PAYONEER" &&
      providerId !== "MANUAL_BANK"
    ) {
      throw new ValidationError("Invoice request is for manual billing tenants");
    }
    const body = requestSchema.parse(await request.json());
    const provider = await getProviderForOrganization(user.organizationId);
    const result = await provider.createCheckout({
      organizationId: user.organizationId,
      planVersionId: body.planVersionId,
      interval: body.interval,
      customerEmail: org.billingEmail || user.email,
      successUrl: "",
      cancelUrl: "",
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
