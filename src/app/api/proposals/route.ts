import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ProposalStatus } from "@prisma/client";
import { proposalService } from "@/services/proposal.service";
import {
  requireOrgPermission,
  requireAnyOrgPermission,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "deals.manage",
      "opportunities.view",
    ]);
    const opportunityId =
      request.nextUrl.searchParams.get("opportunityId") ?? undefined;
    const proposals = await proposalService.list(user.organizationId, {
      opportunityId,
    });
    return NextResponse.json(apiSuccess(proposals));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(100000).optional().nullable(),
  currency: z.string().max(8).optional(),
  subtotal: z.coerce.number().optional().nullable(),
  discount: z.coerce.number().optional().nullable(),
  total: z.coerce.number().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  advanceOpportunity: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("deals.manage");
    const input = createSchema.parse(await request.json());
    const proposal = await proposalService.create(
      user.organizationId,
      input,
      user.id
    );
    return NextResponse.json(apiSuccess(proposal), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
