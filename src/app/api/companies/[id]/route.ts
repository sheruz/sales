import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CompanyStatus } from "@prisma/client";
import { companyService } from "@/services/company.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  website: z.string().max(500).optional().nullable(),
  domain: z.string().max(255).optional().nullable(),
  industry: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  linkedInUrl: z.string().max(500).optional().nullable(),
  status: z.nativeEnum(CompanyStatus).optional(),
  source: z.string().max(100).optional().nullable(),
});

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "opportunities.view",
      "leads.view",
    ]);
    const { id } = await params;
    const company = await companyService.getById(user.organizationId, id);
    return NextResponse.json(apiSuccess(company));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "opportunities.update",
      "leads.update",
    ]);
    const { id } = await params;
    const body = await request.json();
    const { organizationId: _ignored, ...rest } = body as Record<
      string,
      unknown
    >;
    void _ignored;
    const input = updateSchema.parse(rest);
    const company = await companyService.update(
      user.organizationId,
      id,
      input
    );
    return NextResponse.json(apiSuccess(company));
  } catch (error) {
    return handleApiError(error);
  }
}
