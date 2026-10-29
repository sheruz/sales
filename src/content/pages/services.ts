import type { ServicePageContent } from "./types";

/**
 * Service page copy for Delvix Studio.
 * No fabricated numbers, clients or awards. Timelines are typical ranges, not promises.
 */
export const servicePages: ServicePageContent[] = [
  // ---------------------------------------------------------------------------
  // 1. fixed-price-projects
  // ---------------------------------------------------------------------------
  {
    slug: "fixed-price-projects",
    seoTitle: "Fixed-Price Software Projects | Delvix Studio",
    seoDescription:
      "Fixed-price software projects with a written scope in three days, weekly demos and full code ownership. Remote team on US, UK, EU and Gulf hours.",
    h1: "Fixed-price software projects with the scope in writing",
    subline:
      "You get a written scope, a firm price and a delivery plan before we write a line of code. Then working software arrives every week until launch.",
    intro: [
      "A fixed price only means something if the scope underneath it is real. Most overruns do not come from slow developers. They come from a brief that said “customer portal” and meant forty different things. We spend the first days of an engagement turning your goal into a document: the screens, the rules, the integrations, what is explicitly out, and what we assumed because nobody had the answer yet.",
      "Once you approve that scope, the price is the price. If something new appears, we write it up as a change with its own cost and date effect, and you decide whether it goes in now, later or never. There is no quiet erosion that turns into a surprise invoice, and no pressure on us to cut corners to protect a number.",
      "Fixed price suits projects with a definable finish line: a client portal, an internal tool, a mobile companion, a migration. It is the wrong contract for exploratory work where you will learn your way to the requirements, and we will tell you that on the first call instead of selling you the contract either way.",
    ].join("\n\n"),
    problems: [
      {
        title: "Budgets that drift mid-build",
        body: "Time-and-materials quotes start as a range and end as a different number. You are asked to approve more money halfway through with no way to judge whether the extra work is reasonable.",
        icon: "trending-up",
      },
      {
        title: "A brief everyone reads differently",
        body: "You picture one product, the vendor builds another, and the gap surfaces at the end. Ambiguity is cheap to settle on paper and expensive to settle in code.",
        icon: "file-question",
      },
      {
        title: "Silence until a big reveal",
        body: "Months pass with status emails and no product to click. By the time you see it, changing direction means rework you are now paying for.",
        icon: "eye-off",
      },
      {
        title: "A fuzzy finish line",
        body: "The code is on the vendor's hosting, the credentials sit in their password manager and the documentation was always going to come later. “Done” has no checklist.",
        icon: "flag",
      },
    ],
    deliverables: [
      {
        title: "Written scope document",
        body: "Screens, user roles, business rules, integrations, assumptions and explicit non-goals, in plain language your whole team can review.",
        icon: "file-text",
      },
      {
        title: "Firm price and milestones",
        body: "A single price tied to milestones, so you always know what has been delivered against what has been paid.",
        icon: "receipt",
      },
      {
        title: "Weekly working demos",
        body: "A live walkthrough of the real build every week. You click it, you comment, and the feedback lands in the next cycle.",
        icon: "monitor-play",
      },
      {
        title: "Change log for every deviation",
        body: "New ideas become short written changes with their effect on price and date. Nothing moves on a handshake.",
        icon: "git-pull-request",
      },
      {
        title: "Production deployment",
        body: "The product running in the environment you chose, with monitoring basics and a rollback path.",
        icon: "rocket",
      },
      {
        title: "Handover package",
        body: "Repository, environment templates, access map, runbook and a short stabilization window after launch for issues we should have caught.",
        icon: "package-check",
      },
    ],
    steps: [
      {
        title: "Discovery call",
        body: "We ask who uses the product, which systems it touches, what hurts today and what date matters. If fixed price is the wrong shape, we say so here.",
      },
      {
        title: "Written scope in three days",
        body: "We return a scope with milestones, assumptions and a price. You can challenge it, trim it or take it to another vendor.",
      },
      {
        title: "Approval and kickoff",
        body: "Scope and price are locked together. We agree on a shared channel, a demo day and the person on your side who can make decisions.",
      },
      {
        title: "Build with weekly demos",
        body: "Each week ends with working software. Blockers and questions are raised early and recorded against the scope.",
      },
      {
        title: "Launch and handover",
        body: "We cut over, train the people who need it and transfer the code and credentials. A stabilization window covers defects against the agreed scope.",
      },
    ],
    timeline:
      "The scope itself is typically back within three days of the discovery call. Small single-purpose builds often take four to eight weeks after approval, while products with several roles and integrations more commonly run two to four months. Third-party approvals and how quickly your team answers questions move those ranges, so the dates in the written scope are the ones we plan against.",
    techSlugs: ["nextjs", "nodejs", "postgresql", "aws"],
    whoFor: [
      "Teams with a clear deliverable and a real deadline or budget ceiling",
      "Buyers who need a document they can take to finance or another vendor",
      "Operators who want to approve once and then watch progress, not manage it daily",
    ],
    whoNotFor: [
      "Exploratory products where the requirements will change every week",
      "Projects that need to start building before anyone has agreed what “done” means",
      "Teams that want open-ended capacity rather than a defined outcome",
    ],
    relatedPages: [
      { href: "/services/discovery", label: "Discovery: a build-ready scope" },
      { href: "/services/mvp-development", label: "MVP development" },
      { href: "/services/product-retainer", label: "Product retainer after launch" },
    ],
    faq: [
      {
        q: "What happens if the scope turns out to be wrong?",
        a: "If we missed something that was knowable at the time, that is on us and we absorb it. If the world changed or a new requirement appeared, we write a change with its price and date effect and you decide whether to proceed.",
      },
      {
        q: "Can we change our minds during the build?",
        a: "Yes. Swapping a feature for another of similar size is usually straightforward. Adding net-new work is handled as a written change so the price and the schedule stay honest.",
      },
      {
        q: "How do payments work?",
        a: "Invoices follow the milestones in the scope, so each payment lines up with something you have already seen running. The exact schedule and payment methods are confirmed in the proposal.",
      },
      {
        q: "Who owns the code at the end?",
        a: "You do. Source code, documentation and credentials transfer at handover, and the product does not depend on anything we host for you.",
      },
      {
        q: "Is fixed price available for ongoing work?",
        a: "Not really. Ongoing work with a moving backlog fits a product retainer or a dedicated developer better. Many clients start with a fixed-price build and move to a retainer after launch.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 2. dedicated-developers
  // ---------------------------------------------------------------------------
  {
    slug: "dedicated-developers",
    seoTitle: "Dedicated Developers for Hire | Delvix Studio",
    seoDescription:
      "Hire senior dedicated developers who join your repo, tickets and standups. Direct access, monthly flexibility and no lock-in. US, UK, EU and Gulf hours.",
    h1: "Dedicated developers who work inside your team",
    subline:
      "Senior engineers on your repository, your board and your standups. Capacity you direct week to week, without the delay of a hire or the distance of an agency.",
    intro: [
      "Sometimes the plan is clear and the bottleneck is hands. Recruiting a senior engineer takes months, freelancers disappear mid-sprint, and a large agency wraps your backlog in account managers. A dedicated developer from Delvix sits in your tools, reads your codebase, joins your standups and ships against the priorities you set.",
      "You talk to the person writing the code. Up front we agree on the workstream they own, how much time they commit each month and how quality is checked: pull requests reviewed by you or your lead, a short demo of what shipped each week and a written summary at month end so stakeholders are not guessing.",
      "The work lives in your repositories, your project board and your cloud accounts. Nothing is kept in a parallel codebase on our side, so ending the engagement, or turning the developer's knowledge into onboarding for your next full-time hire, is a clean handoff instead of a negotiation.",
    ].join("\n\n"),
    problems: [
      {
        title: "Hiring takes longer than the roadmap",
        body: "A senior search can eat a quarter before anyone writes code. Meanwhile the backlog grows and the launch date slides.",
        icon: "hourglass",
      },
      {
        title: "Freelancers who vanish",
        body: "Solo contractors are fine until they take another contract. Context walks out the door with no one to pick it up.",
        icon: "user-x",
      },
      {
        title: "Agency layers between you and the code",
        body: "Account managers relay questions and answers, details get lost, and you never meet the engineer who made the decision.",
        icon: "layers",
      },
      {
        title: "Knowledge trapped in one head",
        body: "When the only person who understands a module is stretched, every change becomes a risk. Documentation never keeps pace with delivery.",
        icon: "brain",
      },
    ],
    deliverables: [
      {
        title: "Named engineer or small pod",
        body: "You know who is on your project. Changes in staffing are discussed with you in advance, not discovered in a commit log.",
        icon: "user-check",
      },
      {
        title: "Agreed monthly capacity",
        body: "A committed number of days written into the proposal, so planning is predictable on both sides.",
        icon: "calendar-range",
      },
      {
        title: "Onboarding to your codebase",
        body: "Environment running, first pull request merged and the main modules mapped within the opening weeks.",
        icon: "plug",
      },
      {
        title: "Delivery in your tools",
        body: "Your Git host, your tracker, your chat. We adapt to your process rather than bolt on ours.",
        icon: "workflow",
      },
      {
        title: "Weekly demo or review rhythm",
        body: "Something you can see every week, plus code review that keeps standards high and surprises low.",
        icon: "monitor-play",
      },
      {
        title: "Monthly written summary",
        body: "What shipped, what slipped, what is next and what risks we see. Short enough to forward to leadership.",
        icon: "clipboard-list",
      },
    ],
    steps: [
      {
        title: "Define the workstream",
        body: "We agree on the slice of the product the developer owns, the stack involved and what a good first month looks like.",
      },
      {
        title: "Match and confirm",
        body: "We propose an engineer whose experience fits your stack and your pace. You can speak to them before anything is signed.",
      },
      {
        title: "Access and onboarding",
        body: "Repository, staging environment and tracker access are set up with least privilege. The engineer gets the system running and takes a small ticket to production.",
      },
      {
        title: "Run the cadence",
        body: "Standups, pull requests and a weekly demo. Priorities are yours to change as the product teaches you things.",
      },
      {
        title: "Review monthly and adjust",
        body: "Each month we look at what shipped and decide to continue, scale capacity up or down, or wind down with a documented handoff.",
      },
      {
        title: "Hand off or convert",
        body: "When the engagement ends, or turns into a hire of your own, we document open work, record a knowledge walkthrough and remove our access, so the transition leaves your team fully in control.",
      },
    ],
    timeline:
      "Most engagements can start within a couple of weeks of agreeing the workstream, depending on the engineer's availability and how fast we receive repository access. The first merged pull request commonly lands in the first one to two weeks of onboarding. After an initial term set in the proposal, arrangements typically run month to month.",
    techSlugs: ["react", "nodejs", "python", "postgresql", "aws"],
    whoFor: [
      "Product teams with a defined backlog and no hire in place yet",
      "Engineering leads who need a senior pair for a specific workstream",
      "Companies finishing a rescue or MVP who want continuity from the same people",
    ],
    whoNotFor: [
      "Teams with no technical owner to prioritize and review the work",
      "Buyers who want a fixed outcome at a fixed price, which a project contract serves better",
      "Organizations that need round-the-clock on-call platform coverage",
    ],
    relatedPages: [
      { href: "/services/product-retainer", label: "Product retainer" },
      { href: "/services/project-rescue", label: "Project rescue" },
      { href: "/services/technical-consulting", label: "Technical consulting" },
    ],
    faq: [
      {
        q: "How is this different from hiring a freelancer?",
        a: "You get written expectations, a review rhythm, a monthly summary and a team behind the engineer if they are unavailable. The goal is dependable delivery, not just hours on a timesheet.",
      },
      {
        q: "Will the developer work in our time zone?",
        a: "We keep meaningful overlap with US, UK, EU or Gulf hours depending on where you are. Overlap windows are agreed before the engagement starts.",
      },
      {
        q: "Can we meet the person before we commit?",
        a: "Yes. A short conversation with the proposed engineer is part of confirming the match, and we would rather adjust now than after a month of friction.",
      },
      {
        q: "What does access look like and how is it protected?",
        a: "We request only what the workstream needs, use your single sign-on or named accounts where possible and remove access at the end. We sign a mutual NDA before sensitive material is shared.",
      },
      {
        q: "Can we convert the engagement later?",
        a: "Yes. Many teams move from a dedicated developer to a retainer or a fixed-price project once a scope firms up. We write the transition into the next proposal.",
      },
      {
        q: "What if the engineer is unavailable or leaves?",
        a: "We name a backup who is briefed on your project, so illness or leave does not stall delivery. If we must change the engineer permanently, we plan a handover period with you before the switch.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 3. product-retainer
  // ---------------------------------------------------------------------------
  {
    slug: "product-retainer",
    seoTitle: "Software Product Retainer | Delvix Studio",
    seoDescription:
      "A monthly product retainer for fixes, features and upkeep from the team that built it. You set the backlog, we ship with weekly demos. You own the code.",
    h1: "A product retainer that keeps your software moving after launch",
    subline:
      "Agreed monthly capacity for fixes, small features and upkeep from the team that already knows the product. You set the backlog; we keep it healthy and shipping.",
    intro: [
      "Launch day is the start of the expensive part of owning software. Dependencies age, a third-party API changes its terms, support asks for “one small tweak” and users find paths nobody tested. Without someone accountable for the product after go-live, small problems pile up until the next big project becomes a clean-up.",
      "A retainer gives you a standing slice of our team each month. Capacity is agreed in advance, the backlog is yours to reorder and the people doing the work already know why the code looks the way it does. That context is what makes a two-line fix a two-line fix instead of a day of archaeology.",
      "We split the month between three buckets that you can see and steer: keeping the lights on, fixing what users report and building what moves the business forward. Every month you get a short written account of how capacity was used, so the retainer is easy to justify internally and easy to resize.",
    ].join("\n\n"),
    problems: [
      {
        title: "Nobody owns the product after launch",
        body: "The project team has moved on, internal staff are busy elsewhere and bugs wait in an inbox. Users lose patience before anyone triages the report.",
        icon: "user-round-x",
      },
      {
        title: "Upkeep keeps getting postponed",
        body: "Framework upgrades, expiring certificates and vulnerable packages are never urgent until they are an outage. Deferred maintenance compounds.",
        icon: "wrench",
      },
      {
        title: "Every small change needs a new quote",
        body: "A copy change or a new report column turns into a sales conversation. Small wins stall because the overhead outweighs the work.",
        icon: "receipt-text",
      },
      {
        title: "Re-briefing a stranger each time",
        body: "Using a different vendor for each task means paying again to explain the same architecture. Quality varies and context never accumulates.",
        icon: "repeat",
      },
    ],
    deliverables: [
      {
        title: "Reserved monthly capacity",
        body: "An agreed number of days held for your product. You are not queuing behind other clients when something breaks.",
        icon: "calendar-check",
      },
      {
        title: "A backlog you control",
        body: "A shared board where you rank bugs, improvements and ideas. We estimate and flag dependencies, you decide the order.",
        icon: "list-ordered",
      },
      {
        title: "Maintenance and dependency upkeep",
        body: "Scheduled updates to packages, runtimes and certificates, with changes tested before they reach production.",
        icon: "refresh-cw",
      },
      {
        title: "Monitoring and incident follow-up",
        body: "Error tracking and uptime checks set up or reviewed, plus written follow-up when something goes wrong so the same issue does not repeat.",
        icon: "activity",
      },
      {
        title: "Feature work in small slices",
        body: "Improvements shipped in short cycles with a demo, so value arrives continuously instead of in one large release.",
        icon: "puzzle",
      },
      {
        title: "Monthly usage summary",
        body: "How capacity was spent, what was delivered, what is queued and what we recommend next month.",
        icon: "bar-chart-3",
      },
    ],
    steps: [
      {
        title: "Product health check",
        body: "We review the repository, deployment, monitoring and open issues so the first month starts from facts rather than assumptions.",
      },
      {
        title: "Agree capacity and priorities",
        body: "We set monthly capacity, response expectations for urgent issues and the categories of work the retainer covers.",
      },
      {
        title: "Seed and rank the backlog",
        body: "Known bugs, upkeep tasks and growth ideas go onto one board. You rank them and we flag what is risky or larger than it looks.",
      },
      {
        title: "Ship in short cycles",
        body: "Work moves through the backlog with weekly demos. Urgent fixes can jump the queue by agreement.",
      },
      {
        title: "Review and resize",
        body: "Each month we look at the summary together and raise, lower or reshape capacity to match what the product needs.",
      },
      {
        title: "Report and recommend",
        body: "Every month closes with a short report on capacity used, work shipped and risks spotted, plus a recommendation for the following month, so decisions about the retainer rest on evidence.",
      },
    ],
    timeline:
      "A retainer can usually start within a week or two once capacity and scope categories are agreed, with the product health check taking a few days. Initial terms are often a few months, after which the arrangement commonly continues month to month. Response targets for urgent issues are written into the proposal rather than implied.",
    techSlugs: ["nextjs", "nodejs", "postgresql", "aws"],
    whoFor: [
      "Teams that just launched and need an accountable partner for the first year of real usage",
      "Businesses running a custom internal system that has no in-house engineer",
      "Founders who want steady product progress without managing contractors",
    ],
    whoNotFor: [
      "Products with no live users or no backlog yet, where a project or MVP fits better",
      "Teams expecting unlimited changes for a flat monthly fee",
      "Companies that require a contractual twenty-four-hour on-call service",
    ],
    relatedPages: [
      { href: "/services/dedicated-developers", label: "Dedicated developers" },
      { href: "/services/fixed-price-projects", label: "Fixed-price projects" },
      { href: "/services/legacy-modernization", label: "Legacy modernization" },
    ],
    faq: [
      {
        q: "Do you take over software someone else built?",
        a: "Often, yes. We begin with a health check of the code, deployment and open issues, and tell you plainly what is sound and what needs attention before we commit to a capacity.",
      },
      {
        q: "What counts as urgent and how fast do you respond?",
        a: "We define severity levels and target response times together and write them into the proposal. We do not promise round-the-clock coverage unless it is specifically agreed.",
      },
      {
        q: "What happens to unused capacity?",
        a: "How unused days are treated, whether carried forward within limits or released, is spelled out in the proposal so nobody argues about it later.",
      },
      {
        q: "Can we pause or end the retainer?",
        a: "Yes, after the initial term, with notice stated in the agreement. You keep the code, documentation and access throughout, so stopping never leaves you stranded.",
      },
      {
        q: "Can larger features be handled under the retainer?",
        a: "Small and medium slices fit well. For a large new module we usually scope it separately as a fixed-price project so the budget and dates are explicit.",
      },
      {
        q: "Will you work alongside our internal team?",
        a: "Yes. A retainer often sits beside in-house staff and picks up the work they have no time for. We use your repositories, tracker and review process, and agree on who owns which areas of the code.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 4. project-rescue
  // ---------------------------------------------------------------------------
  {
    slug: "project-rescue",
    seoTitle: "Software Project Rescue & Recovery | Delvix Studio",
    seoDescription:
      "Stalled or late software build? We audit the code, give an honest salvage-or-rewrite call and stabilize it to launch. Fixed-price review, weekly demos.",
    h1: "Project rescue for software that stalled, slipped or got abandoned",
    subline:
      "Get an honest read on what you have, a clear salvage-or-rewrite recommendation and a stabilization sprint that gets you to a launch you can defend.",
    intro: [
      "A failing project rarely looks like a failure at first. It looks like a missed milestone, a demo that was postponed, a developer who is suddenly hard to reach. By the time you are thinking about a rescue, you probably have partly built code, a budget that is already spent and a lot of stakeholders asking for a date.",
      "We start with a fixed-price review rather than a promise. In a short, bounded engagement we read the repositories, run the build, check the deployment path, look at how secrets and data are handled and compare what exists with what was promised. You receive a written memo with the real state of “done”, the risks, and a recommendation: salvage, partial rewrite or start fresh.",
      "If salvage makes sense, we run a stabilization sprint aimed at the blockers that stop launch, with demos every week so you can see recovery rather than take our word for it. If the honest answer is that the foundation cannot ship, we will say so and give you the memo to take wherever you like.",
    ].join("\n\n"),
    problems: [
      {
        title: "A build with no working demo",
        body: "Weeks of updates, yet nothing you can open and click. You cannot tell whether the project is nearly there or nowhere close.",
        icon: "monitor-off",
      },
      {
        title: "Code nobody can explain",
        body: "No documentation, no tests, and the original authors are gone or defensive. Every estimate to continue is padded with fear.",
        icon: "file-code",
      },
      {
        title: "Blocked at the last mile",
        body: "Features exist but deployment, authentication, data migration or payments are broken. The launch date keeps slipping on infrastructure, not design.",
        icon: "construction",
      },
      {
        title: "No independent opinion",
        body: "The vendor says it needs another three months, and you have no way to verify it. Another sales pitch will not fix the information gap.",
        icon: "scale",
      },
    ],
    deliverables: [
      {
        title: "Audit memo",
        body: "Architecture, code quality, test coverage, security hygiene and deployment readiness, written for both engineers and executives.",
        icon: "file-search",
      },
      {
        title: "Salvage versus rewrite recommendation",
        body: "A reasoned call with trade-offs and cost ranges. We prefer salvage when the foundation can carry the product, and say so when it cannot.",
        icon: "git-compare",
      },
      {
        title: "Prioritized stabilization backlog",
        body: "The defects and gaps that block launch, ordered by what unblocks you fastest, with the rest parked deliberately.",
        icon: "list-checks",
      },
      {
        title: "Revised launch plan",
        body: "A realistic plan with milestones and dependencies, built from what we found rather than what was previously promised.",
        icon: "map",
      },
      {
        title: "Access and knowledge transfer",
        body: "A map of repositories, hosting accounts, domains, third-party services and credentials, moved under your control.",
        icon: "key-round",
      },
      {
        title: "Runbooks and handover notes",
        body: "How to build, deploy, roll back and debug the system, so your next team does not start from zero.",
        icon: "book-open-check",
      },
    ],
    steps: [
      {
        title: "Triage call",
        body: "You describe what was promised, what exists and where trust broke down. We confirm whether a review is worth doing and what access we need.",
      },
      {
        title: "Fixed-price review",
        body: "We audit the code, environments and process within a bounded timeframe, so the cost of finding out is known before it starts.",
      },
      {
        title: "Findings and decision",
        body: "We walk you through the memo and the recommendation. You can stop there with a document you own, or continue with us.",
      },
      {
        title: "Stabilization sprint",
        body: "We fix the launch blockers first: authentication, data integrity, deployment, critical defects. Demos show progress each week.",
      },
      {
        title: "Launch, transition or continue",
        body: "We take the remaining milestones through launch, hand the project to your next team with full documentation, or continue on a retainer.",
      },
      {
        title: "Prevent the next rescue",
        body: "We put basic guardrails in place so the project does not slip again: a written scope, weekly demos, a deployment pipeline and ownership of every account, whoever builds the remainder.",
      },
    ],
    timeline:
      "A review is often completed in about one to two weeks once we have repository and environment access, depending on the size of the codebase. Stabilization sprints commonly run two to six weeks, and complete rewrites, if they are warranted, are scoped separately with their own timeline. Access delays from the previous vendor are the most common source of slippage.",
    techSlugs: ["nextjs", "react", "nodejs", "postgresql", "react-native", "python"],
    whoFor: [
      "Founders mid-build who no longer trust the delivery status they are getting",
      "Teams that inherited a codebase with no documentation or original authors",
      "Buyers who want an independent second opinion before spending on a rewrite",
    ],
    whoNotFor: [
      "Projects where the real problem is an undefined product, not broken delivery",
      "Teams hoping for a guaranteed save of a codebase before anyone has looked at it",
      "Situations that need legal dispute support with a former vendor, which is outside our scope",
    ],
    relatedPages: [
      { href: "/services/discovery", label: "Discovery to reset the scope" },
      { href: "/services/legacy-modernization", label: "Legacy modernization" },
      { href: "/services/dedicated-developers", label: "Dedicated developers" },
    ],
    faq: [
      {
        q: "Will you recommend a rewrite to get more work?",
        a: "We would rather not. The review is fixed price, so we have no incentive to inflate findings. We recommend salvage whenever the foundation can ship and a rewrite only when it clearly cannot.",
      },
      {
        q: "What if the previous vendor will not hand over access?",
        a: "We start with what you legally own and help you reclaim repositories, domains and cloud accounts. If critical access is blocked, we report that as a risk rather than guess around it.",
      },
      {
        q: "Do you need to work with our existing stack?",
        a: "Usually yes. If a stack is outside what we can support well, we tell you during the review instead of learning on your budget.",
      },
      {
        q: "Can the review be used with another team?",
        a: "Yes. The memo and backlog are yours. Plenty of buyers use them to brief a new vendor or their own engineers.",
      },
      {
        q: "How do you keep a rescue from becoming open-ended?",
        a: "Stabilization is scoped as a sprint with a defined list of blockers and weekly demos. Anything beyond that list is a separate decision you make with the facts in front of you.",
      },
      {
        q: "How much does a rescue cost?",
        a: "The review is a fixed price confirmed before it starts. Stabilization is scoped as a sprint after the findings, and a full rebuild, if needed, is priced separately. We will not quote a rescue before we have seen the code.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 5. technical-consulting
  // ---------------------------------------------------------------------------
  {
    slug: "technical-consulting",
    seoTitle: "Technical Consulting & Architecture | Delvix Studio",
    seoDescription:
      "Independent technical consulting: architecture reviews, stack and vendor decisions, and build-versus-buy advice you can act on. Written deliverables.",
    h1: "Technical consulting for decisions that are expensive to reverse",
    subline:
      "Architecture reviews, stack choices and build-versus-buy calls from engineers who ship. You get a written recommendation, not a slide deck of options.",
    intro: [
      "The most costly software mistakes are made before anyone opens an editor: picking a platform that cannot scale with the business, accepting a vendor quote built on guesses, or committing to a rewrite when a focused fix would do. Technical consulting is for the moment when you need someone knowledgeable and independent to look at the choice with you.",
      "Our consulting is practical. We read your code or your requirements, talk to the people who run the system, and write a recommendation with the reasoning visible: what we would do, what we would avoid, what is uncertain and what it would cost to be wrong. If the best advice is to buy a product off the shelf, or to leave the system alone, that is what the report says.",
      "Engagements are short and bounded, usually a few days to a few weeks. You can use the output to brief your own engineers, evaluate competing proposals or decide whether to continue with us. We do not make advice conditional on a build contract.",
    ].join("\n\n"),
    problems: [
      {
        title: "Competing proposals you cannot compare",
        body: "Three vendors quote three different architectures at three different prices, and none of them explains the trade-offs in terms you can weigh.",
        icon: "columns-3",
      },
      {
        title: "A stack chosen by whoever was available",
        body: "Early shortcuts hardened into the foundation. Now each new feature fights the architecture and nobody is sure whether to patch or replace.",
        icon: "blocks",
      },
      {
        title: "Build-versus-buy paralysis",
        body: "Every off-the-shelf tool does eighty percent and every custom build sounds expensive. Without a framework, the decision drifts for months.",
        icon: "split",
      },
      {
        title: "Risk you cannot see yet",
        body: "Security gaps, scaling cliffs, single points of failure and vendor lock-in are invisible until the day they matter, which is the worst day to find them.",
        icon: "alert-triangle",
      },
    ],
    deliverables: [
      {
        title: "Written recommendation",
        body: "A clear position on the decision, with the reasoning, assumptions and unknowns laid out so your team can challenge it.",
        icon: "file-pen",
      },
      {
        title: "Architecture review",
        body: "A look at structure, data model, integrations, deployment and failure modes, with findings ranked by consequence.",
        icon: "network",
      },
      {
        title: "Build-versus-buy analysis",
        body: "Candidate products and custom options compared against your actual workflow, including integration cost and exit options.",
        icon: "scale",
      },
      {
        title: "Vendor proposal review",
        body: "A line-by-line read of another vendor's estimate or statement of work, flagging gaps, hidden assumptions and unrealistic dates.",
        icon: "search-check",
      },
      {
        title: "Risk register",
        body: "Security, scalability, operational and dependency risks with a suggested response for each, in plain language.",
        icon: "shield-alert",
      },
      {
        title: "Roadmap and next steps",
        body: "A sequenced plan for what to do first, what to defer and what to stop doing, sized so you can budget it.",
        icon: "route",
      },
    ],
    steps: [
      {
        title: "Frame the question",
        body: "We agree on the exact decision at stake, who it affects, what constraints are fixed and what a useful answer looks like.",
      },
      {
        title: "Gather evidence",
        body: "We read the code, documents and proposals, and speak with the engineers, operators and stakeholders who know where the problems are.",
      },
      {
        title: "Analyze options",
        body: "We compare realistic options against your constraints, including doing nothing, and test the riskiest assumptions with small experiments where needed.",
      },
      {
        title: "Present the recommendation",
        body: "A live walkthrough of the findings with time for challenge, followed by the written document.",
      },
      {
        title: "Support the decision",
        body: "We answer follow-up questions while you decide, and can help brief your team or another vendor if you proceed elsewhere.",
      },
      {
        title: "Revisit when facts change",
        body: "Assumptions shift as vendors reply and budgets move. We offer a short follow-up review once you have acted, to check whether the recommendation still holds and whether early results match what we expected.",
      },
    ],
    timeline:
      "A focused question, such as reviewing a vendor proposal or comparing two platforms, often takes a few days. A full architecture review of an existing system more commonly takes one to three weeks depending on size and access. We confirm the timeframe and fee before starting so the advice itself has no open-ended meter running.",
    techSlugs: ["nextjs", "nodejs", "postgresql", "aws", "python", "openai"],
    whoFor: [
      "Leaders comparing vendor proposals who need an independent technical read",
      "Founders choosing a stack or platform before committing to a build",
      "Teams weighing a rewrite against incremental fixes on an existing system",
    ],
    whoNotFor: [
      "Buyers who want us to execute immediately rather than decide first",
      "Teams looking for a rubber stamp on a decision already made",
      "Organizations that need legal, tax or regulatory opinions we are not qualified to give",
    ],
    relatedPages: [
      { href: "/services/discovery", label: "Discovery" },
      { href: "/services/project-rescue", label: "Project rescue" },
      { href: "/services/legacy-modernization", label: "Legacy modernization" },
    ],
    faq: [
      {
        q: "Do you have to win the build to give advice?",
        a: "No. Consulting is priced and delivered on its own. Our recommendations are not conditional on a build contract, and the report is yours to use with anyone.",
      },
      {
        q: "Will you review code from another vendor?",
        a: "Yes. We read it under NDA and give an honest assessment, including what is well done. We do not manufacture problems to justify a rewrite.",
      },
      {
        q: "Can you review a proposal we received?",
        a: "Yes. Send the estimate or statement of work and your requirements, and we will flag unclear assumptions, missing pieces and dates that look optimistic.",
      },
      {
        q: "What access do you need?",
        a: "Read-only access to the repository and documentation is usually enough, plus conversations with the people who run the system. We avoid production credentials unless the question demands them.",
      },
      {
        q: "Is the output only advice, or can you help carry it out?",
        a: "The deliverable is advice. If you want help executing, we can scope that separately as a project, retainer or dedicated developer engagement, but there is no obligation.",
      },
      {
        q: "Can you work with non-technical decision makers?",
        a: "Yes. Findings are written for executives first and engineers second, with a plain-language summary at the top and the technical detail underneath for anyone who wants to check our reasoning.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 6. web-applications
  // ---------------------------------------------------------------------------
  {
    slug: "web-applications",
    seoTitle: "Custom Web Application Development | Delvix Studio",
    seoDescription:
      "Custom web applications, portals and internal tools built around your workflow. Fixed scope, weekly demos, you own the code. Remote, US/UK/EU/Gulf hours.",
    h1: "Custom web applications your team and customers will actually use",
    subline:
      "Portals, dashboards and internal tools designed around how work really happens. Scope in writing, working software every week, source code yours.",
    intro: [
      "Most operational businesses run on a patchwork: a master spreadsheet, a shared inbox, a SaaS tool configured past its limits and a person who remembers how it all fits together. It works until that person is away, a customer asks where their order is, or the numbers in two places disagree. A custom web application replaces the patchwork with one place where the work is recorded and the right people see the right slice.",
      "We start by mapping the real workflow, including the unofficial steps staff invented to cope. Then we design the screens, roles and rules around it. Staff who live in the tool all day get dense, fast views. Customers and partners get simple, self-service ones. Both sit on one API, one database and one permission model.",
      "We build with Next.js, React, Node.js and PostgreSQL by default because that combination is productive, well supported and easy to hand to another engineer. If you have an existing stack or hosting constraint, we work with it. Either way the repository, deployment scripts and documentation are yours from day one.",
    ].join("\n\n"),
    problems: [
      {
        title: "The spreadsheet that runs the business",
        body: "One person's file is the real system of record. It breaks on concurrent edits, hides errors and cannot show customers anything safely.",
        icon: "table-2",
      },
      {
        title: "Customers calling for status",
        body: "Every “where is my order” call is work your team repeats because there is no portal that already holds the answer.",
        icon: "phone-incoming",
      },
      {
        title: "Tools that do not talk to each other",
        body: "Data is re-keyed between CRM, billing and operations, so errors multiply and reports disagree depending on who builds them.",
        icon: "unplug",
      },
      {
        title: "Everyone sees everything, or nothing",
        body: "Without proper roles and audit trails, you either lock people out of what they need or expose what they should not see.",
        icon: "lock-keyhole",
      },
    ],
    deliverables: [
      {
        title: "Role-based web application",
        body: "Sign-in, permissions and screens for each type of user, from administrators to external customers.",
        icon: "users",
      },
      {
        title: "Workflow and data model",
        body: "The core records, statuses and rules of your operation encoded once, so reports and screens agree.",
        icon: "database",
      },
      {
        title: "API and integrations",
        body: "A documented API plus connectors to the systems you already pay for, with failures logged and visible.",
        icon: "plug-zap",
      },
      {
        title: "Dashboards and exports",
        body: "Saved views, filters and CSV or PDF exports built from the same data staff use daily.",
        icon: "layout-dashboard",
      },
      {
        title: "Audit trail and admin console",
        body: "Who changed what and when, plus the tools your administrators need to manage users without asking an engineer.",
        icon: "scroll-text",
      },
      {
        title: "Deployment and handover",
        body: "A production environment, environment templates, runbook and a stabilization window after launch.",
        icon: "cloud-upload",
      },
    ],
    steps: [
      {
        title: "Map the workflow",
        body: "We sit with the people who use the current process and document each step, handoff and workaround before designing anything.",
      },
      {
        title: "Write the scope",
        body: "Roles, screens, rules, integrations and non-goals go into a document you approve. A price and milestones come with it.",
      },
      {
        title: "Design the core flows",
        body: "We prototype the paths staff use most so you can react to something concrete before engineering starts in earnest.",
      },
      {
        title: "Build in weekly increments",
        body: "Each week you get a demo of working features running on real data structures, with feedback folded into the next cycle.",
      },
      {
        title: "Launch and train",
        body: "We migrate the data you need, cut over on an agreed date, train the team and monitor closely through the first weeks.",
      },
      {
        title: "Stabilize and support",
        body: "A stabilization window follows go-live for defects against the agreed scope. After that you can continue with a retainer, start a new project or hand the code to your own team using our documentation.",
      },
    ],
    timeline:
      "A focused internal tool or portal commonly takes six to twelve weeks from approved scope. Larger applications with many roles, integrations or data migration more often take three to six months, sometimes staged into releases. Third-party access, data quality and how quickly decisions are made on your side have the biggest effect on these ranges.",
    techSlugs: ["nextjs", "react", "nodejs", "postgresql", "aws"],
    relatedCaseStudySlug: "revenue-os",
    whoFor: [
      "Operations teams whose core process still lives in spreadsheets and chat threads",
      "Businesses that want a client or partner portal to cut status calls",
      "Product owners who need a real, maintainable web product rather than a prototype",
    ],
    whoNotFor: [
      "Simple brochure sites, which our website development service handles better",
      "Teams whose workflow is not yet defined and needs discovery first",
      "Buyers looking for a no-code build they plan to maintain themselves",
    ],
    relatedPages: [
      { href: "/services/saas-development", label: "SaaS development" },
      { href: "/services/automation-integrations", label: "Automation and integrations" },
      { href: "/services/mobile-apps", label: "Mobile apps" },
    ],
    faq: [
      {
        q: "Can the app work with our existing database or systems?",
        a: "Often, yes. We review what you have during scoping and decide whether to integrate, migrate or replace each piece. The choice and its trade-offs go into the written scope.",
      },
      {
        q: "Will it be mobile-friendly?",
        a: "Yes. Screens are built to work on phones and tablets as well as desktops. If your field team needs camera, offline or push features, a dedicated mobile app may be the better fit.",
      },
      {
        q: "Who hosts it?",
        a: "Wherever you choose. We commonly deploy to your own AWS account so ownership is clear, and we document everything required to move or operate it.",
      },
      {
        q: "Can you work with our designer?",
        a: "Yes. We can implement from your designer's files or design the interface ourselves after the scope is approved.",
      },
      {
        q: "What about security and user data?",
        a: "We build in role-based access, encrypted secrets and audit logging where the scope calls for them, and we handle customer-supplied URLs and uploads with explicit safeguards. Details are written into the scope.",
      },
      {
        q: "Can the application become a SaaS product later?",
        a: "Often, yes, if multi-tenancy is planned. We ask during scoping whether you may sell it to others one day, because tenancy and billing are far cheaper to design in than to retrofit.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 7. mobile-apps
  // ---------------------------------------------------------------------------
  {
    slug: "mobile-apps",
    seoTitle: "Mobile App Development for iOS & Android | Delvix Studio",
    seoDescription:
      "iOS and Android apps for field teams and customers, built with React Native or Flutter on a shared API. Fixed scope, weekly device demos, code yours.",
    h1: "Mobile apps built for the job on site and the customer on the go",
    subline:
      "iOS and Android apps with offline-tolerant capture, push alerts and one shared backend with your web product. Tested on real phones every week.",
    intro: [
      "A desktop site squeezed onto a phone screen is not a mobile strategy. Drivers need to capture a delivery photo with gloves on. Inspectors need a checklist that works in a basement with no signal. Customers want a booking confirmed with a tap and a reminder that actually arrives. These are phone-first jobs and they deserve phone-first design.",
      "We scope mobile work around the moment of use: what has to work offline, what has to sync and when, what can wait until there is a connection. Those decisions drive the architecture, so we write them down before building. The app then shares authentication and data with your existing web product through one API, so mobile and web do not drift into two versions of the truth.",
      "We default to cross-platform builds with React Native or Flutter so one team ships iOS and Android together. When a device feature or store requirement demands native code, we flag it early. Your Apple and Google developer accounts own the listings, and we prepare the builds, release notes and checklist for submission.",
    ].join("\n\n"),
    problems: [
      {
        title: "Paper and photos that never reach the system",
        body: "Field staff write on forms, snap pictures into personal chats and the office retypes everything later, if it arrives at all.",
        icon: "camera-off",
      },
      {
        title: "Apps that fail without signal",
        body: "Warehouses, basements and rural routes have patchy coverage. An app that needs a connection to save work gets abandoned in the first week.",
        icon: "wifi-off",
      },
      {
        title: "Notifications nobody receives",
        body: "Dispatch changes, appointment reminders and approvals get lost in email. Without reliable push, the phone is just a smaller inbox.",
        icon: "bell-off",
      },
      {
        title: "Two backends for one product",
        body: "A mobile app built separately from the web product doubles the maintenance and creates mismatches in accounts, permissions and data.",
        icon: "copy",
      },
    ],
    deliverables: [
      {
        title: "iOS and Android apps",
        body: "A cross-platform codebase producing store-ready builds for both platforms, sharing logic and design wherever sensible.",
        icon: "smartphone",
      },
      {
        title: "Offline and sync design",
        body: "Local queues, conflict rules and a clear picture of what happens when work is saved without a connection.",
        icon: "refresh-ccw",
      },
      {
        title: "Push notifications",
        body: "Alerts for jobs, status changes and reminders, with preferences users can control.",
        icon: "bell-ring",
      },
      {
        title: "Device features",
        body: "Camera, document capture, signatures, location and barcode scanning, included where the job actually needs them.",
        icon: "scan-line",
      },
      {
        title: "Shared API contract",
        body: "A documented interface shared with your web product, so a change in one place does not silently break the other.",
        icon: "file-json",
      },
      {
        title: "Store release package",
        body: "Internal test tracks, version management, release notes and a submission checklist for the App Store and Google Play.",
        icon: "store",
      },
    ],
    steps: [
      {
        title: "Define the moment of use",
        body: "We observe or interview the people who will use the app and capture where they are, what they carry and what connection they have.",
      },
      {
        title: "Write the mobile scope",
        body: "Supported devices and OS versions, offline behavior, permissions, notifications and non-goals, together with price and milestones.",
      },
      {
        title: "Design and prototype",
        body: "Tap-through prototypes on real phones for the critical flows, validated with a few of the actual users before full build.",
      },
      {
        title: "Build with device demos",
        body: "Each week you receive a test build through TestFlight or Google Play internal testing and try it on your own phone.",
      },
      {
        title: "Pilot, release and hand over",
        body: "A small pilot group uses the app first. We then prepare store submissions with you and hand over the code, accounts map and release process.",
      },
      {
        title: "Plan the update path",
        body: "We document how new versions are built, tested and submitted, including forced updates and breaking API changes, so the app keeps working as operating systems and your backend evolve.",
      },
    ],
    timeline:
      "A focused app with a handful of workflows and an existing API often takes eight to fourteen weeks from approved scope. Apps that need a new backend, complex offline sync or heavy device integration generally take longer. Store review times are controlled by Apple and Google and can add days to a release, so we plan for them instead of promising dates they control.",
    techSlugs: ["react-native", "flutter", "nodejs", "postgresql", "aws"],
    whoFor: [
      "Businesses with drivers, inspectors or crews who currently work from paper and chat",
      "Products with a web platform that now need a customer-facing phone experience",
      "Teams that need push, camera or offline behavior a mobile website cannot deliver",
    ],
    whoNotFor: [
      "Products where a responsive web app would serve users just as well",
      "Games or graphics-heavy experiences that need specialized native engines",
      "Buyers who want an app published under our accounts rather than their own",
    ],
    relatedPages: [
      { href: "/services/web-applications", label: "Web applications" },
      { href: "/services/mvp-development", label: "MVP development" },
      { href: "/services/automation-integrations", label: "Automation and integrations" },
    ],
    faq: [
      {
        q: "React Native or Flutter?",
        a: "We choose based on your team and the product. React Native fits well if you already use React on the web, while Flutter suits highly custom interfaces. We explain the trade-offs in the scope.",
      },
      {
        q: "Do you publish the app for us?",
        a: "We prepare the builds and guide you through submission, but the App Store and Google Play listings live in your developer accounts so you keep full control.",
      },
      {
        q: "Can the app work offline?",
        a: "Yes, when the scope says so. We design the local storage, sync order and conflict handling explicitly, because offline support added late tends to be unreliable.",
      },
      {
        q: "Do you need our existing backend?",
        a: "Not necessarily. We can connect to your current API, extend it or build a new one. The mobile scope states which approach is used and what changes on the server side.",
      },
      {
        q: "What about updates after launch?",
        a: "Operating system updates and store policy changes are routine. Many clients keep a retainer so the app stays compatible and improvements ship in small releases.",
      },
      {
        q: "Which devices and OS versions will it support?",
        a: "We agree a device matrix in the scope based on who actually uses the app, typically the current and previous major versions of iOS and Android. Supporting older devices costs more, so we decide it deliberately.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 8. erp-development
  // ---------------------------------------------------------------------------
  {
    slug: "erp-development",
    seoTitle: "Custom ERP Software Development | Delvix Studio",
    seoDescription:
      "Custom ERP built around how you stock, produce and deliver. Replace spreadsheets and rigid suites with one system. Fixed scope, code yours.",
    h1: "Custom ERP software shaped around how you actually run operations",
    subline:
      "Inventory, orders, jobs and finance handoffs in one system your staff will use. No unused modules, no process bent to fit a vendor's defaults.",
    intro: [
      "Enterprise resource planning promises one system for the whole operation. In practice many mid-sized businesses buy a suite built for someone else's process, pay for modules nobody opens, and keep a shadow spreadsheet next to the official system because it matches how work really goes. The gap between the software and the shop floor becomes a standing cost.",
      "A custom ERP closes that gap by starting from your process. We model the entities that matter to you, whether that is stock across warehouses, work orders, purchase approvals or production batches, and encode the rules that govern them. Screens are designed for the people who handle those records all day, and reports come from the same data as everyday work.",
      "We do not insist on replacing everything. Often the best design keeps your accounting package, a payment provider or a shipping tool and connects them cleanly. We write the boundary between old and new into the scope, plan the data migration as its own milestone and make sure you can export your data at any time.",
    ].join("\n\n"),
    problems: [
      {
        title: "Modules you pay for and never use",
        body: "A suite licensed by feature count leaves most of its capability idle while the workflows you actually need are awkward or missing.",
        icon: "package-x",
      },
      {
        title: "Stock numbers nobody trusts",
        body: "Counts differ between the warehouse, the shop and the sheet. Orders are accepted for items that are not there.",
        icon: "boxes",
      },
      {
        title: "The shadow spreadsheet",
        body: "Staff keep a private file because the system cannot represent a rule that matters. Reports then depend on whose file you ask for.",
        icon: "file-spreadsheet",
      },
      {
        title: "Approvals that live in chat",
        body: "Purchase requests, discounts and exceptions are approved in messages, leaving no audit trail and no way to find the decision later.",
        icon: "message-square-warning",
      },
    ],
    deliverables: [
      {
        title: "Process map and data model",
        body: "A documented view of how goods, jobs and money move through your business, translated into a structure the system enforces.",
        icon: "git-fork",
      },
      {
        title: "Core operational modules",
        body: "Inventory, purchasing, orders, work orders or production, selected and sized to your operation rather than a catalog.",
        icon: "boxes",
      },
      {
        title: "Roles, approvals and audit",
        body: "Permissions and approval chains that mirror your organization, with a record of every significant change.",
        icon: "badge-check",
      },
      {
        title: "Reporting you can rely on",
        body: "Operational and management reports from live data, with saved views and exports for finance and leadership.",
        icon: "chart-no-axes-combined",
      },
      {
        title: "Integrations with finance and channels",
        body: "Connections to accounting, shipping, payments and sales channels where their APIs allow, with failures reported not hidden.",
        icon: "link",
      },
      {
        title: "Migration and cutover plan",
        body: "Field mappings, trial imports, reconciliation checks and a go-live schedule so you do not run two systems indefinitely.",
        icon: "arrow-right-left",
      },
    ],
    steps: [
      {
        title: "Process mapping workshops",
        body: "We walk through a day in the warehouse, the office and the finance team and write down every record, rule and exception.",
      },
      {
        title: "Replace-or-keep analysis",
        body: "For each area we decide what to build, what to integrate and what to leave alone, and explain the reasoning.",
      },
      {
        title: "Scoped build in phases",
        body: "The ERP is delivered module by module with demos each week, so the first workflow can go live before the last is finished.",
      },
      {
        title: "Data migration rehearsals",
        body: "We load your data into the new system several times, reconciling against the old one until the numbers match.",
      },
      {
        title: "Cutover and hypercare",
        body: "We agree on a go-live window, train each team and stay close during the first weeks of live operation.",
      },
      {
        title: "Document and train",
        body: "Each team gets role-specific guides and a short training session on its own workflows, plus an administrator handbook, so the system survives staff changes and does not depend on one person's memory.",
      },
    ],
    timeline:
      "A first operational phase covering a few core workflows commonly takes three to five months from approved scope. Broader ERP scope across several departments is usually phased over six to twelve months or more. Data quality and the number of integrations are the main variables, so migration rehearsals are scheduled as explicit milestones.",
    techSlugs: ["nextjs", "nodejs", "postgresql", "python", "aws"],
    whoFor: [
      "Distributors, manufacturers and service firms whose process does not fit a standard suite",
      "Operators migrating off a spreadsheet-driven back office",
      "Businesses that want to keep their accounting tool but replace the operations layer around it",
    ],
    whoNotFor: [
      "Companies whose process is standard enough that an off-the-shelf product would serve them well",
      "Teams that expect to replace every system in a single go-live weekend",
      "Organizations that need certified financial or regulatory modules we cannot provide",
    ],
    relatedPages: [
      { href: "/services/crm-development", label: "CRM development" },
      { href: "/services/automation-integrations", label: "Automation and integrations" },
      { href: "/services/legacy-modernization", label: "Legacy modernization" },
    ],
    faq: [
      {
        q: "Will you replace our accounting software?",
        a: "Usually not. We would rather integrate with the accounting tool your finance team already trusts and replace the operational layers that do not fit. If a replacement is truly warranted, we explain why.",
      },
      {
        q: "How do you handle data migration?",
        a: "We map your fields, clean what needs cleaning, run trial imports and reconcile totals against the old system before going live. Migration is its own milestone with its own checks.",
      },
      {
        q: "Can the ERP grow as we do?",
        a: "Yes. We deliver in phases and design the data model for extension. Additional modules can be scoped later as projects or handled through a retainer.",
      },
      {
        q: "Are we locked in to you?",
        a: "No. You own the code, the database and the credentials. Documentation and export tools mean another team can take over if you ever choose.",
      },
      {
        q: "Do you handle multi-currency, tax or compliance rules?",
        a: "We can implement the rules your business needs with your accountant's guidance. We are not a certified compliance vendor, so we state what we can and cannot cover in the scope.",
      },
      {
        q: "What if only one department is ready at first?",
        a: "That is common. We go live department by department, starting where the pain and the readiness are highest, and connect modules as they arrive so early wins are not blocked by the slowest team.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 9. crm-development
  // ---------------------------------------------------------------------------
  {
    slug: "crm-development",
    seoTitle: "Custom CRM Development Services | Delvix Studio",
    seoDescription:
      "Custom CRM built around how your team sells and follows up. Replace spreadsheets or bloated tools with a pipeline people use. Fixed scope, code yours.",
    h1: "Custom CRM development built around how your team really sells",
    subline:
      "A pipeline your sales and account teams will keep up to date, with follow-ups that happen and reports leadership trusts. Built to your sales motion, not a template.",
    intro: [
      "A CRM only works if people use it, and people only use it if it matches how they sell. Generic tools ask a rep to fill in twenty fields for a deal that really needs three, then bury the next action behind menus. The result is stale data, forgotten follow-ups and a forecast that is really a guess.",
      "We design CRMs from the sales motion outward. We learn how leads arrive, who qualifies them, what the stages actually mean, how quotes and approvals work and what happens after a deal is won. The system captures only what the team needs, makes the next step obvious and reminds people before a lead goes cold.",
      "Because the CRM is custom, it can connect to the rest of your business without awkward workarounds. A signed proposal can create a project, a paid invoice can update the account, and website enquiries can land as structured opportunities with duplicates handled. You keep ownership of the data, with exports and an API from day one.",
    ].join("\n\n"),
    problems: [
      {
        title: "Leads lost between handoffs",
        body: "Enquiries arrive by form, email and phone, and no one owns the first response. By the time someone looks, the buyer has talked to a competitor.",
        icon: "user-minus",
      },
      {
        title: "A CRM nobody updates",
        body: "Reps avoid a tool that adds admin without helping them sell. The data goes stale and managers rebuild the pipeline from conversation.",
        icon: "clipboard-x",
      },
      {
        title: "A forecast built on guesses",
        body: "Stage definitions differ per rep, so the pipeline total tells you very little about what will actually close.",
        icon: "line-chart",
      },
      {
        title: "Sales and delivery out of sync",
        body: "Promises made in the deal never reach the people who deliver. Onboarding starts with questions the customer already answered.",
        icon: "git-branch",
      },
    ],
    deliverables: [
      {
        title: "Pipeline and stage model",
        body: "Stages with clear entry and exit criteria that reflect your real sales process, with different pipelines where your offers differ.",
        icon: "kanban",
      },
      {
        title: "Lead capture and routing",
        body: "Web forms, email and manual entry normalized into one inbox, with deduplication and assignment rules.",
        icon: "inbox",
      },
      {
        title: "Tasks, reminders and sequences",
        body: "Next actions scheduled automatically, with nudges for deals that are stalling and templates for common follow-ups.",
        icon: "alarm-clock",
      },
      {
        title: "Quotes, proposals and approvals",
        body: "Reusable line items and an approval flow for discounts, so pricing decisions are recorded and consistent.",
        icon: "file-signature",
      },
      {
        title: "Dashboards for reps and leaders",
        body: "A personal view of today's priorities for each rep and an honest pipeline view for management.",
        icon: "gauge",
      },
      {
        title: "Integrations and data portability",
        body: "Email, calendar, billing and delivery tools connected where APIs allow, plus full export and a documented API.",
        icon: "plug",
      },
    ],
    steps: [
      {
        title: "Sales process interviews",
        body: "We speak with reps, managers and the delivery team and trace a handful of real deals from first contact to handover.",
      },
      {
        title: "Define data and stages",
        body: "We agree on the fields that matter, what each stage means and who owns each transition, and write it into the scope.",
      },
      {
        title: "Build the core pipeline first",
        body: "Lead capture, pipeline board and tasks go live early with a small pilot group, so real usage shapes the rest.",
      },
      {
        title: "Migrate and connect",
        body: "We import contacts and open deals from your sheets or current tool, then wire up email, billing and delivery integrations.",
      },
      {
        title: "Roll out and refine",
        body: "We train the team, watch adoption and adjust fields and views in the first weeks based on what people do, not what we expected.",
      },
      {
        title: "Measure adoption",
        body: "We review usage after the first weeks, such as which fields are skipped and which views are used, and trim or reshape the system so it earns its place in the daily routine.",
      },
    ],
    timeline:
      "A focused CRM covering lead capture, pipeline, tasks and reporting often takes six to ten weeks from approved scope. Adding quoting, approvals, multiple pipelines or several integrations typically extends that to three to five months. A pilot with a small group usually starts well before the full build is finished.",
    techSlugs: ["nextjs", "react", "nodejs", "postgresql", "aws"],
    whoFor: [
      "Sales teams whose real pipeline lives in spreadsheets, inboxes and memory",
      "Service firms where selling, delivery and billing need to share one record",
      "Businesses frustrated that a configurable CRM still does not fit their process",
    ],
    whoNotFor: [
      "Small teams whose needs are met by a standard CRM with light configuration",
      "Buyers who want a heavy marketing automation platform rather than a sales pipeline",
      "Teams without anyone available to describe how deals really progress",
    ],
    relatedPages: [
      { href: "/services/erp-development", label: "ERP development" },
      { href: "/services/automation-integrations", label: "Automation and integrations" },
      { href: "/ai/sales-automation", label: "AI sales automation" },
    ],
    faq: [
      {
        q: "Why build a CRM instead of configuring an existing one?",
        a: "If a standard tool fits with light configuration, use it. Custom makes sense when your process, approvals or integrations keep fighting the tool, or when the licensing cost for the features you need is high.",
      },
      {
        q: "Can you migrate our data from spreadsheets or another CRM?",
        a: "Yes. We map the columns, clean duplicates, import in rehearsals and check the results with your team before go-live.",
      },
      {
        q: "Will it connect to our email and calendar?",
        a: "Where the providers offer APIs, yes. We list which connections are in scope, what they sync and which limits apply, so expectations are clear.",
      },
      {
        q: "Can it support more than one team or brand?",
        a: "Yes. Separate pipelines, permissions and views can be set up for different teams, offers or regions within one system.",
      },
      {
        q: "How do you make sure the team will use it?",
        a: "We pilot with a small group early, design the daily view around their next actions and remove fields nobody needs. Adoption is treated as part of the delivery, not an afterthought.",
      },
      {
        q: "Can it run email sequences and marketing campaigns?",
        a: "Simple follow-up sequences, yes. Large-scale campaign tools are a different category, and we would usually integrate with a dedicated email platform rather than rebuild one inside your CRM.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 10. saas-development
  // ---------------------------------------------------------------------------
  {
    slug: "saas-development",
    seoTitle: "SaaS Development Company | Multi-Tenant | Delvix Studio",
    seoDescription:
      "Build multi-tenant SaaS with tenancy, billing, roles and an admin console done right. Fixed scope, weekly demos, you own the code. Remote, global hours.",
    h1: "SaaS development with the platform layer done properly",
    subline:
      "Tenancy, plans, billing, roles and an operations console built before the clever features. So customer two onboards without a fork, and support never needs a database login.",
    intro: [
      "A polished interface is the visible tenth of a SaaS product. Underneath sit the parts that decide whether you can actually sell it: strict separation between customers, plans and entitlements that match your pricing page, billing that handles upgrades and failed payments, and an admin console your team can use without developer help. Skipping them feels fast for a quarter and expensive for years.",
      "We build the platform spine first. That means organizations and roles in the data model, entitlements wired to what each plan allows, webhooks from your billing provider handled safely and an internal console for support and operations. Features then sit on a foundation that was designed for more than one customer from the first commit.",
      "We know this territory firsthand. Delvix Revenue OS, our own acquisition platform, is multi-tenant with versioned packages, a credit system, Paddle billing, a Super Admin console, per-tenant bring-your-own-key integrations, two-factor authentication and audit logs. The patterns in your product will differ, but the hard questions about isolation, billing and support tooling are ones we have already had to answer.",
    ].join("\n\n"),
    problems: [
      {
        title: "A product that is really one customer's tool",
        body: "Everything was built for the first client. Onboarding the second means cloning the codebase or the database, and every fix has to be repeated.",
        icon: "copy-x",
      },
      {
        title: "Pricing the product cannot enforce",
        body: "Your plans say one thing and the application allows another. Limits are policed by hand and upgrades require an engineer.",
        icon: "badge-dollar-sign",
      },
      {
        title: "Billing glued on as an afterthought",
        body: "Failed payments, plan changes, proration and refunds were never designed, so finance reconciles in spreadsheets and customers get access they should not.",
        icon: "credit-card",
      },
      {
        title: "Support that needs database access",
        body: "Without an admin console, resolving a customer issue means asking an engineer to run a query, which is slow, risky and impossible to audit.",
        icon: "database-zap",
      },
    ],
    deliverables: [
      {
        title: "Tenant isolation and role model",
        body: "Organization boundaries enforced in the data model and every query, plus roles for owners, admins and members.",
        icon: "building-2",
      },
      {
        title: "Plans, entitlements and usage",
        body: "Seats, credits or feature flags tied to plans, with limits enforced by the product instead of by hand.",
        icon: "sliders-horizontal",
      },
      {
        title: "Billing integration",
        body: "Checkout, subscription lifecycle and webhooks with your chosen provider, including failure and retry handling.",
        icon: "wallet",
      },
      {
        title: "Operations console",
        body: "An internal admin area for managing tenants, plans, flags and support actions with a record of who did what.",
        icon: "settings-2",
      },
      {
        title: "Security basics for the threat model",
        body: "Encrypted secrets, optional two-factor authentication, audit logs and safe handling of customer-supplied input.",
        icon: "shield-check",
      },
      {
        title: "Core product features and docs",
        body: "The features that deliver your value proposition, with environment templates, architecture notes and runbooks at handover.",
        icon: "layers",
      },
    ],
    steps: [
      {
        title: "Define the product and buyer",
        body: "We pin down who pays, what they pay for, how the product is priced and what the first sellable version must include.",
      },
      {
        title: "Design tenancy and billing",
        body: "Before building features we agree on the tenant model, roles, entitlements and billing flows, and put them in the written scope.",
      },
      {
        title: "Build the spine",
        body: "Authentication, organizations, plans, billing hooks and the admin console come first, so every feature after them is multi-tenant by default.",
      },
      {
        title: "Ship features in weekly demos",
        body: "Core product capabilities arrive in short cycles on the finished foundation, each one demonstrated on realistic tenant data.",
      },
      {
        title: "Launch and operate",
        body: "We harden security basics, set up monitoring, run a pilot with early customers and hand over the code and operating notes.",
      },
      {
        title: "Prepare for scale",
        body: "We review performance, backups and operational readiness, with notes on what to monitor and what to revisit as customer numbers rise, so the next stage is planned and not a scramble.",
      },
    ],
    timeline:
      "A first sellable SaaS release with tenancy, billing, an admin console and a focused feature set commonly takes three to five months from approved scope. Products with complex usage metering, many integrations or compliance requirements often take longer and are better staged across releases. We would rather scope a smaller first release honestly than promise a platform in six weeks.",
    techSlugs: ["nextjs", "react", "nodejs", "postgresql", "aws", "openai"],
    relatedCaseStudySlug: "revenue-os",
    whoFor: [
      "Founders selling software to other businesses who need a sellable first version",
      "Agencies turning a repeated delivery into a subscription product",
      "Teams stuck with a single-tenant codebase forked for each customer",
    ],
    whoNotFor: [
      "Internal tools that will only ever serve one company, which are simpler as web applications",
      "Teams that want a throwaway demo to test a pitch, which an MVP engagement serves better",
      "Products that need certified compliance programs we do not hold",
    ],
    relatedPages: [
      { href: "/services/mvp-development", label: "MVP development" },
      { href: "/services/web-applications", label: "Web applications" },
      { href: "/ai/ai-integrations", label: "AI integrations" },
    ],
    faq: [
      {
        q: "Which billing provider do you use?",
        a: "Whichever suits your market. We have worked with Paddle on our own platform and can integrate other providers such as Stripe. Checkout, webhooks and failure handling are specified in the scope.",
      },
      {
        q: "How do you keep one customer's data away from another's?",
        a: "Organization boundaries are built into the data model and enforced in queries, with tests for the critical paths. We document the approach so your team and any auditor can follow it.",
      },
      {
        q: "Can customers bring their own API keys?",
        a: "Yes. Per-tenant integrations with encrypted credential storage are a pattern we use ourselves, and it suits products that call third-party or AI services on the customer's behalf.",
      },
      {
        q: "Do we need an MVP first?",
        a: "Not always. If you already know your buyer and pricing, the platform spine plus a tight feature set can be your first release. If you are still testing demand, a smaller MVP may be wiser.",
      },
      {
        q: "Who owns the product and the customers?",
        a: "You do. Source code, infrastructure access and customer data stay with you, and nothing about the product depends on a platform we operate.",
      },
      {
        q: "Can you support compliance programs like SOC 2?",
        a: "We build practices such as audit logs, access control and encrypted secrets that support such programs. We do not hold certifications ourselves, so formal compliance needs an auditor, and we help you prepare for that conversation.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 11. automation-integrations
  // ---------------------------------------------------------------------------
  {
    slug: "automation-integrations",
    seoTitle: "Business Automation & API Integrations | Delvix Studio",
    seoDescription:
      "Connect CRM, billing, inventory and ops tools with reliable integrations: retries, idempotency and visible failures. Handover included.",
    h1: "Automation and integrations that keep working at real volume",
    subline:
      "Connect the systems you already pay for so records move on their own. Built with retries and monitoring, so failures are visible instead of silent.",
    intro: [
      "Every growing business reaches the point where two or three systems each hold part of the truth. Orders sit in a shop, invoices in accounting, customers in a CRM and the real status in someone's spreadsheet. People bridge the gaps by copying data across, which is slow, error-prone and miserable. Integration work removes the copying and makes the connection something you can see and trust.",
      "The risk with automation is silent failure. A chain of triggers that works nine times in ten and quietly drops the tenth creates a mess nobody notices until a customer complains. We design for the tenth case: each sync has a source of truth, retries with backoff, protection against duplicates and a dashboard or alert when something needs attention.",
      "We are not dogmatic about tooling. For light, low-stakes glue, a no-code tool may be the right answer and we will say so. When volume, money or rules are involved, we write code: webhooks, scheduled jobs, queues and small internal tools, delivered with runbooks so your team can operate them after handover.",
    ].join("\n\n"),
    problems: [
      {
        title: "Copying the same record into three tools",
        body: "Staff retype orders, contacts and invoices between systems every day. Each pass is a chance for a typo, and each typo causes follow-up work.",
        icon: "copy",
      },
      {
        title: "Automations that fail without telling anyone",
        body: "A chain of no-code steps stops after a vendor changes a field name. Nobody knows until weeks of data are missing.",
        icon: "bell-off",
      },
      {
        title: "Duplicates and conflicting updates",
        body: "Two systems edit the same record and overwrite each other. Without rules for who wins, data drifts and trust in reports erodes.",
        icon: "git-merge",
      },
      {
        title: "Vendors with awkward or no APIs",
        body: "Some tools expose limited data, strict rate limits or only file exports. Teams guess at workarounds that fall apart under real volume.",
        icon: "plug-zap",
      },
    ],
    deliverables: [
      {
        title: "Integration map",
        body: "A diagram and written description of each system, what it owns, which data moves and in which direction.",
        icon: "workflow",
      },
      {
        title: "Reliable sync services",
        body: "Webhook receivers and scheduled jobs with retries, backoff and rules for resolving conflicts.",
        icon: "refresh-cw",
      },
      {
        title: "Idempotent imports and reconciliation",
        body: "Re-running a job never creates duplicates, and reconciliation reports show where systems disagree.",
        icon: "scale",
      },
      {
        title: "Error handling and alerts",
        body: "Failed items are captured, retried and surfaced to the right person by email or chat with enough context to act.",
        icon: "siren",
      },
      {
        title: "Small internal tools",
        body: "Lightweight admin screens for reviewing exceptions, replaying failed items or editing mapping tables without engineering help.",
        icon: "wrench",
      },
      {
        title: "Runbooks and monitoring hooks",
        body: "Plain-language instructions for common failures and monitoring you keep after handover, running in your accounts.",
        icon: "book-open",
      },
    ],
    steps: [
      {
        title: "Inventory the systems",
        body: "We list every tool involved, who uses it, what its API allows and where manual work currently bridges the gaps.",
      },
      {
        title: "Decide source of truth",
        body: "For each data type we choose which system owns it and how conflicts resolve, then record the decision in the scope.",
      },
      {
        title: "Pick the lightest tool that is safe",
        body: "We separate what a no-code tool can handle from what needs code, based on volume, rules and cost of failure.",
      },
      {
        title: "Build and test with real data",
        body: "We run integrations against copies of your real records, including awkward cases, and show results in weekly demos.",
      },
      {
        title: "Go live and hand over",
        body: "We switch over in stages, watch the first runs closely and deliver the runbook, access map and monitoring in your accounts.",
      },
      {
        title: "Review after the first month",
        body: "A month after launch we review failure logs and reconciliation reports with you, adjust retry rules and mappings, and retire any manual workaround that is no longer needed.",
      },
    ],
    timeline:
      "A single well-documented integration between two systems often takes two to four weeks from approved scope. Multi-system workflows with reconciliation and internal tooling more commonly take six to twelve weeks. Vendor API limits, access approvals and the quality of existing data are the usual sources of delay, so we investigate them in the first week.",
    techSlugs: ["nodejs", "python", "postgresql", "aws"],
    whoFor: [
      "Operations leads tired of re-keying data between CRM, billing, inventory and support tools",
      "Companies whose no-code automations have started to fail at higher volume",
      "Products that need webhooks, scheduled sync and an audit trail of what moved",
    ],
    whoNotFor: [
      "Teams that only need one simple trigger a no-code tool can handle on its own",
      "Buyers expecting us to integrate with software that exposes no data at all",
      "Projects that need a full replacement system rather than connections between existing ones",
    ],
    relatedPages: [
      { href: "/services/erp-development", label: "ERP development" },
      { href: "/services/crm-development", label: "CRM development" },
      { href: "/ai/ai-agents", label: "AI agents" },
    ],
    faq: [
      {
        q: "When do you recommend Zapier or a similar tool?",
        a: "For low-volume, low-risk connections where an occasional failure is cheap. For money, customer data or high volume, we favor code with retries and monitoring.",
      },
      {
        q: "What happens when a sync fails?",
        a: "Failed items are logged with the reason, retried automatically where it makes sense and raised to a named person when they need a human. Nothing is dropped quietly.",
      },
      {
        q: "Can you integrate with a vendor that has no API?",
        a: "We tell you early. Options may include file exports, partner endpoints or changing the tool, but we will not promise an integration the vendor does not allow.",
      },
      {
        q: "Where do the integrations run?",
        a: "In your accounts whenever possible, such as your AWS environment, so you own the runtime and the logs. We document every credential and permission involved.",
      },
      {
        q: "Can you maintain them after launch?",
        a: "Yes. APIs change, so many clients keep a small retainer for monitoring and updates, but the runbook means your own team can handle common issues instead.",
      },
      {
        q: "How do you handle rate limits and large backfills?",
        a: "We queue requests, respect each vendor's limits and run historical imports in controlled batches with checkpoints, so an interrupted run resumes instead of starting over or creating duplicates.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 12. website-development
  // ---------------------------------------------------------------------------
  {
    slug: "website-development",
    seoTitle: "Business Website Development | Delvix Studio",
    seoDescription:
      "Fast, search-friendly business websites on Next.js with clear content, forms that reach your CRM and code you own. Fixed scope, weekly demos.",
    h1: "Business websites that load fast, rank sensibly and capture real enquiries",
    subline:
      "A site structured around what buyers need to decide, with forms that reach your team and a codebase you can hand to anyone. No theme lock-in, no plugin pile.",
    intro: [
      "Your website is where a buyer decides whether to talk to you. If it loads slowly, hides what you do or sends enquiries into an inbox nobody checks, it costs you work you never see. We build business websites to do a specific job: make your offer clear, earn trust quickly and turn a visit into a conversation.",
      "We begin with content and structure before visuals. Which questions do buyers ask, which pages answer them and what should someone do next? From there we design a layout that supports reading, build it with Next.js for speed and clean markup, and set up the technical basics of search visibility such as sensible titles, metadata, sitemaps and structured data.",
      "Enquiry forms connect to where your team actually works, whether that is email, a CRM or a shared pipeline, with spam filtering and confirmation. The site is yours: a clean repository, a simple way to edit content and hosting you control. We do not tie you to a proprietary page builder or a monthly platform fee for your own pages.",
    ].join("\n\n"),
    problems: [
      {
        title: "A site that says nothing specific",
        body: "Generic claims and stock phrases leave buyers unsure what you do, who it is for or why they should choose you over a competitor.",
        icon: "message-square-dashed",
      },
      {
        title: "Slow pages that lose visitors",
        body: "Heavy themes, unoptimized images and stacked plugins make pages crawl, especially on phones, and visitors leave before reading.",
        icon: "gauge",
      },
      {
        title: "Enquiries that vanish",
        body: "Forms send to an old address, land in spam or never reach the person who should reply. You never learn about the missed leads.",
        icon: "mail-x",
      },
      {
        title: "Trapped in a platform",
        body: "A builder or theme makes simple changes awkward and migrating away painful, while a plugin update can break the whole site.",
        icon: "lock",
      },
    ],
    deliverables: [
      {
        title: "Content and page structure",
        body: "A sitemap and page outlines built around buyer questions, with calls to action placed where decisions happen.",
        icon: "sitemap",
      },
      {
        title: "Custom responsive design",
        body: "A layout designed for readability on phones and desktops, matched to your brand without leaning on a generic template.",
        icon: "panels-top-left",
      },
      {
        title: "Fast Next.js build",
        body: "Optimized images, lean code and server rendering so pages load quickly and are easy for search engines to read.",
        icon: "zap",
      },
      {
        title: "Technical SEO foundations",
        body: "Titles, descriptions, canonical tags, sitemap, robots rules and structured data set up correctly from the start.",
        icon: "search",
      },
      {
        title: "Forms and lead routing",
        body: "Enquiry and booking forms with validation, spam protection and delivery to email, CRM or both, plus a confirmation for the sender.",
        icon: "send",
      },
      {
        title: "Content editing and handover",
        body: "A straightforward way to update copy and add pages, plus repository, hosting notes and a short training session.",
        icon: "pencil-line",
      },
    ],
    steps: [
      {
        title: "Clarify the offer and audience",
        body: "We work out who the site is for, what they need to know and what action you want from them, and agree on a sitemap.",
      },
      {
        title: "Draft the content",
        body: "We outline each page and draft or edit copy with you, so the design is built around real words rather than filler.",
      },
      {
        title: "Design the key pages",
        body: "We design the homepage and one or two representative inner pages, review them with you, then extend the system to the rest.",
      },
      {
        title: "Build and connect",
        body: "We build the site, set up forms, analytics and search foundations, and test across devices and browsers.",
      },
      {
        title: "Launch and monitor",
        body: "We handle domain and redirect details, go live, check indexing and speed, and fix anything that surfaces in the first weeks.",
      },
      {
        title: "Measure and refine",
        body: "After launch we check speed, indexing and form performance, then suggest small content and structure changes based on how visitors actually behave rather than on opinion.",
      },
    ],
    timeline:
      "A focused marketing site of roughly five to ten pages often takes three to six weeks from approved scope and content. Larger sites with many templates, multiple languages or a blog migration commonly take two to three months. Content is usually the slowest part, so having copy and images ready is the best way to speed things up.",
    techSlugs: ["nextjs", "react", "nodejs", "aws"],
    whoFor: [
      "Service businesses whose current site is slow, dated or says too little",
      "Companies that want enquiries routed to a CRM instead of an unwatched inbox",
      "Teams that want a site they own outright rather than renting a page builder",
    ],
    whoNotFor: [
      "Businesses that want to build and edit everything themselves in a drag-and-drop tool",
      "Online stores with large catalogs needing a dedicated commerce platform",
      "Buyers who need guaranteed search rankings, which no one can promise",
    ],
    relatedPages: [
      { href: "/services/web-applications", label: "Web applications" },
      { href: "/services/crm-development", label: "CRM development" },
      { href: "/services/fixed-price-projects", label: "Fixed-price projects" },
    ],
    faq: [
      {
        q: "Will the new site improve our search rankings?",
        a: "We set up the technical foundations properly and structure content around what buyers search for, but no one can guarantee rankings. Results also depend on competition, content quality and time.",
      },
      {
        q: "Can we edit the content ourselves?",
        a: "Yes. We set up a simple, safe way to update text and add pages, and train your team during handover. Structural changes can be handled by us under a retainer or as small projects.",
      },
      {
        q: "Do you write the copy?",
        a: "We can draft or substantially edit it with your input, because we need the real message to design well. We rely on you for facts, offers and proof points.",
      },
      {
        q: "Can you migrate our existing site?",
        a: "Yes. We map old URLs to new ones with redirects, preserve content that performs and avoid breaking links that already bring visitors.",
      },
      {
        q: "Who hosts the website?",
        a: "You choose. We commonly deploy to a host in your own account, and we document domains, DNS and deployment so you are never dependent on us to keep it online.",
      },
      {
        q: "Can the site support multiple languages?",
        a: "Yes. We structure pages and routing for multiple languages from the start if you need them. Professional translation is a separate task, and we recommend a native reviewer for each language.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 13. mvp-development
  // ---------------------------------------------------------------------------
  {
    slug: "mvp-development",
    seoTitle: "MVP Development for Startups & Operators | Delvix Studio",
    seoDescription:
      "Ship a focused MVP real users can touch. Ruthless written scope, explicit non-goals, production deploy and a v2 backlog. You own the code. Weekly demos.",
    h1: "MVP development that gets a real product in front of real users",
    subline:
      "A deliberately small first release with a written scope, explicit non-goals and a production deploy. Learn from actual usage, then decide what to build next.",
    intro: [
      "The point of a minimum viable product is to learn something expensive to guess. Does anyone complete this workflow? Will staff abandon the spreadsheet? Will a customer pay? Teams get this wrong in two directions: they build for six months and launch into silence, or they ship a clickable mock-up that cannot survive a real user. A good MVP sits between the two.",
      "We start by choosing one persona and one job to be done, then cut everything else into a visible list of non-goals. The scope names the flows that must work end to end: sign-up, the core action, the result the user cares about. Everything decorative or speculative is deferred and written down so it is a decision, not a loss.",
      "The result is a production deployment with authentication, monitoring basics and data you will not have to throw away. Because we build on the same foundations as larger products, the code can keep growing with you. We close with a prioritized backlog for version two, shaped by what the first users actually did.",
    ].join("\n\n"),
    problems: [
      {
        title: "Months of building before any feedback",
        body: "A long build hides the risk until the end, when changing direction costs the most. Learning arrives too late to matter.",
        icon: "hourglass",
      },
      {
        title: "A demo that collapses under real use",
        body: "Prototype-quality code looks fine in a pitch and fails with real data, concurrent users and edge cases. The rebuild eats the budget you saved.",
        icon: "cracked-glass",
      },
      {
        title: "Scope that grows every week",
        body: "Each stakeholder adds one more must-have. The launch date drifts and the product loses the focus that made it worth building.",
        icon: "expand",
      },
      {
        title: "No plan for what comes next",
        body: "Once launched, nobody knows what to prioritize. Without a backlog grounded in evidence, version two becomes opinion versus opinion.",
        icon: "signpost",
      },
    ],
    deliverables: [
      {
        title: "MVP scope with explicit non-goals",
        body: "The user, the core flows and the edge of the product written down, including what you have chosen not to build yet.",
        icon: "scissors",
      },
      {
        title: "Core flow design",
        body: "Clean, usable screens for the paths that matter, designed to be understood by first-time users without training.",
        icon: "pen-tool",
      },
      {
        title: "Working product on production",
        body: "Authentication, the core feature set and sensible data handling running on infrastructure real users can reach.",
        icon: "rocket",
      },
      {
        title: "Basic analytics and feedback",
        body: "Lightweight measurement of the key actions plus an easy channel for user feedback, so learning does not rely on anecdotes.",
        icon: "line-chart",
      },
      {
        title: "Weekly demos",
        body: "A short live review of working software each week, with decisions logged against the scope.",
        icon: "monitor-play",
      },
      {
        title: "Version two backlog",
        body: "Deferred features and new ideas ranked with you after the first users have touched the product.",
        icon: "list-ordered",
      },
    ],
    steps: [
      {
        title: "Choose the bet",
        body: "We identify the single assumption the MVP must test, the person it is for and what success would look like in their behavior.",
      },
      {
        title: "Cut the scope",
        body: "We list candidate features, keep only what the bet requires and record the rest as non-goals with a rough order for later.",
      },
      {
        title: "Design the critical path",
        body: "We design the end-to-end flow for the core action and test it informally with a few likely users before building.",
      },
      {
        title: "Build and ship quickly",
        body: "We build in weekly increments on foundations that will not need to be thrown away, then deploy to production.",
      },
      {
        title: "Learn and plan version two",
        body: "We review early usage with you and turn the findings into a ranked backlog for the next round.",
      },
      {
        title: "Review the results",
        body: "A few weeks after launch we sit down with usage data and feedback, compare them with the bet we set out to test and give you a plain view on whether to continue, change direction or stop.",
      },
    ],
    timeline:
      "Many MVPs can reach production in about six to ten weeks from approved scope, depending on how much the core flow involves integrations, payments or mobile. The scoping stage is usually a few days. Anything that stretches the plan, such as extra personas or custom admin tooling, is discussed as a trade-off against the launch date.",
    techSlugs: ["nextjs", "react", "nodejs", "postgresql", "react-native"],
    relatedCaseStudySlug: "revenue-os",
    whoFor: [
      "Founders validating a workflow with real customers before raising or investing more",
      "Operators replacing a painful spreadsheet with a thin, focused product",
      "Teams that need a launch date and are willing to defer everything else to hit it",
    ],
    whoNotFor: [
      "Teams who cannot name a single primary user or core action yet",
      "Buyers who need a feature-complete platform in the first release",
      "Projects that need a throwaway design mock-up only, with no working product",
    ],
    relatedPages: [
      { href: "/services/discovery", label: "Discovery" },
      { href: "/services/saas-development", label: "SaaS development" },
      { href: "/services/product-retainer", label: "Product retainer" },
    ],
    faq: [
      {
        q: "How small is small enough?",
        a: "Small enough to demo weekly and launch on a date you approve in the written scope. If a feature is not needed to test your core bet, it goes on the non-goals list.",
      },
      {
        q: "Can we add features during the build?",
        a: "Yes, through a written change that shows its effect on date and price. Often the right answer is to swap something out rather than pile it on.",
      },
      {
        q: "Will we have to rebuild after the MVP?",
        a: "Not if it is built properly. We use production-grade foundations so the code can keep growing. What you defer is features, not engineering quality.",
      },
      {
        q: "Do you also help with design?",
        a: "Yes. We design the core flows as part of the engagement so the first release is usable without hand-holding. A full brand identity is a separate matter.",
      },
      {
        q: "What happens after launch?",
        a: "You can continue with a retainer, bring in your own team or work with a dedicated developer from us. Either way, the code, accounts and documentation are yours.",
      },
      {
        q: "Should the MVP include payments?",
        a: "Only if charging is the thing you need to learn about. Many MVPs validate usage first and invoice manually, which saves weeks. If payment is the bet itself, we build the smallest checkout that tests it.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 14. discovery
  // ---------------------------------------------------------------------------
  {
    slug: "discovery",
    seoTitle: "Software Discovery & Scoping | Delvix Studio",
    seoDescription:
      "A short, fixed-price discovery that turns fuzzy goals into a build-ready written scope, risk list and estimate you can use with us or any other vendor.",
    h1: "Software discovery that ends in a scope you can build against",
    subline:
      "A short, fixed engagement that turns a fuzzy goal into a written scope, a risk list and a price path. Take it into a build with us or hand it to another vendor.",
    intro: [
      "Many software budgets are spent in the gap between what people think they agreed and what they actually need. Discovery closes that gap before the expensive phase begins. In a bounded engagement we talk to the people involved, map how work happens today and turn the answers into a document that someone could genuinely build from.",
      "The output is concrete. You receive a process and systems map, a list of risks and open questions, a scope with milestones and non-goals, and estimate options for the build that follows. The risks section matters as much as the scope: integrations that may not be possible, data that is messier than assumed, decisions that belong to someone who has not yet been asked.",
      "Discovery is priced and timed, not an open-ended consulting meter. The scope is yours whatever you decide next. You can build with us, ask other vendors to bid against the same document or conclude that the project should not go ahead, which is a perfectly good outcome if it saves you from a bad investment.",
    ].join("\n\n"),
    problems: [
      {
        title: "Goals without a shape",
        body: "Everyone agrees something should exist, but the picture differs between stakeholders. Quotes based on that fog vary wildly.",
        icon: "cloud-fog",
      },
      {
        title: "Quotes you cannot compare",
        body: "Vendors respond to a vague brief with different assumptions and prices. You cannot tell which proposal is cheaper or just narrower.",
        icon: "columns-3",
      },
      {
        title: "Risks that surface mid-build",
        body: "A missing API, messy data or an unconvinced department appears after the budget is committed. Each one becomes a change request.",
        icon: "alert-octagon",
      },
      {
        title: "Internal alignment that never happens",
        body: "Sales, operations and finance each assume the system will solve their problem. Without a shared document, disagreements emerge at demo time.",
        icon: "users-round",
      },
    ],
    deliverables: [
      {
        title: "Stakeholder interview summary",
        body: "What each group needs, what frustrates them and where their priorities collide, written up without politics.",
        icon: "messages-square",
      },
      {
        title: "Process and systems map",
        body: "How work flows today across people, spreadsheets and software, including the unofficial steps nobody had documented.",
        icon: "workflow",
      },
      {
        title: "Risk and dependency register",
        body: "Integrations, data quality, approvals, compliance questions and open decisions, each with an owner and a suggested resolution.",
        icon: "shield-alert",
      },
      {
        title: "Written scope",
        body: "Users, features, rules, milestones, assumptions and non-goals in a format any competent team can estimate from.",
        icon: "file-text",
      },
      {
        title: "Build estimate options",
        body: "A fixed-price proposal or a capacity-based option, plus a staged route if you want to start smaller.",
        icon: "calculator",
      },
      {
        title: "Go or no-go recommendation",
        body: "A candid view on whether to proceed, change direction or wait, with the reasoning behind it.",
        icon: "badge-help",
      },
    ],
    steps: [
      {
        title: "Kickoff and goals",
        body: "We confirm what decision this discovery supports, who needs to be involved and what materials already exist.",
      },
      {
        title: "Interviews and observation",
        body: "We speak with the people who use, run and pay for the current process, and watch real work where we can.",
      },
      {
        title: "Mapping and risk analysis",
        body: "We draw the current process, identify what a new system must change and list what could derail it.",
      },
      {
        title: "Draft scope and review",
        body: "We write the scope and walk through it with your stakeholders, adjusting wording and priorities until the right people agree.",
      },
      {
        title: "Estimates and decision",
        body: "We present the build options and a recommendation. You decide what to do next with the document in hand.",
      },
      {
        title: "Hand over and follow up",
        body: "We deliver the full document set and stay available for questions while you review internally or brief other vendors, so the scope survives contact with your stakeholders and finance team.",
      },
    ],
    timeline:
      "Discovery typically runs one to three weeks depending on how many stakeholders and systems are involved, with the scope document arriving at the end. Scheduling interviews is the most common cause of delay. The fee and timeframe are agreed before we begin, so there is no open-ended meter. A free introductory call comes first.",
    techSlugs: ["nextjs", "nodejs", "postgresql", "python", "aws"],
    whoFor: [
      "Buyers who need a scope before committing a build budget",
      "Teams collecting competing bids who want one document to compare them against",
      "Projects that stalled and need assumptions reset before restarting",
    ],
    whoNotFor: [
      "Teams with a complete specification and a ready design who just need delivery",
      "Buyers who want to start writing code this week with no planning",
      "Organizations without access to the people who know the current process",
    ],
    relatedPages: [
      { href: "/services/fixed-price-projects", label: "Fixed-price projects" },
      { href: "/services/technical-consulting", label: "Technical consulting" },
      { href: "/services/project-rescue", label: "Project rescue" },
    ],
    faq: [
      {
        q: "Is discovery free?",
        a: "The introductory call is free. A full discovery that produces a written scope is a short, fixed-price engagement with the fee confirmed before it starts.",
      },
      {
        q: "Do we have to build with you afterwards?",
        a: "No. The scope belongs to you. Many clients continue with us because there is no re-discovery cost, but you are free to share the document with any other vendor.",
      },
      {
        q: "Does the fee count toward the build?",
        a: "That depends on the proposal. Where it does, we state the credit clearly in the discovery agreement rather than leaving it to goodwill.",
      },
      {
        q: "Who needs to be involved from our side?",
        a: "A decision-maker, one or two people who run the current process day to day and anyone who owns systems we may need to connect. We keep time demands tight.",
      },
      {
        q: "What if discovery says the project is a bad idea?",
        a: "Then it did its job. A clear no-go, or a smaller first step, is far cheaper to discover now than halfway through a build.",
      },
      {
        q: "How detailed is the final scope?",
        a: "Detailed enough that a competent team can estimate and start without repeating discovery: users, flows, rules, integrations, milestones and exclusions. It is not a pixel-perfect design, which comes later.",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 15. legacy-modernization
  // ---------------------------------------------------------------------------
  {
    slug: "legacy-modernization",
    seoTitle: "Legacy Software Modernization | Delvix Studio",
    seoDescription:
      "Modernize legacy systems in safe stages: stabilize, document, migrate data and replace piece by piece. No risky big-bang rewrite. You own the result.",
    h1: "Legacy modernization without a big-bang rewrite",
    subline:
      "Replace aging systems piece by piece while the business keeps running. Stabilize first, document what exists, migrate carefully and retire old code only when the new path is proven.",
    intro: [
      "Legacy software is not just old software. It is software the business depends on and nobody fully understands: an outdated framework, a database with unwritten rules, a server that no one wants to reboot. Each year it gets slightly riskier and slightly more expensive to change, and the people who knew how it worked leave.",
      "The instinct is to rewrite everything. Big-bang rewrites tend to run long, miss behavior the old system performed quietly and force a risky cutover. We prefer an incremental route. First we make the system observable and safe: backups, monitoring, access, documentation of what it really does. Then we move one capability at a time to a modern implementation, running old and new side by side until the numbers agree.",
      "That approach keeps the business running and gives you value early, such as an API in front of an old database or a new interface on stable logic. It also keeps the decision in your hands at every stage. You can slow down, stop or switch vendors with the system in a better state than you found it.",
    ].join("\n\n"),
    problems: [
      {
        title: "One person understands it, and may leave",
        body: "Critical logic lives in a single engineer's memory or in code that nobody dares touch. Losing that person would pause the business.",
        icon: "user-round-search",
      },
      {
        title: "Platforms past support",
        body: "Unsupported runtimes and libraries collect vulnerabilities. Upgrading feels impossible because tests and documentation do not exist.",
        icon: "shield-off",
      },
      {
        title: "Changes that take forever",
        body: "A small feature touches fragile, tangled code and needs weeks of cautious work. Competitors move faster because their systems bend.",
        icon: "turtle",
      },
      {
        title: "Fear of the rewrite",
        body: "You know the system must change, but a full replacement means a long project, parallel running and risk to daily operations.",
        icon: "ghost",
      },
    ],
    deliverables: [
      {
        title: "System inventory and behavior map",
        body: "What the system does, what it connects to, which jobs run on schedules and which rules are buried in code or the database.",
        icon: "map",
      },
      {
        title: "Safety net",
        body: "Verified backups, access control, basic monitoring and a documented way to restore, so the system is safer before we change it.",
        icon: "life-buoy",
      },
      {
        title: "Characterization tests",
        body: "Automated checks that capture current behavior on critical paths, so changes can be verified rather than hoped for.",
        icon: "test-tube",
      },
      {
        title: "Modernization roadmap",
        body: "A sequence of stages ordered by risk and value, each with its own scope, so you can stop or adjust after any stage.",
        icon: "route",
      },
      {
        title: "Incremental replacement",
        body: "New components, APIs or interfaces released alongside the old system, with data kept consistent between them.",
        icon: "blocks",
      },
      {
        title: "Data migration and decommission plan",
        body: "Rehearsed migrations, reconciliation reports and a cutover plan, ending with the old system retired once it is no longer needed.",
        icon: "database-backup",
      },
    ],
    steps: [
      {
        title: "Assess and inventory",
        body: "We read the code, servers and data, talk to the people who run it and list what the system does, including behavior nobody documented.",
      },
      {
        title: "Stabilize and protect",
        body: "We secure access, confirm backups, add monitoring and capture critical behavior in tests before touching anything significant.",
      },
      {
        title: "Plan the stages",
        body: "We agree an order of work that balances risk and value, so the first stage delivers something useful on its own.",
      },
      {
        title: "Replace incrementally",
        body: "We move capabilities one at a time, running old and new in parallel and reconciling results until they match.",
      },
      {
        title: "Cut over and retire",
        body: "When a capability has proven itself, we switch traffic, archive old data as agreed and decommission the legacy piece.",
      },
      {
        title: "Document as you go",
        body: "Throughout, we write down what we learn: behavior, data rules, deployment steps and decisions. By the end your team holds the documentation that never existed before the project began.",
      },
    ],
    timeline:
      "The assessment and stabilization stage commonly takes two to six weeks, depending on size and documentation. Replacement stages are scoped individually and often run from one to three months each. Full modernization of a large system can take most of a year or longer, which is why we deliver it in stages with a useful result at each step.",
    techSlugs: ["nextjs", "nodejs", "postgresql", "python", "aws"],
    whoFor: [
      "Businesses running critical software on outdated platforms with few remaining experts",
      "Teams that tried to patch an old system and keep hitting its limits",
      "Leaders who want to modernize without betting the company on one cutover weekend",
    ],
    whoNotFor: [
      "Systems that still work well and only need a few cosmetic changes",
      "Buyers who want a guaranteed identical copy built on a new stack in a few weeks",
      "Environments we cannot legally or practically access, such as locked vendor platforms",
    ],
    relatedPages: [
      { href: "/services/project-rescue", label: "Project rescue" },
      { href: "/services/erp-development", label: "ERP development" },
      { href: "/services/technical-consulting", label: "Technical consulting" },
    ],
    faq: [
      {
        q: "Why not just rewrite it from scratch?",
        a: "Sometimes a rewrite is correct. More often it loses undocumented behavior and creates a risky cutover. We assess first and recommend a rewrite only when the existing system cannot be stabilized reasonably.",
      },
      {
        q: "Can you work on technology that is no longer popular?",
        a: "Often yes, at least for reading and stabilizing. We say clearly during the assessment where we are confident and where we would need a specialist, rather than learning on your budget.",
      },
      {
        q: "Will the business have downtime during the transition?",
        a: "We design stages to avoid it. Old and new run in parallel and traffic moves only after results match. Any unavoidable maintenance window is planned and agreed with you.",
      },
      {
        q: "How do you protect the data?",
        a: "We verify backups before changes, rehearse migrations on copies, reconcile totals between old and new and keep the legacy system intact until you accept the results.",
      },
      {
        q: "Do we have to commit to the whole program?",
        a: "No. The roadmap is split into stages with separate scopes. You can stop after any stage and still hold a safer, better-documented system and a plan you can give to anyone.",
      },
      {
        q: "What if the original source code is lost?",
        a: "That is harder but not always fatal. We can sometimes recover behavior from running systems, database contents and compiled artifacts, and we tell you honestly what is feasible after a short assessment.",
      },
    ],
  },

];

export function getServicePage(slug: string): ServicePageContent | undefined {
  return servicePages.find((p) => p.slug === slug);
}
