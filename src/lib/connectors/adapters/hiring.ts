import { SignalType, SourceConnectorType } from "@prisma/client";
import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import { buildJobPostDiscoveryPrompt } from "@/lib/ai/prompts";
import { extractDomain } from "@/services/company.service";
import type {
  ConnectorFetchContext,
  NormalizedSignalRecord,
  SourceConnectorAdapter,
} from "@/lib/connectors/types";

interface HiringRaw {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  companyName: string;
  companyWebsite?: string | null;
  industry: string;
  country: string;
  jobPostTitle: string;
  jobPostPlatform: string;
  jobPostUrl?: string | null;
  jobRequirements: string;
  budgetHint?: string | null;
  companySummary: string;
  leadScore: number;
  scoreCategory: string;
  personalizationPoints: string[];
  technologies?: string[];
}

export const hiringSignalConnector: SourceConnectorAdapter = {
  type: SourceConnectorType.HIRING,
  provider: "ai_job_discovery",
  displayName: "Hiring Signal Connector",
  description:
    "Discovers hiring / job-post signals and normalizes them into company + job signals.",

  async validate(ctx) {
    if (!ctx.userId) {
      return { ok: false, message: "User context required for AI fetch" };
    }
    return { ok: true };
  },

  async fetch(ctx: ConnectorFetchContext) {
    const count = Number(ctx.params?.count ?? ctx.configuration.count ?? 5);
    const criteria = (ctx.params?.criteria ??
      ctx.configuration.criteria ??
      {}) as {
      jobTitles?: string[];
      industries?: string[];
      countries?: string[];
      description?: string;
    };
    const campaignContext =
      (ctx.params?.campaignContext as string | undefined) ??
      (ctx.configuration.campaignContext as string | undefined);

    const result = await aiComplete({
      feature: "job_post_discovery",
      operation: "hiring_signal_discovery",
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      jsonMode: true,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You find B2B hiring / job-posting signals. Return valid JSON array only. Include email when possible.",
        },
        {
          role: "user",
          content: buildJobPostDiscoveryPrompt(
            criteria,
            count,
            campaignContext
          ),
        },
      ],
    });

    const prospects = parseAIJson<HiringRaw[]>(result.content);
    return {
      rawRecords: Array.isArray(prospects) ? prospects : [],
      metadata: { provider: "ai_job_discovery", count },
    };
  },

  normalize(raw): NormalizedSignalRecord | null {
    const p = raw as HiringRaw;
    if (!p?.companyName || !p?.jobPostTitle) return null;
    const domain = extractDomain(p.companyWebsite);
    const externalId =
      p.jobPostUrl || `${p.companyName}:${p.jobPostTitle}:${p.email || ""}`;

    return {
      signalType: SignalType.HIRING,
      title: p.jobPostTitle,
      description: p.jobRequirements,
      evidenceUrl: p.jobPostUrl,
      evidenceText: `${p.jobPostPlatform}: ${p.jobPostTitle}`,
      confidence: Math.min(95, Math.max(40, p.leadScore || 60)),
      externalId,
      company: {
        name: p.companyName,
        website: p.companyWebsite,
        domain,
        industry: p.industry,
        country: p.country,
        description: p.companySummary,
        technologies: p.technologies ?? [],
      },
      contact: {
        firstName: p.firstName || "Hiring",
        lastName: p.lastName || "Manager",
        email: p.email || null,
        title: p.jobTitle,
      },
      whyNow: `Open role "${p.jobPostTitle}" on ${p.jobPostPlatform}`,
      likelyProblem: p.jobRequirements,
      recommendedAction: `Contact ${p.firstName} ${p.lastName} about ${p.jobPostTitle}`,
      budgetHint: p.budgetHint,
      leadScore: p.leadScore,
      rawData: {
        job: {
          title: p.jobPostTitle,
          url: p.jobPostUrl,
          platform: p.jobPostPlatform,
          description: p.jobRequirements,
          technology: p.technologies ?? [],
          location: p.country,
          hiringDate: new Date().toISOString().slice(0, 10),
        },
        personalizationPoints: p.personalizationPoints,
        scoreCategory: p.scoreCategory,
      },
    };
  },
};
