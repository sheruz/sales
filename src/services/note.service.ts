import prisma from "@/lib/db/prisma";
import { ActivityType } from "@prisma/client";
import { NotFoundError } from "@/lib/api/response";
import { activityService } from "@/services/activity.service";
import type { CreateNoteInput } from "@/lib/validations/lead";

export class NoteService {
  async listByLead(leadId: string) {
    return prisma.note.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async create(leadId: string, input: CreateNoteInput, userId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
    });
    if (!lead) throw new NotFoundError("Lead not found");

    const note = await prisma.note.create({
      data: { leadId, userId, content: input.content },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await activityService.log({
      leadId,
      userId,
      type: ActivityType.NOTE_ADDED,
      title: "Note added",
      description: input.content.slice(0, 100),
    });

    return note;
  }

  async delete(noteId: string, userId: string) {
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundError("Note not found");

    await prisma.note.delete({ where: { id: noteId } });

    await activityService.log({
      leadId: note.leadId,
      userId,
      type: ActivityType.NOTE_ADDED,
      title: "Note deleted",
    });
  }
}

export const noteService = new NoteService();
