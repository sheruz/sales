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

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireAnyOrgPermission([
      "deals.manage",
      "opportunities.view",
    ]);
    const { id } = await params;
    const proposal = await proposalService.getById(user.organizationId, id);
    return NextResponse.json(apiSuccess(proposal));
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  status: z.nativeEnum(ProposalStatus),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireOrgPermission("deals.manage");
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const proposal = await proposalService.updateStatus(
      user.organizationId,
      id,
      body.status,
      user.id
    );
    return NextResponse.json(apiSuccess(proposal));
  } catch (error) {
    return handleApiError(error);
  }
}
