import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetAudience: z.string().max(1000).optional(),
  targetCountries: z.array(z.string()).default([]),
  targetIndustries: z.array(z.string()).default([]),
  serviceId: z.string().uuid().optional(),
  aiInstructions: z.string().max(5000).optional(),
  dailyOutreachLimit: z.coerce.number().min(1).max(500).default(50),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).default("DRAFT"),
  /** Optional default OutreachSequence for canonical Contact enrollments */
  defaultSequenceId: z.string().uuid().optional().nullable(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const campaignEnrollSchema = z.object({
  contactId: z.string().uuid(),
  opportunityId: z.string().uuid().optional().nullable(),
  sequenceId: z.string().uuid().optional().nullable(),
});

export const campaignLeadBridgeSchema = z.object({
  sequenceId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
});

export const linkedInDiscoverySchema = z.object({
  campaignId: z.string().uuid().optional(),
  profileUrls: z.array(z.string().url()).optional(),
  searchCriteria: z
    .object({
      jobTitles: z.array(z.string()).optional(),
      industries: z.array(z.string()).optional(),
      countries: z.array(z.string()).optional(),
      companySizes: z.array(z.string()).optional(),
      keywords: z.array(z.string()).optional(),
      description: z.string().optional(),
    })
    .optional(),
  targetCount: z.coerce.number().min(1).max(25).default(10),
  autoStartAutomation: z.boolean().default(false),
});

export const startAutomationSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(50),
  campaignId: z.string().uuid().optional(),
  channels: z.array(z.enum(["linkedin", "email"])).default(["email"]),
});

export const inboundReplySchema = z.object({
  leadId: z.string().uuid(),
  channel: z.enum(["EMAIL", "LINKEDIN"]),
  content: z.string().min(1),
  subject: z.string().optional(),
  autoRespond: z.boolean().default(true),
});

export const generateOutreachSchema = z.object({
  leadId: z.string().uuid(),
  channel: z.enum(["linkedin", "email"]),
  campaignId: z.string().uuid().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CampaignEnrollInput = z.infer<typeof campaignEnrollSchema>;
export type CampaignLeadBridgeInput = z.infer<typeof campaignLeadBridgeSchema>;
export type LinkedInDiscoveryInput = z.infer<typeof linkedInDiscoverySchema>;
export type StartAutomationInput = z.infer<typeof startAutomationSchema>;
