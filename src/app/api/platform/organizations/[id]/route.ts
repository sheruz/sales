import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OrganizationStatus } from "@prisma/client";
import { organizationService } from "@/services/organization.service";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const org = await organizationService.getOrganization(id);
    return NextResponse.json(apiSuccess(org));
  } catch (error) {
    return handleApiError(error);
  }
}

const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  website: z.string().url().nullable().optional().or(z.literal("")),
  legalName: z.string().max(200).nullable().optional(),
  status: z.nativeEnum(OrganizationStatus).optional(),
  timezone: z.string().max(64).optional(),
  defaultCurrency: z.string().max(8).optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const actor = await requireSuperAdmin();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const org = await organizationService.updateOrganization(id, {
      ...body,
      website: body.website === "" ? null : body.website,
    });
    await organizationService.writeAudit({
      organizationId: id,
      userId: actor.id,
      action: "organization.update",
      entityType: "organization",
      entityId: id,
      newValues: body,
    });
    return NextResponse.json(apiSuccess(org));
  } catch (error) {
    return handleApiError(error);
  }
}
