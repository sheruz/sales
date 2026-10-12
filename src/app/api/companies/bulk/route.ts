import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { companyService } from "@/services/company.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const schema = z.object({
  action: z.enum(["crawl", "enrich", "skip", "unskip"]),
  companyIds: z.array(z.string().uuid()).min(1).max(25),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "integrations.manage",
      "campaigns.manage",
      "business_brain.manage",
      "opportunities.create",
    ]);
    const body = schema.parse(await request.json());
    const result = await companyService.bulkAction(
      user.organizationId,
      body.action,
      body.companyIds,
      user.id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
