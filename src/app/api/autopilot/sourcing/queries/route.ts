import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchQueryService } from "@/services/search-query.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requireOrgPermission("integrations.manage");
    const user = await requireOrganizationContext();
    const queries = await searchQueryService.list(user.organizationId);
    return NextResponse.json(apiSuccess({ queries }));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  query: z.string().max(300).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  generate: z.boolean().optional(),
  maxQueries: z.number().int().min(3).max(30).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("integrations.manage");
    const body = createSchema.parse(await request.json());

    if (body.generate) {
      const created = await searchQueryService.generateFromIcp(
        user.organizationId,
        user.id,
        { maxQueries: body.maxQueries }
      );
      return NextResponse.json(apiSuccess({ queries: created }), {
        status: 201,
      });
    }

    if (!body.query || body.query.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: { message: "Query is required" } },
        { status: 400 }
      );
    }

    const row = await searchQueryService.create(user.organizationId, {
      query: body.query,
      country: body.country,
      city: body.city,
    });
    return NextResponse.json(apiSuccess({ query: row }), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
