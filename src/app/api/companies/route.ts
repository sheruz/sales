import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CompanyStatus } from "@prisma/client";
import { companyService } from "@/services/company.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const createSchema = z.object({
  name: z.string().min(1).max(200),
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

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "opportunities.view",
      "leads.view",
    ]);
    const sp = request.nextUrl.searchParams;
    const result = await companyService.list(user.organizationId, {
      page: Number(sp.get("page") || 1) || 1,
      limit: Number(sp.get("limit") || 25) || 25,
      search: sp.get("search")?.trim() || undefined,
      domain: sp.get("domain")?.trim() || undefined,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "opportunities.create",
      "leads.create",
    ]);
    const body = await request.json();
    // Never accept organizationId from client
    const { organizationId: _ignored, ...rest } = body as Record<
      string,
      unknown
    >;
    void _ignored;
    const input = createSchema.parse(rest);
    const company = await companyService.create(user.organizationId, input);
    return NextResponse.json(apiSuccess(company), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
