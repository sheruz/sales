import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  opportunityService,
  type OpportunityListFilter,
} from "@/services/opportunity.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const listSchema = z.object({
  filter: z
    .enum([
      "all",
      "hot",
      "warm",
      "new",
      "needs_action",
      "contacted",
      "replied",
      "meeting",
      "proposal",
      "won",
      "lost",
    ])
    .optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireOrgPermission("opportunities.view");
    const user = await requireOrganizationContext();
    const params = listSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const result = await opportunityService.list(user.organizationId, {
      filter: (params.filter ?? "all") as OpportunityListFilter,
      search: params.search,
      page: params.page,
      limit: params.limit,
      ownerId:
        user.organizationRoleKey === "sales_rep" ? user.id : undefined,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  companyId: z.string().uuid(),
  primaryContactId: z.string().uuid().optional(),
  whyNow: z.string().max(2000).optional(),
  likelyProblem: z.string().max(2000).optional(),
  recommendedAction: z.string().max(2000).optional(),
  estimatedValue: z.coerce.number().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("opportunities.create");
    const user = await requireOrganizationContext();
    const body = createSchema.parse(await request.json());
    const opportunity = await opportunityService.createManual(
      user.organizationId,
      user.id,
      body
    );
    return NextResponse.json(apiSuccess(opportunity), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
