import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ContactStatus } from "@prisma/client";
import { contactService } from "@/services/contact.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const createSchema = z.object({
  companyId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  title: z.string().max(200).optional().nullable(),
  department: z.string().max(200).optional().nullable(),
  seniority: z.string().max(100).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  linkedInUrl: z.string().max(500).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  status: z.nativeEnum(ContactStatus).optional(),
  leadId: z.string().uuid().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "opportunities.view",
      "leads.view",
    ]);
    const sp = request.nextUrl.searchParams;
    const result = await contactService.list(user.organizationId, {
      page: Number(sp.get("page") || 1) || 1,
      limit: Number(sp.get("limit") || 25) || 25,
      search: sp.get("search")?.trim() || undefined,
      companyId: sp.get("companyId")?.trim() || undefined,
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
    const { organizationId: _ignored, ...rest } = body as Record<
      string,
      unknown
    >;
    void _ignored;
    const input = createSchema.parse(rest);
    const contact = await contactService.create(user.organizationId, {
      ...input,
      email: input.email || null,
    });
    return NextResponse.json(apiSuccess(contact), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
