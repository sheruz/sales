import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SearchQueryStatus } from "@prisma/client";
import { searchQueryService } from "@/services/search-query.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  query: z.string().min(3).max(300).optional(),
  country: z.string().max(100).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  status: z.nativeEnum(SearchQueryStatus).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireOrgPermission("integrations.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const row = await searchQueryService.update(user.organizationId, id, body);
    return NextResponse.json(apiSuccess({ query: row }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireOrgPermission("integrations.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    await searchQueryService.remove(user.organizationId, id);
    return NextResponse.json(apiSuccess({ deleted: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
