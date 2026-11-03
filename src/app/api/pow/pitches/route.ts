import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganizationContext } from "@/lib/auth/api-auth";
import { requireModule } from "@/lib/auth/require-module";
import { MODULE_KEYS } from "@/lib/billing/modules";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { powPitchService } from "@/services/pow-pitch.service";

const generateSchema = z.object({
  companyId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireModule(MODULE_KEYS.PROOF_OF_WORK, {
      permission: "organization.view",
    });
    await requireOrganizationContext();
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: { message: "companyId required" } },
        { status: 400 }
      );
    }
    const data = await powPitchService.getStatus(
      user.organizationId,
      companyId
    );
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireModule(MODULE_KEYS.PROOF_OF_WORK, {
      permission: "organization.view",
      mutation: true,
    });
    await requireOrganizationContext();
    const input = generateSchema.parse(await request.json());
    const data = await powPitchService.generate(
      user.organizationId,
      input.companyId,
      user.id,
      { contactId: input.contactId }
    );
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    return handleApiError(error);
  }
}
