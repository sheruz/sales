import { z } from "zod";

export const contactBriefSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Add your name so we know who to reply to.")
    .max(200),
  email: z.string().trim().email("Enter a valid work email.").max(320),
  company: z.string().trim().max(300).optional().or(z.literal("")),
  needs: z.array(z.string().max(80)).max(20).default([]),
  budget: z.string().trim().max(120).optional().or(z.literal("")),
  startTiming: z.string().trim().max(120).optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Add a sentence or two about the project.")
    .max(8000),
  website_url: z.string().optional().default(""),
});

export const waitlistSchema = z.object({
  email: z.string().trim().email("Enter a valid work email.").max(320),
  name: z.string().trim().max(200).optional().or(z.literal("")),
  website_url: z.string().optional().default(""),
});
