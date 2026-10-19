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

const accessSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("trial"),
    planCode: z.string().min(1),
    trialDays: z.number().int().min(1).max(90).optional(),
  }),
  z.object({ type: z.literal("manual"), planCode: z.string().min(1) }),
  z.object({
    type: z.literal("complimentary"),
    planCode: z.string().min(1).optional(),
    endDate: z.string().datetime().optional().nullable(),
  }),
]);

const createSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().max(80).optional(),
  country: z.string().max(8).optional(),
  timezone: z.string().max(64).optional(),
  defaultCurrency: z.string().max(8).optional(),
  website: z.string().url().optional().or(z.literal("")),
  legalName: z.string().max(200).optional(),
  internalNotes: z.string().max(5000).optional(),
  owner: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  }),
  access: accessSchema.default({ type: "none" }),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin();
    const body = createSchema.parse(await request.json());
    const access =
      body.access.type === "complimentary"
        ? {
            type: "complimentary" as const,
            planCode: body.access.planCode ?? "COMPLIMENTARY",
            endDate: body.access.endDate
              ? new Date(body.access.endDate)
              : null,
          }
        : body.access;

    const { org, inviteToken, inviteExpiresAt } =
      await organizationService.createCompanyTenant({
        name: body.name,
        slug: body.slug,
        country: body.country,
        timezone: body.timezone,
        defaultCurrency: body.defaultCurrency,
        website: body.website || undefined,
        legalName: body.legalName,
        internalNotes: body.internalNotes,
        owner: body.owner,
        access,
        invitedById: actor.id,
      });

    await organizationService.writeAudit({
      organizationId: org.id,
      userId: actor.id,
      action: "organization.create",
      entityType: "organization",
      entityId: org.id,
      newValues: { name: org.name, slug: org.slug, access: body.access },
    });

    return NextResponse.json(
      apiSuccess({
        ...org,
        inviteToken,
        inviteExpiresAt,
        inviteLink: `${process.env.APP_URL ?? ""}/invite?token=${inviteToken}`,
      }),
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export type { OrganizationStatus };
