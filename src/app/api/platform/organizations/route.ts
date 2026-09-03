import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { organizationService } from "@/services/organization.service";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { OrganizationStatus } from "@prisma/client";

export async function GET() {
  try {
    await requireSuperAdmin();
    const orgs = await organizationService.listOrganizations();
    return NextResponse.json(apiSuccess(orgs));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().max(80).optional(),
  website: z.string().url().optional().or(z.literal("")),
  legalName: z.string().max(200).optional(),
  timezone: z.string().max(64).optional(),
  defaultCurrency: z.string().max(8).optional(),
  admin: z
    .object({
      email: z.string().email(),
      password: z.string().min(8),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = createSchema.parse(await request.json());
    const org = await organizationService.createOrganization({
      ...body,
      website: body.website || undefined,
    });
    await organizationService.writeAudit({
      organizationId: org.id,
      userId: actor.id,
      action: "organization.create",
      entityType: "organization",
      entityId: org.id,
      newValues: { name: org.name, slug: org.slug },
    });
    return NextResponse.json(apiSuccess(org), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

// Keep status enum re-export usage for PATCH routes typing
export type { OrganizationStatus };
