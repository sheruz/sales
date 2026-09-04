import { NextRequest, NextResponse } from "next/server";
import { noteService } from "@/services/note.service";
import { createNoteSchema } from "@/lib/validations/lead";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireOrgPermission("leads.view");
    const { id } = await params;
    const notes = await noteService.listByLead(user.organizationId, id);
    return NextResponse.json(apiSuccess(notes));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireOrgPermission("leads.update");
    const { id } = await params;
    const body = await request.json();
    const input = createNoteSchema.parse(body);
    const note = await noteService.create(
      user.organizationId,
      id,
      input,
      user.id
    );
    return NextResponse.json(apiSuccess(note), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
