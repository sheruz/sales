import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContactStatus } from "@prisma/client";
import { contactService } from "@/services/contact.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  companyId: z.string().uuid().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  title: z.string().max(200).optional().nullable(),
  department: z.string().max(200).optional().nullable(),
  seniority: z.string().max(100).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  linkedInUrl: z.string().max(500).optional().nullable(),
  status: z.nativeEnum(ContactStatus).optional(),
});

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "opportunities.view",
      "leads.view",
    ]);
    const { id } = await params;
    const contact = await contactService.getById(user.organizationId, id);
    return NextResponse.json(apiSuccess(contact));
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
    const contact = await contactService.update(user.organizationId, id, {
      ...input,
      email: input.email === "" ? null : input.email,
    });
    return NextResponse.json(apiSuccess(contact));
  } catch (error) {
    return handleApiError(error);
  }
}
