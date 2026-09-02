import { z } from "zod";
import { LeadScoreCategory, LeadStatus } from "@prisma/client";

export const createLeadSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  linkedInUrl: z.string().url().optional().or(z.literal("")),
  companyName: z.string().optional(),
  companyWebsite: z.string().url().optional().or(z.literal("")),
  companyLinkedIn: z.string().url().optional().or(z.literal("")),
  jobTitle: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  companyDescription: z.string().optional(),
  source: z.string().optional(),
  campaignId: z.string().uuid().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  status: z.nativeEnum(LeadStatus).optional(),
  estimatedBudget: z.coerce.number().positive().optional().nullable(),
  notes: z.string().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

export const leadListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  scoreCategory: z.nativeEnum(LeadScoreCategory).optional(),
  assignedToId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  source: z.string().optional(),
  sortBy: z
    .enum(["createdAt", "fullName", "score", "status", "updatedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const bulkLeadActionSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
  action: z.enum(["delete", "assign", "updateStatus", "addTag"]),
  assignedToId: z.string().uuid().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  tagId: z.string().uuid().optional(),
});

export const createNoteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
});

export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  website: z.string().url().optional().or(z.literal("")),
  linkedInUrl: z.string().url().optional().or(z.literal("")),
  industry: z.string().optional(),
  size: z.string().optional(),
  description: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
export type BulkLeadAction = z.infer<typeof bulkLeadActionSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
