import type { AiPageContent } from "./types";

/**
 * AI service page copy for Delvix Studio.
 * No fabricated numbers, clients or awards. Timelines are typical ranges, not promises.
 */
export const aiPages: AiPageContent[] = [
  // ---------------------------------------------------------------------------
  // 1. ai-integrations
  // ---------------------------------------------------------------------------
  {
    slug: "ai-integrations",
    seoTitle: "AI Integration Services for Your Product | Delvix Studio",
    seoDescription:
      "Add AI to the software you already run: drafting, classification and assistants with permissions, review queues and your own API keys. Code yours.",
    h1: "AI integrated into the workflow your team already uses",
    subline:
      "Drafts, classification and in-app assistants that act on your real data, under your permissions, with a human review step where the stakes are high.",
    intro: [
      "Most disappointing AI projects share a shape: a chat window beside the product that knows nothing about the product. Staff try it twice, get generic answers and go back to their old way of working. Useful AI sits inside the workflow. It reads the record in front of the user, proposes the next action and writes the result back to the system where the work lives.",
      "We integrate language models into existing products and operations with that in mind. That means defining which tools the model may call, which roles may trigger them, what gets logged and where a person approves before anything irreversible happens. The model is one component. The permissions, review queue, logging and cost controls around it are what make it safe to rely on.",
      "We work with OpenAI and Anthropic models, and with your own API keys. You choose the provider, you hold the account and you can switch later because the integration is built behind a clear interface. We scope one or two concrete workflows first, prove them with your real data and then widen the surface.",
    ].join("\n\n"),
    problems: [
      {
        title: "An assistant that knows nothing about your data",
        body: "A generic chatbot cannot see your customers, orders or documents, so answers stay shallow and users stop trusting it.",
        icon: "bot-off",
      },
      {
        title: "Pilots that never reach production",
        body: "A demo impresses in a meeting, then stalls on permissions, logging, cost and reliability questions nobody planned for.",
        icon: "flask-conical",
      },
      {
        title: "No control over what the model can do",
        body: "Giving a model broad access to internal systems without roles, limits or approvals is a security and reputation risk.",
        icon: "shield-alert",
      },
      {
        title: "Costs and quality you cannot see",
        body: "Without logging, evaluation and spending limits, you cannot tell whether the feature is helping, drifting or quietly expensive.",
        icon: "receipt-text",
      },
    ],
    deliverables: [
      {
        title: "Workflow and use-case scope",
        body: "One or two specific workflows defined end to end, with the inputs, outputs, users and success criteria written down.",
        icon: "file-text",
      },
      {
        title: "Model integration layer",
        body: "A clean interface to your chosen provider, with prompts, tool definitions and retries kept in code you control.",
        icon: "plug",
      },
      {
        title: "Permissioned tool access",
        body: "The model can only read or change what the signed-in user is allowed to, enforced on every call, not just in the prompt.",
        icon: "key-round",
      },
      {
        title: "Review queue and approvals",
        body: "A place where suggested drafts and actions wait for a person, with edit, approve and reject paths and a record of the decision.",
        icon: "list-checks",
      },
      {
        title: "Logging, evaluation and cost limits",
        body: "Traceable inputs and outputs, a set of test cases for quality, and rate and spending guardrails with rough cost notes.",
        icon: "chart-no-axes-combined",
      },
      {
        title: "Handover documentation",
        body: "Prompt and tool inventory, data-flow notes, runbook for provider outages and guidance for changing models later.",
        icon: "book-open-check",
      },
    ],
    steps: [
      {
        title: "Pick the workflow",
        body: "We select a concrete task with clear inputs and a reviewable output, and agree what good looks like in terms your team recognizes.",
      },
      {
        title: "Map data and risks",
        body: "We document what data the model sees, where it goes, who can trigger it and what could go wrong, then set the review rules.",
      },
      {
        title: "Prototype on real examples",
        body: "We build a working version and test it on your actual records, adjusting prompts and tools based on where it fails.",
      },
      {
        title: "Integrate and harden",
        body: "We connect it to your product with permissions, review queue, logging and limits, and demo it weekly to the people who will use it.",
      },
      {
        title: "Launch to a pilot group",
        body: "A small team uses it first. We watch results, tune behavior and widen access once the review data looks healthy.",
      },
    ],
    timeline:
      "A single well-bounded workflow, such as drafting replies or classifying incoming items inside an existing product, often takes three to six weeks from approved scope. Broader assistants with several tools and approval paths typically take two to four months. Data access and review rules usually need more time than the model work itself.",
    techSlugs: ["openai", "anthropic", "nodejs", "python", "postgresql"],
    relatedCaseStudySlug: "revenue-os",
    whoFor: [
      "Product teams adding assistants or drafting features to an app that already has users",
      "Operations teams with a repetitive text-heavy task and a person who can review the output",
      "Companies that want AI under their own keys and permissions, not a shared third-party account",
    ],
    whoNotFor: [
      "Teams hoping AI will fully replace a skilled decision with no review path",
      "Projects with no existing data or workflow for the model to work with",
      "Use cases where an error would cause serious harm and nobody can review it",
    ],
    relatedPages: [
      { href: "/ai/ai-agents", label: "AI agents with guardrails" },
      { href: "/ai/chatbots", label: "Custom chatbots" },
      { href: "/services/saas-development", label: "SaaS development" },
    ],
    faq: [
      {
        q: "Which models and providers do you work with?",
        a: "Mainly OpenAI and Anthropic models. The integration sits behind a clear interface so you can change providers or models later without rebuilding the feature.",
      },
      {
        q: "How do you stop the model from making things up?",
        a: "We cannot eliminate it, so we design around it. We ground answers in your records, require citations where possible, test against known cases and route risky outputs to a human before they reach a customer.",
      },
      {
        q: "Will it work with our existing software?",
        a: "Usually, yes. We integrate through your APIs, database or webhooks. We review the system during scoping and tell you what must change to make a safe integration possible.",
      },
      {
        q: "How do you handle costs?",
        a: "We set rate and spending limits, log usage per feature and give you rough cost notes so finance is not surprised. Because you hold the API account, billing is directly visible to you.",
      },
      {
        q: "Can we start small?",
        a: "We recommend it. One workflow with a review step, proven on real data, teaches more than a broad program and gives you a basis for deciding where to expand.",
      },
    ],
    whereHelps: [
      "Drafting replies, summaries and notes that a person reviews before sending",
      "Classifying and routing tickets, emails and forms into the right queue",
      "Extracting structured fields from text-heavy records",
      "Answering staff questions against your own documents with sources shown",
    ],
    whereDoesnt: [
      "Decisions that need accountable judgment and cannot be reviewed afterward",
      "Tasks that already work well as a simple rule or a database query",
      "Situations with no usable data or no way to check the output",
      "Anything where an occasional wrong answer would be unacceptable without a human in the loop",
    ],
    dataPrivacy:
      "Bring your own keys. You hold the OpenAI or Anthropic account, and we store credentials encrypted when the product must keep them. We do not train models on your data through our application layer. Your provider's own data-handling terms still apply, and we help you choose settings such as retention options where they are offered. Prompts and logs live in your environment, and you control what is stored and for how long.",
  },

  // ---------------------------------------------------------------------------
  // 2. ai-agents
  // ---------------------------------------------------------------------------
  {
    slug: "ai-agents",
    seoTitle: "AI Agent Development With Guardrails | Delvix Studio",
    seoDescription:
      "Custom AI agents that call your APIs under role limits, pause for approval and log every step. Built on your own keys, with code you own.",
    h1: "AI agents that act on your systems, within limits you set",
    subline:
      "Multi-step workflows that look things up, take actions through your APIs and stop for approval when the risk is high. Every step is logged and every permission is explicit.",
    intro: [
      "An agent is more than a chatbot with a longer prompt. It plans a task, chooses tools, calls them, looks at the results and keeps going until the job is done or it needs help. That makes it powerful and, if built carelessly, dangerous. The same loop that books a meeting correctly can also email the wrong person or modify the wrong record when instructions are ambiguous.",
      "We build agents with the controls that make them dependable. Each tool has a narrow purpose and a permission check. Actions are classified by risk: reading data may run freely, drafting happens in a queue and anything that spends money, deletes data or contacts a customer waits for a person. Every step is recorded, so you can replay what the agent saw, decided and did.",
      "We start with a workflow that already exists, such as researching a lead, preparing a quote, triaging a support case or reconciling an order, and build the agent around its real steps. Our own platform, Delvix Revenue OS, uses this kind of pattern: an AI agent that answers replies, with audit logs and per-tenant keys. We apply the same discipline to your use case.",
    ].join("\n\n"),
    problems: [
      {
        title: "Agents that do too much",
        body: "Broad access and vague instructions let an agent take actions nobody intended. One misread request can touch real customers or data.",
        icon: "octagon-alert",
      },
      {
        title: "No way to see what happened",
        body: "When an agent produces a bad outcome, there is no trace of its reasoning, the data it used or the tools it called, so fixing it is guesswork.",
        icon: "scan-search",
      },
      {
        title: "Brittle multi-step flows",
        body: "A single failed API call or unexpected response derails the whole run. Without retries and fallbacks, agents work in demos and break in production.",
        icon: "unlink",
      },
      {
        title: "Automation without accountability",
        body: "If nobody owns the agent's actions, errors become nobody's problem. Teams then switch the agent off rather than improve it.",
        icon: "user-round-cog",
      },
    ],
    deliverables: [
      {
        title: "Agent specification",
        body: "The goal, available tools, decision rules, escalation conditions and boundaries of the agent written in plain language.",
        icon: "file-text",
      },
      {
        title: "Tool layer on your APIs",
        body: "Narrow, well-described tools wrapping your systems, each with input validation and a role-based permission check.",
        icon: "wrench",
      },
      {
        title: "Risk-based approval policy",
        body: "Rules that decide which actions run automatically, which wait for approval and which are never allowed.",
        icon: "badge-check",
      },
      {
        title: "Run logs and replay",
        body: "A record of every step, tool call and output, searchable by run, so problems can be diagnosed and fixed.",
        icon: "history",
      },
      {
        title: "Evaluation set",
        body: "A collection of realistic test scenarios you can rerun when prompts, tools or models change.",
        icon: "test-tubes",
      },
      {
        title: "Operations and handover notes",
        body: "Runbook for failures, limits and spending controls, and guidance for adjusting policies as trust in the agent grows.",
        icon: "book-open-check",
      },
    ],
    steps: [
      {
        title: "Choose a workflow",
        body: "We pick a process with defined steps and a measurable outcome, and write down who does it today and where they get stuck.",
      },
      {
        title: "Define tools and boundaries",
        body: "We list the actions the agent needs, what each can touch and which require approval, before any model is involved.",
      },
      {
        title: "Build with a human in the loop",
        body: "The first version proposes actions and a person approves all of them, so we learn how the agent behaves on real cases.",
      },
      {
        title: "Evaluate and loosen carefully",
        body: "As logs show reliable behavior, we move low-risk actions to automatic and keep the risky ones behind approval.",
      },
      {
        title: "Operate and improve",
        body: "We hand over monitoring, limits and a process for reviewing failures so the agent gets better over time.",
      },
    ],
    timeline:
      "A first agent for a well-defined workflow, running with human approval, commonly takes four to eight weeks from approved scope. Agents with many tools, several integrations or complex policies take longer, typically two to four months. Moving actions from approval to automatic is intentionally gradual and driven by evidence from the logs.",
    techSlugs: ["openai", "anthropic", "nodejs", "python", "postgresql", "aws"],
    relatedCaseStudySlug: "revenue-os",
    whoFor: [
      "Teams with a repeatable multi-step process that people currently do by hand",
      "Products that want agents to act on behalf of users under strict permissions",
      "Operators who need an audit trail for every automated action",
    ],
    whoNotFor: [
      "Teams expecting a fully autonomous agent with no oversight from day one",
      "Processes that are not yet defined well enough for a person to explain",
      "Use cases where no safe, reversible actions exist and nobody can approve",
    ],
    relatedPages: [
      { href: "/ai/ai-integrations", label: "AI integrations" },
      { href: "/ai/sales-automation", label: "AI sales automation" },
      { href: "/services/automation-integrations", label: "Automation and integrations" },
    ],
    faq: [
      {
        q: "How is an agent different from a chatbot?",
        a: "A chatbot answers. An agent plans and takes actions through tools, often over several steps. That is why agents need permissions, approvals and logs that a simple chatbot can live without.",
      },
      {
        q: "What stops an agent from taking a harmful action?",
        a: "Several layers: narrow tools, permission checks outside the prompt, input validation, risk-based approval and hard limits on spending and volume. We do not rely on the prompt alone.",
      },
      {
        q: "Can we see why the agent did something?",
        a: "Yes. Each run records the inputs, tool calls, results and outputs, so you can replay and review decisions, and use real cases to improve behavior.",
      },
      {
        q: "Does it need to be fully autonomous to be useful?",
        a: "No. Many valuable agents prepare work for a person to approve in seconds. Autonomy is something you grant gradually, for specific low-risk actions, once the logs justify it.",
      },
      {
        q: "What happens when a provider is down or a tool fails?",
        a: "Runs retry where safe, then stop in a clear state and notify the right person. We design for partial failure so a single error does not leave records half-changed.",
      },
    ],
    whereHelps: [
      "Researching a lead or account and assembling a brief from several sources",
      "Triaging inbound requests and preparing the response for approval",
      "Reconciling records across systems and flagging mismatches for review",
      "Handling routine multi-step admin tasks that follow clear rules",
    ],
    whereDoesnt: [
      "Open-ended judgment calls that need accountable human decisions",
      "High-stakes irreversible actions with no approval step",
      "Processes that change daily with no stable rules to encode",
      "Tasks where a simple scripted automation would be cheaper and more predictable",
    ],
    dataPrivacy:
      "Agents run on your own provider keys, and the tools they call live in your environment under your permissions. Credentials are encrypted at rest when we must store them, and each agent only receives the data a given run needs. We do not use your data to train models through our application layer. Provider-level policies apply to your keys, and run logs stay in your database, where you decide retention and who can read them.",
  },

  // ---------------------------------------------------------------------------
  // 3. document-processing
  // ---------------------------------------------------------------------------
  {
    slug: "document-processing",
    seoTitle: "AI Document Processing & Data Extraction | Delvix Studio",
    seoDescription:
      "Turn invoices, contracts, forms and emails into structured data with AI extraction, validation rules and a human review queue. Your keys, your data.",
    h1: "Turn documents and inboxes into structured, checked data",
    subline:
      "Invoices, applications, contracts and emails read, classified and entered into your system, with validation rules and a review screen for anything uncertain.",
    intro: [
      "Somewhere in your business a person is reading a PDF and typing numbers into a screen. It might be supplier invoices, loan applications, delivery notes, onboarding forms or contract terms. The work is tedious, error-prone and scales with volume, which means growth makes it worse. It is also the kind of work language models and document parsing can handle well when the pipeline is designed with care.",
      "A document pipeline is more than extraction. Files arrive in different formats and quality, so we classify them first. We extract the fields you care about, validate them against rules such as totals that must add up or dates that must make sense, and compare them with your existing records. Anything uncertain goes to a review screen that shows the source side by side with the extracted values, so a person corrects it in seconds.",
      "Corrections feed back as test cases, which lets you see how accuracy changes when you update prompts or switch models. Results land in your system of record through its API, with a link to the original file for audit. We avoid promising a headline accuracy figure because it depends on your documents, and we measure it on a sample of yours before launch.",
    ].join("\n\n"),
    problems: [
      {
        title: "Manual data entry that scales with volume",
        body: "Every extra invoice or application means more typing. Hiring to keep up is expensive and the error rate rises as people tire.",
        icon: "keyboard",
      },
      {
        title: "Documents in every shape",
        body: "Scans, photos, native PDFs and email attachments from many senders defeat template-based tools that expect one fixed layout.",
        icon: "files",
      },
      {
        title: "Errors that surface late",
        body: "A wrong amount or a misread name travels downstream into payments and reports, and gets found weeks later when it is costly to fix.",
        icon: "alert-circle",
      },
      {
        title: "No audit trail back to the source",
        body: "Once data is typed in, nobody can easily trace a value to the page it came from, which complicates disputes and reviews.",
        icon: "route",
      },
    ],
    deliverables: [
      {
        title: "Document intake pipeline",
        body: "A single entry point for uploads, email and shared folders, with file checks and queuing for reliable processing.",
        icon: "inbox",
      },
      {
        title: "Classification and extraction",
        body: "Automatic identification of document types and extraction of the fields and line items you define, including tables.",
        icon: "scan-text",
      },
      {
        title: "Validation and matching rules",
        body: "Checks for totals, formats, duplicates and matches against purchase orders, customers or other records already in your systems.",
        icon: "check-check",
      },
      {
        title: "Human review screen",
        body: "A side-by-side view of the document and extracted values, with confidence flags and quick correction for exceptions.",
        icon: "columns-2",
      },
      {
        title: "Export to your systems",
        body: "Clean data delivered into your ERP, CRM, accounting or database through APIs, with the source file linked to each record.",
        icon: "upload",
      },
      {
        title: "Accuracy report on your documents",
        body: "A measured comparison of extraction against a sample you have verified, repeated when models or prompts change.",
        icon: "chart-no-axes-combined",
      },
    ],
    steps: [
      {
        title: "Collect representative samples",
        body: "We gather a realistic spread of your documents, including the messy ones, and define the fields and rules that matter.",
      },
      {
        title: "Prototype extraction",
        body: "We run the samples through a working pipeline and compare the results with values your team has verified.",
      },
      {
        title: "Design review and exceptions",
        body: "We set confidence thresholds and build the review screen so uncertain items go to a person and clear ones flow through.",
      },
      {
        title: "Integrate with your systems",
        body: "We connect the output to your system of record and test the full path with real volumes and edge cases.",
      },
      {
        title: "Pilot and tune",
        body: "A small stream of live documents runs in parallel with the manual process until the results are trusted, then volume increases.",
      },
    ],
    timeline:
      "A pipeline for one or two document types with a review screen and an export to a single system often takes four to eight weeks from approved scope. Many document types, multiple languages or complex matching rules extend this to two to four months. Collecting representative samples early is the biggest factor in staying on schedule.",
    techSlugs: ["openai", "anthropic", "python", "nodejs", "postgresql", "aws"],
    whoFor: [
      "Finance and operations teams processing invoices, forms or delivery paperwork at volume",
      "Businesses whose staff spend a large part of the week retyping documents",
      "Firms that need a traceable link between each data point and its source file",
    ],
    whoNotFor: [
      "Teams with a handful of documents a month, where manual entry is cheaper",
      "Cases that require legal certification of the extraction with no human check",
      "Documents so poor or inconsistent that a person cannot read them reliably either",
    ],
    relatedPages: [
      { href: "/ai/ai-integrations", label: "AI integrations" },
      { href: "/services/erp-development", label: "ERP development" },
      { href: "/services/automation-integrations", label: "Automation and integrations" },
    ],
    faq: [
      {
        q: "How accurate is the extraction?",
        a: "It depends on your documents, so we measure it rather than quote a generic figure. We test against a verified sample of yours before launch and report where the pipeline is strong and where a person must check.",
      },
      {
        q: "Do you need templates for each supplier?",
        a: "Usually not. Language models handle varied layouts well, though we still validate the output with rules. Highly regular documents can use simpler parsing alongside the model to reduce cost.",
      },
      {
        q: "What happens with uncertain results?",
        a: "They go to the review screen with the document alongside. A person confirms or corrects the values, and the correction is saved as a test case to improve the pipeline.",
      },
      {
        q: "Can it read scans and photographs?",
        a: "Yes, within limits. Image quality affects results, so we test with your real scans and recommend capture guidelines if needed, such as resolution or lighting for phone photos.",
      },
      {
        q: "Where do the documents go?",
        a: "To the model provider you choose through your own key, and to storage in your environment. We document the data flow so your security or legal team can review it before launch.",
      },
    ],
    whereHelps: [
      "Supplier invoices, receipts and purchase orders with varied layouts",
      "Application and onboarding forms that need entry into a system",
      "Contracts and letters where specific terms or dates must be pulled out",
      "Shared inboxes where attachments need sorting and routing",
    ],
    whereDoesnt: [
      "Very low volumes where setup cost outweighs the saved time",
      "Documents where any error carries serious legal or safety consequences without review",
      "Handwriting or images that people themselves cannot read reliably",
      "Cases where a structured data feed from the sender is available instead",
    ],
    dataPrivacy:
      "Your documents often contain sensitive information, so we design the data flow before writing code. Processing uses your own provider keys, files are stored in your cloud account, and credentials are encrypted at rest. We do not train models on your documents through our application layer, and provider-side terms for your keys still apply. Retention is configurable, so files and extracted data can be deleted on a schedule you choose.",
  },

  // ---------------------------------------------------------------------------
  // 4. chatbots
  // ---------------------------------------------------------------------------
  {
    slug: "chatbots",
    seoTitle: "Custom AI Chatbot Development | Delvix Studio",
    seoDescription:
      "Custom chatbots that answer from your own content, hand off to people cleanly and log every conversation. Built on your keys, with source code you own.",
    h1: "Chatbots that answer from your content and know when to hand off",
    subline:
      "A support or sales assistant grounded in your documents and systems, with sources shown, clear limits and a smooth handoff to a person when it should not answer.",
    intro: [
      "Customers do not hate chatbots. They hate chatbots that loop, invent answers and trap them away from a human. A good one resolves common questions quickly, says plainly when it does not know and passes the conversation to your team with context so nobody has to repeat themselves. That outcome comes from design choices, not from a bigger model.",
      "We build chatbots that answer from material you control: your help center, policies, product documentation and, where appropriate, live data such as order status through a permissioned lookup. Responses cite their sources, the bot refuses topics outside its remit and anything involving payments, legal commitments or complaints is routed to a person by rule rather than by hope.",
      "You get conversation logs, a way to review failures and a simple process for improving content when the bot cannot answer. Your team can see which questions come up most often, which is useful beyond the bot itself. We deploy the assistant on your website or inside your product and connect handoff to the tools your staff already use for support.",
    ].join("\n\n"),
    problems: [
      {
        title: "Repeated questions swamping the team",
        body: "Opening hours, order status, onboarding steps and policy queries fill the inbox and delay the conversations that need a person.",
        icon: "mail-warning",
      },
      {
        title: "Bots that invent answers",
        body: "A model without grounding will confidently state prices, policies or promises that you never made, creating work and risk.",
        icon: "message-circle-warning",
      },
      {
        title: "Dead ends with no human option",
        body: "Customers stuck in a loop abandon the conversation and remember the experience. Handoff is hidden or missing.",
        icon: "ban",
      },
      {
        title: "No visibility into what customers ask",
        body: "Without logs and review, you do not learn which questions the bot fails on or which gaps exist in your documentation.",
        icon: "eye-off",
      },
    ],
    deliverables: [
      {
        title: "Knowledge base grounding",
        body: "Your documents and pages indexed so the bot answers from approved content and cites where each answer came from.",
        icon: "library",
      },
      {
        title: "Conversation design and limits",
        body: "Tone, scope and refusal rules, including topics the bot must never discuss and phrases it must not use.",
        icon: "message-square-text",
      },
      {
        title: "Live lookups under permissions",
        body: "Secure access to data like order or booking status, available only to the right authenticated customer.",
        icon: "search-check",
      },
      {
        title: "Human handoff",
        body: "Rule-based escalation to your team through email, a helpdesk or chat, with the transcript attached.",
        icon: "hand-helping",
      },
      {
        title: "Review dashboard",
        body: "Conversation logs, unanswered questions and feedback, so you can fix content and adjust behavior based on real use.",
        icon: "layout-dashboard",
      },
      {
        title: "Website or in-app widget",
        body: "An embeddable chat interface matched to your brand and accessible on phones, with clear disclosure that it is automated.",
        icon: "message-circle",
      },
    ],
    steps: [
      {
        title: "Gather the questions",
        body: "We collect real customer questions from your inbox, chat logs and team knowledge to see what the bot must handle first.",
      },
      {
        title: "Prepare the content",
        body: "We identify gaps and conflicts in your documentation, organize it for retrieval and agree what is authoritative.",
      },
      {
        title: "Build and test with your team",
        body: "We build the assistant and have your staff attack it with tricky and off-topic questions before any customer sees it.",
      },
      {
        title: "Connect handoff and lookups",
        body: "We wire up escalation and any live data access, then test the full journey from question to resolution or human takeover.",
      },
      {
        title: "Launch and improve",
        body: "We release to a limited audience, review conversations weekly and update content and rules based on what we find.",
      },
    ],
    timeline:
      "A chatbot answering from existing documentation with handoff to email often takes three to five weeks from approved scope. Adding authenticated lookups, helpdesk integration or multiple languages typically extends it to six to ten weeks. Tidying up source content is often the longest task, so start gathering it early.",
    techSlugs: ["openai", "anthropic", "nextjs", "nodejs", "postgresql"],
    whoFor: [
      "Support teams answering the same questions repeatedly across email and chat",
      "Businesses that want a website assistant limited to approved information",
      "Products that want in-app help grounded in their documentation",
    ],
    whoNotFor: [
      "Companies without any documented policies or content for the bot to draw on",
      "Teams hoping to remove human support entirely",
      "Situations needing regulated advice, such as medical or legal guidance, from an automated system",
    ],
    relatedPages: [
      { href: "/ai/ai-integrations", label: "AI integrations" },
      { href: "/ai/ai-agents", label: "AI agents" },
      { href: "/services/website-development", label: "Website development" },
    ],
    faq: [
      {
        q: "Can the chatbot only use our information?",
        a: "It is designed to answer from your content and to say when it cannot find an answer. We cannot guarantee a model never strays, so we add refusal rules, source citations and logging that let you catch problems.",
      },
      {
        q: "What happens when the bot cannot help?",
        a: "It offers a handoff, collects the customer's details and sends the transcript to your team through email or your helpdesk. The customer does not have to explain their issue again.",
      },
      {
        q: "Can it check an order or booking?",
        a: "Yes, with a secure lookup tied to the signed-in customer or a verified identifier. The bot only sees what that person is allowed to see.",
      },
      {
        q: "How do we keep it accurate over time?",
        a: "Review unanswered and low-rated conversations regularly, then update the content. We provide a dashboard for this, and many clients keep a small retainer for ongoing tuning.",
      },
      {
        q: "Will customers know it is a bot?",
        a: "Yes. We recommend clear disclosure at the start of every conversation and an easy path to a person, which builds trust and aligns with good practice.",
      },
    ],
    whereHelps: [
      "Answering frequently asked questions from approved documentation",
      "Guiding visitors to the right product, plan or booking option",
      "Providing order, booking or account status through permissioned lookups",
      "Collecting details before handing a conversation to the right person",
    ],
    whereDoesnt: [
      "Complaints, disputes and emotionally sensitive conversations",
      "Pricing, refunds or contractual commitments without human approval",
      "Topics where your documentation is missing or contradictory",
      "Regulated advice that must come from a qualified professional",
    ],
    dataPrivacy:
      "Conversations can contain personal details, so we keep the data flow short and documented. The assistant calls your own provider account with your keys, and we store transcripts in your environment with retention you control. Credentials are encrypted at rest, and lookups respect the customer's permissions. We do not train models on your conversations through our application layer, and your provider's terms apply to what it receives.",
  },

  // ---------------------------------------------------------------------------
  // 5. sales-automation
  // ---------------------------------------------------------------------------
  {
    slug: "sales-automation",
    seoTitle: "AI Sales Automation & Lead Research | Delvix Studio",
    seoDescription:
      "AI sales automation that researches leads, drafts evidence-based outreach and handles replies with approval steps. Your keys, your CRM, source code yours.",
    h1: "AI sales automation that researches first and writes second",
    subline:
      "Lead research, evidence-based outreach drafts and reply handling wired into your pipeline, with approval before anything is sent and a log of everything that was.",
    intro: [
      "Generic AI outreach has a poor reputation for good reason. Mass-produced messages that could be addressed to anyone get ignored, and sometimes land your domain in spam folders. The useful version begins with research. Before a message is drafted, the system learns what a business actually does, what is visibly wrong or missing on their site and which person is likely to care. The draft then cites something real.",
      "We build sales automation that follows that order. Prospects are found and enriched, their websites are examined for specific findings, and an AI writes a draft grounded in that evidence. A salesperson reviews, edits and approves. When replies arrive, an agent can classify them, propose a response and update the pipeline, escalating to a person for anything sensitive. Nothing is sent without the controls you set.",
      "This is not theory for us. Delvix Revenue OS, our own platform, finds businesses through Google Places, crawls their sites, runs a deep audit with screenshots and findings, writes personalized outreach and answers replies with an AI agent, and we use it daily for our own client acquisition. We can integrate similar capabilities into your CRM or build a custom workflow around your market.",
    ].join("\n\n"),
    problems: [
      {
        title: "Hours lost to manual prospect research",
        body: "Sales staff open dozens of tabs per lead, copy details into a sheet and still send a message that sounds like everyone else's.",
        icon: "search",
      },
      {
        title: "Outreach that reads like a template",
        body: "Mail-merge messages with a swapped company name get ignored and train prospects to treat your name as spam.",
        icon: "mails",
      },
      {
        title: "Replies that sit unanswered",
        body: "Interested prospects write back and wait because follow-up depends on someone checking the inbox at the right moment.",
        icon: "clock-alert",
      },
      {
        title: "A pipeline that does not reflect reality",
        body: "Conversations happen in email while the CRM stays out of date, so forecasting and follow-up planning rely on memory.",
        icon: "kanban",
      },
    ],
    deliverables: [
      {
        title: "Prospect discovery and enrichment",
        body: "Sourcing of target businesses and enrichment of contact details through the providers you choose, with clear handling of gaps.",
        icon: "radar",
      },
      {
        title: "Evidence-based research briefs",
        body: "Per-prospect summaries drawn from their website and public information, with the specific observations listed and linked.",
        icon: "file-search",
      },
      {
        title: "Personalized draft generation",
        body: "Outreach drafts that reference actual findings, written in your voice with rules for tone, claims and what must never be said.",
        icon: "pen-line",
      },
      {
        title: "Approval workflow",
        body: "A review queue where your team edits, approves or rejects each draft before sending, with rate limits and sender safeguards.",
        icon: "list-checks",
      },
      {
        title: "Reply classification and responses",
        body: "Inbound replies sorted by intent, with suggested answers and automatic pipeline updates, and escalation for sensitive cases.",
        icon: "reply",
      },
      {
        title: "CRM sync and reporting",
        body: "Every touch, reply and stage change recorded in your pipeline, plus reports on what is working in your outreach.",
        icon: "chart-no-axes-combined",
      },
    ],
    steps: [
      {
        title: "Define the market and offer",
        body: "We clarify who you sell to, what problem you solve for them and what evidence of that problem can be observed from outside.",
      },
      {
        title: "Design the research signals",
        body: "We choose the checks that matter, such as site issues, missing features or hiring signals, and how they map to your offer.",
      },
      {
        title: "Build the pipeline and drafts",
        body: "We implement discovery, enrichment, research and drafting, then tune drafts against your own examples of good outreach.",
      },
      {
        title: "Add approval and reply handling",
        body: "We build the review queue, sending controls and reply agent, and connect them to your CRM and mailboxes.",
      },
      {
        title: "Pilot with a small list",
        body: "We run a limited campaign, review each message and response with you and adjust before scaling the volume.",
      },
    ],
    timeline:
      "A focused workflow covering research, drafting and approval on top of your existing CRM commonly takes six to ten weeks from approved scope. Adding automated reply handling, multiple data providers or a full multi-user platform with billing generally takes three to five months. Email deliverability setup runs alongside and needs time to warm up, which we plan for.",
    techSlugs: ["openai", "anthropic", "nextjs", "nodejs", "postgresql", "python"],
    relatedCaseStudySlug: "revenue-os",
    whoFor: [
      "Agencies and consultancies that sell high-value services to a defined set of businesses",
      "Sales teams spending most of their time researching instead of conversing",
      "Founders who want outbound that cites real findings and stays under human control",
    ],
    whoNotFor: [
      "Teams wanting high-volume, untargeted blasts to purchased lists",
      "Businesses without a clear offer or defined target market",
      "Anyone looking to bypass email consent and anti-spam rules in their region",
    ],
    relatedPages: [
      { href: "/ai/ai-agents", label: "AI agents" },
      { href: "/services/crm-development", label: "CRM development" },
      { href: "/autopilot", label: "Delvix Autopilot" },
    ],
    faq: [
      {
        q: "Is this automated spam?",
        a: "It should not be. The design favors fewer, better-researched messages, human approval before sending, rate limits and your compliance rules. We do not build systems for blasting purchased lists.",
      },
      {
        q: "Will it work with our CRM?",
        a: "If your CRM has an API, usually yes. We list which fields sync and what limits apply in the scope. If you have no CRM, we can build a lightweight pipeline.",
      },
      {
        q: "Can AI answer replies without approval?",
        a: "You choose. We usually begin with every reply reviewed, then allow automatic responses for clearly low-risk categories once the logs show reliable behavior. Sensitive replies always go to a person.",
      },
      {
        q: "Where does the prospect data come from?",
        a: "From the providers and sources you select, such as business directories, public websites and enrichment services. You hold the accounts, and we document what data is collected and why.",
      },
      {
        q: "Is Delvix Revenue OS the same thing?",
        a: "It is our own product built on similar patterns, in production for our own client acquisition and in early access for agencies. A custom engagement builds around your market and systems instead.",
      },
    ],
    whereHelps: [
      "Researching prospects and summarizing what is visible about their business",
      "Drafting first-touch and follow-up messages that cite real observations",
      "Classifying replies and proposing responses for a salesperson to approve",
      "Keeping the pipeline current without manual data entry",
    ],
    whereDoesnt: [
      "Mass messaging to people who have not been researched or qualified",
      "Negotiating pricing and terms without a human on the conversation",
      "Markets where outbound email is restricted and consent is required",
      "Offers that are too vague to describe in a concrete, evidence-backed message",
    ],
    dataPrivacy:
      "Prospect research and drafting run through your own provider keys, and enrichment services connect with accounts you hold. Credentials are encrypted at rest, and each tenant's data stays separate. We do not train models on your prospect data or conversations through our application layer, and provider terms for your keys apply. Logs of drafts, approvals and replies live in your environment so you can audit what was sent and why.",
  },
];

export function getAiPage(slug: string): AiPageContent | undefined {
  return aiPages.find((p) => p.slug === slug);
}
