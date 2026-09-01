export function buildResearchPrompt(lead: {
  fullName: string;
  jobTitle?: string | null;
  companyName?: string | null;
  industry?: string | null;
  companyWebsite?: string | null;
  linkedInUrl?: string | null;
  country?: string | null;
  companyDescription?: string | null;
}, services: Array<{ name: string; description: string; talkingPoints: unknown }>, campaignInstructions?: string | null) {
  const serviceList = services
    .map((s) => `- ${s.name}: ${s.description}`)
    .join("\n");

  return `You are a B2B sales research analyst. Research this prospect and return JSON only.

PROSPECT:
- Name: ${lead.fullName}
- Title: ${lead.jobTitle ?? "Unknown"}
- Company: ${lead.companyName ?? "Unknown"}
- Industry: ${lead.industry ?? "Unknown"}
- Website: ${lead.companyWebsite ?? "Unknown"}
- LinkedIn: ${lead.linkedInUrl ?? "Unknown"}
- Country: ${lead.country ?? "Unknown"}
- Company Description: ${lead.companyDescription ?? "Unknown"}

OUR SERVICES:
${serviceList}

${campaignInstructions ? `CAMPAIGN INSTRUCTIONS:\n${campaignInstructions}` : ""}

Return JSON with these fields:
{
  "companySummary": "2-3 sentence company overview",
  "whatCompanyDoes": "what the company does",
  "industry": "industry classification",
  "businessChallenges": ["challenge1", "challenge2"],
  "softwareOpportunities": ["opportunity1", "opportunity2"],
  "recommendedServices": ["service name1", "service name2"],
  "decisionMakerAnalysis": "analysis of this person's role and buying influence",
  "personalizationPoints": ["point1", "point2", "point3"],
  "suggestedOpeningMessage": "personalized LinkedIn connection request (max 300 chars)",
  "suggestedApproach": "recommended sales approach",
  "leadScore": 0-100,
  "reasoning": "why this score",
  "scoreCategory": "HOT|WARM|POSSIBLE|LOW_PRIORITY",
  "recommendedAction": "next best action"
}`;
}

export function buildOutreachPrompt(
  lead: { fullName: string; jobTitle?: string | null; companyName?: string | null },
  research: {
    companySummary?: string | null;
    personalizationPoints?: unknown;
    suggestedOpeningMessage?: string | null;
  },
  channel: "linkedin" | "email",
  campaignInstructions?: string | null
) {
  const points = Array.isArray(research.personalizationPoints)
    ? research.personalizationPoints.join(", ")
    : "";

  if (channel === "linkedin") {
    return `Write a personalized LinkedIn connection request message for:
Name: ${lead.fullName}, Title: ${lead.jobTitle}, Company: ${lead.companyName}
Company context: ${research.companySummary}
Personalization: ${points}
${campaignInstructions ? `Instructions: ${campaignInstructions}` : ""}

Rules: Max 300 characters, no generic fluff, reference something specific, professional tone.
Return JSON: { "subject": null, "message": "the message" }`;
  }

  return `Write a personalized cold outreach email for:
Name: ${lead.fullName}, Title: ${lead.jobTitle}, Company: ${lead.companyName}
Company context: ${research.companySummary}
Personalization: ${points}
${campaignInstructions ? `Instructions: ${campaignInstructions}` : ""}

Return JSON: { "subject": "email subject line", "message": "email body (plain text, 3-4 short paragraphs max)" }`;
}

export function buildReplyAnalysisPrompt(
  lead: { fullName: string; companyName?: string | null },
  conversationHistory: string,
  newReply: string
) {
  return `Analyze this sales reply and generate a response.

PROSPECT: ${lead.fullName} at ${lead.companyName ?? "Unknown"}

CONVERSATION HISTORY:
${conversationHistory}

NEW REPLY:
${newReply}

Return JSON:
{
  "classification": "INTERESTED|NOT_INTERESTED|ASK_LATER|NEED_INFORMATION|PRICE_QUESTION|MEETING_REQUEST|PROPOSAL_REQUEST|OTHER",
  "sentiment": "positive|neutral|negative",
  "summary": "brief summary of reply intent",
  "suggestedResponse": "professional response message",
  "shouldAutoSend": true/false,
  "recommendedLeadStatus": "REPLIED|INTERESTED|MEETING|LOST|QUALIFIED",
  "nextAction": "what to do next"
}`;
}

export function buildLinkedInProspectPrompt(
  profileUrl: string,
  searchCriteria?: {
    jobTitles?: string[];
    industries?: string[];
    countries?: string[];
    keywords?: string[];
    description?: string;
  }
) {
  const slug = profileUrl.split("/in/")[1]?.replace(/\/$/, "") ?? profileUrl;

  return `Based on this LinkedIn profile URL slug "${slug}" and search criteria, generate a realistic prospect profile for B2B outreach.

SEARCH CRITERIA: ${JSON.stringify(searchCriteria ?? {})}

Return JSON:
{
  "firstName": "string",
  "lastName": "string",
  "jobTitle": "string",
  "companyName": "string",
  "companyWebsite": "string or null",
  "industry": "string",
  "country": "string",
  "city": "string or null",
  "companySize": "string",
  "companyDescription": "brief description",
  "email": "educated guess email or null",
  "confidence": 0-100,
  "notes": "assumptions made"
}

Be realistic. If the slug is unclear, make reasonable inferences from the URL pattern.`;
}

export function buildProspectSearchPrompt(
  criteria: {
    jobTitles?: string[];
    industries?: string[];
    countries?: string[];
    keywords?: string[];
    description?: string;
  },
  count: number,
  campaignContext?: string
) {
  return `Generate ${count} realistic B2B prospect profiles matching these criteria for LinkedIn outreach.

CRITERIA: ${JSON.stringify(criteria)}
${campaignContext ? `CONTEXT: ${campaignContext}` : ""}

Return JSON array of prospects:
[{
  "firstName": "string",
  "lastName": "string",
  "jobTitle": "string",
  "companyName": "string",
  "industry": "string",
  "country": "string",
  "linkedInUrl": "https://linkedin.com/in/firstname-lastname",
  "companyWebsite": "string or null",
  "companyDescription": "brief",
  "confidence": 0-100
}]`;
}
