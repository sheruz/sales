import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { billingContactService } from "@/services/billing/billing-contact.service";

const patchSchema = z.object({
  billingEmail: z.string().email().nullable().optional().or(z.literal("")),
  billingContactName: z.string().max(200).nullable().optional(),
  billingAddress: z.string().max(2000).nullable().optional(),
  billingCountry: z.string().max(2).nullable().optional(),
  billingTaxId: z.string().max(64).nullable().optional(),
});

export async function GET() {
  try {
    const user = await requireOrgPermission("billing.manage");
    const details = await billingContactService.getBillingDetails(
      user.organizationId
    );
    return NextResponse.json(apiSuccess(details));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireOrgPermission("billing.manage");
    const body = patchSchema.parse(await request.json());
    const details = await billingContactService.updateBillingDetails(
      user.organizationId,
      {
        billingEmail:
          body.billingEmail === "" ? null : body.billingEmail,
        billingContactName: body.billingContactName,
        billingAddress: body.billingAddress,
        billingCountry: body.billingCountry,
        billingTaxId: body.billingTaxId,
      },
      user.id
    );
    return NextResponse.json(apiSuccess(details));
  } catch (error) {
    return handleApiError(error);
  }
}
