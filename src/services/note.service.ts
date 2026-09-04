import prisma from "@/lib/db/prisma";
import { ActivityType } from "@prisma/client";
import { NotFoundError } from "@/lib/api/response";
import { activityService } from "@/services/activity.service";
import type { CreateNoteInput } from "@/lib/validations/lead";

export class NoteService {
  async listByLead(organizationId: string, leadId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    return prisma.note.findMany({
      where: { organizationId, leadId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async create(
    organizationId: string,
    leadId: string,
    input: CreateNoteInput,
    userId: string
  ) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    const note = await prisma.note.create({
      data: {
        organizationId,
        leadId,
        userId,
        content: input.content,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await activityService.log({
      organizationId,
      leadId,
      userId,
      type: ActivityType.NOTE_ADDED,
      title: "Note added",
      description: input.content.slice(0, 100),
    });

    return note;
  }

  async delete(organizationId: string, noteId: string, userId: string) {
    const note = await prisma.note.findFirst({
      where: { id: noteId, organizationId },
    });
    if (!note) throw new NotFoundError("Note not found");

    await prisma.note.delete({ where: { id: noteId } });

    await activityService.log({
      organizationId,
      leadId: note.leadId,
      userId,
      type: ActivityType.NOTE_ADDED,
      title: "Note deleted",
    });
  }
}

export const noteService = new NoteService();
