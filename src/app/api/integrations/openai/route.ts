import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { userIntegrationService } from "@/services/user-integration.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const schema = z.object({
  apiKey: z.string().min(10),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("integrations.manage");
    const { apiKey } = schema.parse(await request.json());
    const integration = await userIntegrationService.saveOpenAi(
      user.organizationId,
      user.id,
      apiKey
    );
    return NextResponse.json(apiSuccess(integration));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireOrgPermission("integrations.manage");
    await userIntegrationService.disconnect(
      user.organizationId,
      user.id,
      "OPENAI"
    );
    return NextResponse.json(apiSuccess({ disconnected: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
