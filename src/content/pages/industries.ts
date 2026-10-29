export type IndustryPageContent = {
  slug: string;
  name: string;
  seoTitle: string;
  seoDescription: string;
  h1: string; // "Software for {industry}"
  subline: string;
  problems: string[]; // 5, industry language
  whatWeBuild: Array<{ title: string; body: string }>; // 4-6
  beforeAfter: Array<{ before: string; after: string }>; // workflow table rows
  integrations: string[];
  auditCta: { title: string; body: string };
  faq: Array<{ q: string; a: string }>; // 5
  relatedPages: Array<{ href: string; label: string }>; // 3
  intro: string;
};

export const industryPages: IndustryPageContent[] = [
  {
    slug: "logistics-trucking",
    name: "Logistics & Trucking",
    seoTitle: "Software for Logistics & Trucking Companies | Delvix Studio",
    seoDescription:
      "Custom dispatch boards, driver portals, quote forms, and compliance document management for trucking and logistics companies. Built by Delvix Studio.",
    h1: "Software for Logistics & Trucking",
    subline:
      "Replace the dispatch spreadsheet, the group texts, and the folder of loose paperwork with tools built around how your loads actually move.",
    intro:
      "Trucking and logistics run on timing. A load is booked, a driver is assigned, a pickup window opens, a signature is needed, and an invoice follows. When each of those steps lives in a different spreadsheet, inbox, or phone thread, small gaps become late loads, missed paperwork, and slow billing. Delvix Studio builds custom software that connects those steps: a dispatch board your team can read at a glance, a portal drivers can use from the cab, quote forms that capture the right details the first time, and a place to keep compliance documents where you can find them before an audit or a customer asks.",
    problems: [
      "Dispatch lives on a spreadsheet that only one or two people fully understand, and it is out of date the moment someone steps away.",
      "Customers call or email asking where their load is, and someone has to phone the driver to find out.",
      "Drivers send proof-of-delivery photos and rate confirmations through text messages that have to be re-saved and re-filed by hand.",
      "Quote requests arrive as emails and calls with missing details like weight, equipment type, or pickup window, so the back-and-forth eats the day.",
      "Insurance certificates, permits, driver qualification files, and other compliance documents sit in folders and inboxes, and expiration dates are tracked from memory.",
    ],
    whatWeBuild: [
      {
        title: "Dispatch board",
        body: "A live view of loads, drivers, and equipment with statuses, pickup and delivery windows, and notes. Dispatchers assign and reassign without retyping, and everyone sees the same information.",
      },
      {
        title: "Driver portal and mobile app",
        body: "A simple interface for drivers to view assigned loads, confirm pickup and delivery, upload photos and signed paperwork, and flag problems. Built to be quick to use on a phone, not to replace your people with a dashboard.",
      },
      {
        title: "Quote request form and quoting tool",
        body: "A structured intake form that collects lanes, dates, equipment, and special handling up front, then lands in a queue where your team can respond using your own pricing rules.",
      },
      {
        title: "Compliance document management",
        body: "A central, searchable place for driver and carrier documents, with expiration dates, reminders before things lapse, and controlled access for staff.",
      },
      {
        title: "Customer tracking page",
        body: "A link customers can open to see the status of their load, so your team spends less time answering the same status call.",
      },
    ],
    beforeAfter: [
      {
        before: "Dispatcher updates a shared spreadsheet and texts the driver the details.",
        after: "Dispatcher assigns the load on the board and the driver sees it in the portal with all pickup details.",
      },
      {
        before: "Driver texts a photo of the bill of lading, and someone saves it to a folder later.",
        after: "Driver uploads the document to the load record, where billing can find it immediately.",
      },
      {
        before: "Customer emails for a quote and the team replies asking for missing details.",
        after: "Customer completes a structured quote form and the team starts with complete information.",
      },
      {
        before: "Insurance and permit expirations are tracked in someone's calendar.",
        after: "Documents carry expiration dates and the system sends reminders before they lapse.",
      },
      {
        before: "Customer calls to ask where a load is.",
        after: "Customer opens a tracking link, and staff handle only exceptions.",
      },
    ],
    integrations: [
      "Accounting software (QuickBooks)",
      "Load boards (where the board provides an API)",
      "GPS and ELD providers (where an API is available)",
      "Email and SMS notifications",
      "Google Sheets and Excel imports",
      "Document storage and e-signature tools",
    ],
    auditCta: {
      title: "Start with a free look at your public website",
      body: "Carriers and shippers judge you by your site and your quote form before they ever call. Our free audit checks mobile speed, broken pages and links, forms, SSL, and calls to action, and gives you a real report with screenshots.",
    },
    faq: [
      {
        q: "Can you replace our dispatch spreadsheet without disrupting daily operations?",
        a: "Yes. We usually plan a phased rollout, starting with importing your existing data and running the new board alongside the spreadsheet for a short period before cutting over.",
      },
      {
        q: "Do drivers need to install an app?",
        a: "Not necessarily. A mobile-friendly web portal works for many fleets. If you need push notifications or offline use, we can build a mobile app with React Native or Flutter.",
      },
      {
        q: "Can you integrate with our ELD or GPS provider?",
        a: "If the provider offers an API we can use, usually yes. We check the provider's documentation and any access fees before we scope the work.",
      },
      {
        q: "Will this handle DOT and compliance requirements for us?",
        a: "We build tools to organize documents and track dates. Meeting regulatory requirements remains your responsibility, and we do not provide legal or compliance advice.",
      },
      {
        q: "How do you price a project like this?",
        a: "It depends on scope, such as the number of user roles, integrations, and whether you need a mobile app. We can scope a fixed-price first phase so you see working software early.",
      },
    ],
    relatedPages: [
      { href: "/technologies/react-native", label: "React Native mobile apps" },
      { href: "/industries/construction-trades", label: "Software for construction and trades" },
      { href: "/free-audit", label: "Get a free website audit" },
    ],
  },
  {
    slug: "real-estate",
    name: "Real Estate",
    seoTitle: "Software for Real Estate Teams and Agencies | Delvix Studio",
    seoDescription:
      "Custom lead capture, listing management, client portals, and follow-up tools for real estate agencies and property managers. Built by Delvix Studio.",
    h1: "Software for Real Estate",
    subline:
      "Capture leads faster, keep listings and showings organized, and stop losing prospects between your website, inbox, and spreadsheet.",
    intro:
      "Real estate is a relationship business with a lot of administrative drag. Leads come from your website, portals, social media, and referrals. Showings need scheduling, documents need signatures, and follow-up depends on someone remembering. Delvix Studio builds software that sits between those pieces: lead intake that routes to the right agent, listing and property tools that fit how your office works, and client portals for documents and updates. We do not replace your CRM for the sake of it. We connect what you have and build the missing parts.",
    problems: [
      "Web leads arrive in a shared inbox, and nobody is sure who responded or when.",
      "Property details are kept in spreadsheets and PDFs that are copied by hand into listings and flyers.",
      "Showing requests are coordinated by phone and text, leading to double bookings and missed appointments.",
      "Buyers and sellers email documents back and forth, and agents struggle to find the latest version.",
      "Past clients and cold leads slip away because follow-up depends on an agent remembering to reach out.",
    ],
    whatWeBuild: [
      {
        title: "Lead capture and routing",
        body: "Forms and landing pages that collect buyer and seller details, assign leads to agents based on your rules, and notify them immediately.",
      },
      {
        title: "Listing and property management tools",
        body: "A single source of property information that feeds your website, brochures, and internal records, so details only get typed once.",
      },
      {
        title: "Showing scheduler",
        body: "Online booking for showings with agent availability, confirmations, and reminders to reduce no-shows.",
      },
      {
        title: "Client portal",
        body: "A secure place for clients to view documents, track the steps of a transaction, and send what you need.",
      },
      {
        title: "Follow-up reminders",
        body: "Task lists and automated nudges so past clients and warm leads get contacted on a schedule.",
      },
    ],
    beforeAfter: [
      {
        before: "Web inquiries pile up in a shared inbox.",
        after: "Each inquiry is assigned to an agent, time-stamped, and tracked until answered.",
      },
      {
        before: "Property details are retyped for each flyer and listing.",
        after: "Details are entered once and reused across website and printed material.",
      },
      {
        before: "Showings are arranged by phone and text.",
        after: "Clients book from available slots, and agents get confirmations and reminders.",
      },
      {
        before: "Documents travel by email attachment.",
        after: "Documents live in a client portal with a clear version history.",
      },
    ],
    integrations: [
      "MLS or IDX feeds (where your provider allows)",
      "CRM tools such as HubSpot or Follow Up Boss",
      "Google Calendar and Outlook",
      "E-signature tools",
      "Email and SMS providers",
      "Mailing and marketing platforms",
    ],
    auditCta: {
      title: "See how your listing pages perform on a phone",
      body: "Most buyers browse on mobile. Our free audit reviews your mobile layout and speed, broken links, contact forms, SSL, and calls to action, and sends you a real report with screenshots.",
    },
    faq: [
      {
        q: "Can you build a custom website that pulls in MLS listings?",
        a: "Depending on your MLS and its data rules, yes. Access terms vary, so we confirm what your provider allows before we promise a specific feature.",
      },
      {
        q: "Do we have to abandon our current CRM?",
        a: "No. We commonly connect new forms and tools to the CRM you already use, so your agents keep working in familiar software.",
      },
      {
        q: "Can the client portal handle signed documents?",
        a: "We can integrate with an e-signature provider and store the completed documents in the client's record.",
      },
      {
        q: "Can this work for property management as well as sales?",
        a: "Yes. We can build tenant request forms, maintenance tracking, and owner reporting for property managers.",
      },
      {
        q: "How long does a first version take?",
        a: "It depends on scope. We typically begin with the most painful workflow, such as lead routing or showing scheduling, so you get value early.",
      },
    ],
    relatedPages: [
      { href: "/technologies/nextjs", label: "Next.js websites" },
      { href: "/industries/professional-services", label: "Software for professional services" },
      { href: "/free-audit", label: "Get a free website audit" },
    ],
  },
  {
    slug: "healthcare-clinics",
    name: "Healthcare & Clinics",
    seoTitle: "Software for Healthcare Clinics and Practices | Delvix Studio",
    seoDescription:
      "Online booking, patient intake forms, reminders, and staff tools for clinics and private practices. Built by Delvix Studio with careful data handling.",
    h1: "Software for Healthcare & Clinics",
    subline:
      "Reduce phone tag, paper intake, and no-shows with booking, forms, and reminders that fit how your front desk works.",
    intro:
      "Clinics spend a surprising amount of staff time on tasks that are not care: answering the phone to book appointments, handing out clipboards, re-keying intake forms, and chasing patients who forgot a visit. Delvix Studio builds practical tools that take those tasks off your front desk: online booking, digital intake, appointment reminders, and simple staff dashboards. Healthcare data is sensitive, so we scope carefully. We do not claim any certification or compliance status for our own work. If your project involves protected health information, we discuss requirements, hosting, and vendor agreements with you and your compliance advisor at the start, not after the build.",
    problems: [
      "The front desk phone rings all day with appointment requests, rescheduling, and basic questions that could be self-service.",
      "New patients fill out paper forms in the waiting room, and staff retype them into the record afterward.",
      "No-shows and late cancellations leave gaps in the schedule that are hard to refill.",
      "The website is outdated, slow on phones, or does not clearly show services, hours, insurance information, or how to book.",
      "Referrals, follow-ups, and recall lists are tracked in spreadsheets or on sticky notes.",
    ],
    whatWeBuild: [
      {
        title: "Online booking",
        body: "Appointment scheduling by provider and service type with availability rules, confirmations, and easy rescheduling.",
      },
      {
        title: "Digital patient intake",
        body: "Forms patients complete before the visit on their phone, with clear fields and staff review, so the waiting room clipboard goes away.",
      },
      {
        title: "Reminders and recall",
        body: "Appointment reminders by text or email and lists of patients due for follow-up, to reduce no-shows and keep the schedule full.",
      },
      {
        title: "Clinic website",
        body: "A fast, clear, mobile-friendly site that explains services, providers, location, and how to get an appointment.",
      },
      {
        title: "Staff dashboard",
        body: "A daily view of appointments, incoming forms, and tasks so the team knows what needs attention.",
      },
    ],
    beforeAfter: [
      {
        before: "Patients call during business hours to book.",
        after: "Patients book online at any time, and the front desk handles exceptions.",
      },
      {
        before: "New patients complete paper forms in the waiting room.",
        after: "Patients complete intake on their phone before arriving.",
      },
      {
        before: "Missed appointments are discovered when the patient does not arrive.",
        after: "Automatic reminders and easy rescheduling reduce empty slots.",
      },
      {
        before: "Recall lists are maintained by hand in a spreadsheet.",
        after: "A list of patients due for follow-up is generated and tracked in one place.",
      },
    ],
    integrations: [
      "Practice management or EHR systems (where an API exists)",
      "Google Calendar and Outlook",
      "SMS and email reminder providers",
      "Payment processors",
      "Telehealth platforms (linking to your chosen provider)",
      "Online review platforms",
    ],
    auditCta: {
      title: "Check how your clinic site looks to new patients",
      body: "Patients often choose a clinic from a phone search. Our free audit checks mobile speed and layout, broken pages and links, forms, SSL, and calls to action, and gives you a real report with screenshots.",
    },
    faq: [
      {
        q: "Are you HIPAA certified?",
        a: "There is no official HIPAA certification for software developers, and we do not claim one. If your project handles protected health information, we discuss hosting, vendor agreements, and safeguards with you and your compliance advisor before building.",
      },
      {
        q: "Can you integrate with our EHR?",
        a: "It depends on whether your EHR vendor offers an API and what access they allow. Many do not, so we confirm this first and design around the limits.",
      },
      {
        q: "Can patients cancel and reschedule themselves?",
        a: "Yes. We can build self-service rescheduling with rules you control, such as cutoff times.",
      },
      {
        q: "Do you build patient-facing mobile apps?",
        a: "Yes, with Flutter or React Native, though for many clinics a well-built mobile web experience is cheaper and sufficient.",
      },
      {
        q: "Who owns the system after it is built?",
        a: "You do. Code ownership transfers on final payment, and we can sign an NDA on request.",
      },
    ],
    relatedPages: [
      { href: "/technologies/flutter", label: "Flutter mobile apps" },
      { href: "/security", label: "How we handle security" },
      { href: "/free-audit", label: "Get a free website audit" },
    ],
  },
  {
    slug: "construction-trades",
    name: "Construction & Trades",
    seoTitle: "Software for Construction and Trades | Delvix Studio",
    seoDescription:
      "Estimate request forms, job tracking, crew scheduling, and field apps for contractors and trades businesses. Built by Delvix Studio.",
    h1: "Software for Construction & Trades",
    subline:
      "Turn estimate requests, job schedules, and field paperwork into one system your office and crews can both use.",
    intro:
      "Contractors and trade businesses juggle bids, crews, materials, change orders, and customers, usually with a mix of a truck-seat notebook, text threads, and a spreadsheet. The work is physical, so software has to be fast to use on a phone with dusty hands. Delvix Studio builds tools that capture estimate requests properly, organize jobs from bid to completion, schedule crews, and let the field send photos and updates back to the office without a phone call. We keep it practical and built around your actual job flow.",
    problems: [
      "Estimate requests come in by phone, text, and web form with different details every time, so the first site visit is spent gathering basics.",
      "Job schedules live in someone's head or on a whiteboard, and crew changes are communicated by text.",
      "Progress photos, change orders, and notes from the job site are scattered across personal phones.",
      "Quotes and invoices are built from scratch in a word processor or spreadsheet, which slows billing.",
      "Material lists and purchase orders are tracked on paper, leading to missed items and duplicate orders.",
    ],
    whatWeBuild: [
      {
        title: "Estimate request form",
        body: "A guided form that collects the project type, address, photos, and timeline so your estimator arrives prepared and can prioritize leads.",
      },
      {
        title: "Job tracking board",
        body: "A view of every job from bid to completion with status, assigned crew, dates, and notes.",
      },
      {
        title: "Crew scheduling",
        body: "A shared calendar by crew and job with notifications when schedules change.",
      },
      {
        title: "Field app",
        body: "A mobile tool for crews to check in, upload photos, log notes and materials, and capture customer sign-off.",
      },
      {
        title: "Quote and invoice builder",
        body: "Reusable line items and templates that turn an estimate into a clean quote and then an invoice, with fewer retyped numbers.",
      },
    ],
    beforeAfter: [
      {
        before: "Estimate requests arrive as scattered calls and texts.",
        after: "Requests come in through one form with address, photos, and scope.",
      },
      {
        before: "The schedule is on a whiteboard and updated by text.",
        after: "The schedule is shared, and crews are notified of changes automatically.",
      },
      {
        before: "Site photos stay on personal phones.",
        after: "Photos are uploaded to the job record from the field.",
      },
      {
        before: "Quotes are rebuilt from scratch each time.",
        after: "Quotes use saved line items and templates.",
      },
    ],
    integrations: [
      "Accounting software (QuickBooks)",
      "Google Calendar",
      "SMS and email notifications",
      "Payment processors",
      "Supplier price lists (via import)",
      "Document and e-signature tools",
    ],
    auditCta: {
      title: "See what homeowners see when they find you online",
      body: "Most local searches happen on a phone. Our free audit checks mobile speed, broken links, quote forms, SSL, and calls to action, and gives you a real report with screenshots.",
    },
    faq: [
      {
        q: "Will my crews actually use it?",
        a: "That depends on how simple it is, so we design around the fewest taps and test with the people who will use it. If a task is not easier than a text message, we simplify it.",
      },
      {
        q: "Can the field app work without a signal?",
        a: "It can be designed to work offline and sync later. This adds scope, so we agree on which actions need offline support during planning.",
      },
      {
        q: "Can you connect to QuickBooks?",
        a: "In most cases yes, through the accounting provider's API. We confirm the specific data you need to move before scoping.",
      },
      {
        q: "We already use a trade-specific platform. Do we need something custom?",
        a: "Maybe not. If an existing product covers most of your needs, we will say so. Custom software tends to make sense when your process is unusual or off-the-shelf tools force workarounds.",
      },
      {
        q: "Can you also build our website?",
        a: "Yes. A fast, mobile-friendly site with a clear estimate request form is often the first thing we recommend.",
      },
    ],
    relatedPages: [
      { href: "/technologies/react-native", label: "React Native mobile apps" },
      { href: "/industries/logistics-trucking", label: "Software for logistics and trucking" },
      { href: "/free-audit", label: "Get a free website audit" },
    ],
  },
  {
    slug: "retail-inventory",
    name: "Retail & Inventory",
    seoTitle: "Software for Retail and Inventory Businesses | Delvix Studio",
    seoDescription:
      "Inventory tracking, order management, supplier tools, and online store customization for retail and wholesale businesses. Built by Delvix Studio.",
    h1: "Software for Retail & Inventory",
    subline:
      "Keep stock counts, orders, and suppliers in sync so you stop overselling, over-ordering, and reconciling spreadsheets at night.",
    intro:
      "Retail and wholesale businesses live and die by knowing what they have, where it is, and what to reorder. When stock is tracked across a point-of-sale system, an online store, a warehouse sheet, and someone's memory, the numbers drift. Delvix Studio builds software that ties these together: inventory tracking that reflects real movement, order management that does not require retyping, supplier and reorder tools, and customizations for your online storefront. We often start by cleaning up and centralizing the data you already have, then build the screens your team needs to run the day.",
    problems: [
      "Stock counts differ between the store system, the website, and the warehouse spreadsheet, leading to oversells and canceled orders.",
      "Reordering depends on someone walking the shelves or remembering what is low.",
      "Orders from marketplaces, the website, and phone customers are handled in separate places and re-entered by hand.",
      "Supplier prices, lead times, and SKUs change, and the information is kept in emails and scattered files.",
      "End-of-month reconciliation takes days because nothing matches without manual cleanup.",
    ],
    whatWeBuild: [
      {
        title: "Inventory tracking system",
        body: "A central record of products, variants, locations, and quantities with adjustments, transfers, and a history of who changed what.",
      },
      {
        title: "Order management",
        body: "A single queue for orders from all channels, with picking, packing, and status updates that sync back to customers.",
      },
      {
        title: "Reorder alerts and supplier tools",
        body: "Low-stock thresholds, suggested purchase orders, and a record of supplier terms and lead times.",
      },
      {
        title: "Store and catalog customization",
        body: "Custom product pages, bulk upload tools, and wholesale ordering portals on top of your existing store platform.",
      },
      {
        title: "Reports your team will read",
        body: "Plain views of slow movers, best sellers, and stock value, instead of exports that need hours of cleanup.",
      },
    ],
    beforeAfter: [
      {
        before: "Stock levels differ between channels.",
        after: "One inventory record updates every channel.",
      },
      {
        before: "Someone walks the shelves to find what is low.",
        after: "Low-stock alerts and suggested purchase orders are generated automatically.",
      },
      {
        before: "Orders from different channels are retyped into one sheet.",
        after: "Orders flow into a single queue with consistent status tracking.",
      },
      {
        before: "Month-end reconciliation takes days.",
        after: "Adjustments are logged as they happen, so reports match what is on the shelf.",
      },
    ],
    integrations: [
      "Shopify and WooCommerce",
      "Point-of-sale systems (where an API is available)",
      "Marketplaces such as Amazon and eBay (via their APIs)",
      "Accounting software (QuickBooks)",
      "Shipping carriers and label providers",
      "Barcode scanners",
    ],
    auditCta: {
      title: "Check your online store for conversion leaks",
      body: "Slow pages and confusing checkouts cost sales. Our free audit looks at mobile speed, broken pages and links, forms, SSL, mobile layout, and calls to action, and sends a real report with screenshots.",
    },
    faq: [
      {
        q: "Can you sync inventory between our store and our website?",
        a: "Usually, if both systems have APIs. We confirm what each platform supports and design the sync around its rate limits and data rules.",
      },
      {
        q: "Can you migrate our spreadsheet inventory?",
        a: "Yes. We clean up duplicates, inconsistent SKUs, and missing data, and import it into a proper database with checks along the way.",
      },
      {
        q: "Do you support barcode scanning?",
        a: "Yes. Phone cameras or standard USB or Bluetooth scanners can work for receiving, counting, and picking.",
      },
      {
        q: "Should we replace Shopify with something custom?",
        a: "Usually not. We would customize or extend what you have unless it cannot do something essential to your business.",
      },
      {
        q: "Can you build a wholesale ordering portal?",
        a: "Yes. Trade customers can log in, see their pricing, and reorder quickly instead of emailing purchase orders.",
      },
    ],
    relatedPages: [
      { href: "/technologies/postgresql", label: "PostgreSQL databases" },
      { href: "/technologies/nodejs", label: "Node.js integrations" },
      { href: "/free-audit", label: "Get a free website audit" },
    ],
  },
  {
    slug: "professional-services",
    name: "Professional Services",
    seoTitle: "Software for Professional Services Firms | Delvix Studio",
    seoDescription:
      "Client intake, proposal and document workflows, client portals, and internal tools for consultancies, accounting, legal, and agency teams. Built by Delvix Studio.",
    h1: "Software for Professional Services",
    subline:
      "Cut the admin around intake, documents, and client updates so your billable people spend more time on billable work.",
    intro:
      "Consultancies, accounting firms, agencies, and other professional service teams sell expertise, but a lot of their week goes to coordination: collecting information from new clients, chasing documents, producing proposals, and answering status questions. Those tasks tend to live in email threads and shared drives. Delvix Studio builds software that structures them: client intake that gathers the right information once, portals for document exchange and status, proposal and engagement workflows, and internal dashboards that show where each matter stands. Where it helps, we add AI features such as summarizing documents or drafting replies, always with a person approving the output.",
    problems: [
      "New client onboarding means a long email chain of questions, attachments, and reminders.",
      "Clients send documents by email, and staff have to sort, rename, and file them manually.",
      "Proposals and engagement letters are assembled from old files, with details copied in by hand.",
      "Clients regularly ask for status updates because there is no place they can check themselves.",
      "Utilization and project status are tracked in spreadsheets that are never quite current.",
    ],
    whatWeBuild: [
      {
        title: "Client intake and onboarding",
        body: "Structured forms that collect information and documents from new clients, with automatic reminders for anything outstanding.",
      },
      {
        title: "Client portal",
        body: "A secure place for clients to upload documents, review deliverables, and see the status of their matter or project.",
      },
      {
        title: "Proposal and engagement workflow",
        body: "Templates that fill in client and scope details, route for internal approval, and track what has been sent and signed.",
      },
      {
        title: "Internal project dashboard",
        body: "A view of active matters, owners, deadlines, and blockers so the partners can see the whole practice at a glance.",
      },
      {
        title: "AI-assisted document handling",
        body: "Summaries, data extraction, and draft responses from client documents, reviewed by your staff before use.",
      },
    ],
    beforeAfter: [
      {
        before: "Onboarding questions go back and forth by email.",
        after: "The client completes one structured intake and uploads documents in one place.",
      },
      {
        before: "Staff rename and file attachments by hand.",
        after: "Uploads land in the right client record with consistent naming.",
      },
      {
        before: "Proposals are assembled from old documents.",
        after: "Proposals are generated from templates and approved in a defined workflow.",
      },
      {
        before: "Clients email to ask for status.",
        after: "Clients check progress in their portal.",
      },
    ],
    integrations: [
      "Google Workspace and Microsoft 365",
      "Accounting and billing software (QuickBooks, Xero)",
      "Practice or CRM tools (HubSpot and others with APIs)",
      "E-signature providers",
      "Calendar scheduling tools",
      "OpenAI and Anthropic models for document features",
    ],
    auditCta: {
      title: "Does your site convince a prospect to reach out?",
      body: "Clients often vet you online first. Our free audit checks mobile speed, broken pages and links, contact forms, SSL, mobile layout, and calls to action, and provides a real report with screenshots.",
    },
    faq: [
      {
        q: "Can you build for regulated professions like legal or accounting?",
        a: "We can build the software, and we take client confidentiality seriously, including NDAs on request. Your firm remains responsible for meeting professional and regulatory obligations, and we work with your requirements.",
      },
      {
        q: "Do you add AI features?",
        a: "Where they help, such as summarizing documents or drafting replies. We keep a person in the loop for anything client-facing, and we are clear about the limits.",
      },
      {
        q: "Can the portal integrate with our document system?",
        a: "Often yes, if it has an API. Otherwise we can build a simple storage layer for the portal itself.",
      },
      {
        q: "We are a small firm. Is custom software overkill?",
        a: "Sometimes. If an off-the-shelf tool covers your needs, we will say so. Custom work tends to pay off for workflows that are specific to your practice.",
      },
      {
        q: "How do we keep client data separate?",
        a: "We design access controls so each client sees only their own records, and staff permissions follow roles you define.",
      },
    ],
    relatedPages: [
      { href: "/technologies/openai", label: "OpenAI integrations" },
      { href: "/technologies/anthropic", label: "Anthropic Claude integrations" },
      { href: "/security", label: "How we handle security" },
    ],
  },
  {
    slug: "education",
    name: "Education",
    seoTitle: "Software for Education and Training Providers | Delvix Studio",
    seoDescription:
      "Enrollment forms, course and student portals, scheduling, and communication tools for schools, tutoring centers, and training providers. Built by Delvix Studio.",
    h1: "Software for Education",
    subline:
      "Simplify enrollment, scheduling, and communication for schools, tutoring centers, and training providers without forcing a one-size-fits-all platform on your teachers.",
    intro:
      "Small schools, tutoring centers, and training companies often outgrow spreadsheets and email long before they can justify a large learning management system. Enrollment forms arrive as attachments, class schedules change weekly, and parents or learners ask the same questions repeatedly. Delvix Studio builds focused tools for those organizations: online enrollment, class and tutor scheduling, student and parent portals, and simple progress tracking. We build for the way your staff and instructors actually work and avoid features you will never use. If a standard learning platform fits your needs, we will tell you before suggesting something custom.",
    problems: [
      "Enrollment arrives through forms, emails, and phone calls, and someone has to consolidate them into a roster.",
      "Class and tutor schedules change often, and updates are sent individually by text or email.",
      "Parents and learners ask the same questions about fees, dates, and materials because there is no central place to find answers.",
      "Attendance and progress are recorded on paper or in separate spreadsheets that are hard to summarize.",
      "Payments and invoices are tracked manually, making it hard to see who has paid.",
    ],
    whatWeBuild: [
      {
        title: "Online enrollment and registration",
        body: "Forms for programs and classes with required fields, document uploads, and a clean roster for staff.",
      },
      {
        title: "Scheduling and session management",
        body: "Class calendars, tutor availability, room or resource booking, and notifications when anything changes.",
      },
      {
        title: "Student and parent portal",
        body: "A login where families see schedules, announcements, materials, and payment status.",
      },
      {
        title: "Attendance and progress tracking",
        body: "Simple tools for instructors to mark attendance and record progress notes, with summaries for administrators.",
      },
      {
        title: "Payments and billing",
        body: "Online payments, installment tracking, and reminders for balances due, built on a payment processor you choose.",
      },
    ],
    beforeAfter: [
      {
        before: "Enrollment forms are emailed and merged into a roster by hand.",
        after: "Enrollment is submitted online and added to a live roster.",
      },
      {
        before: "Schedule changes are texted to each family.",
        after: "A schedule change updates the portal and sends notifications.",
      },
      {
        before: "Attendance is taken on paper and entered later.",
        after: "Instructors mark attendance in the app during class.",
      },
      {
        before: "Staff chase payments from a spreadsheet.",
        after: "Payment status is visible per student with automatic reminders.",
      },
    ],
    integrations: [
      "Google Workspace and Google Classroom",
      "Zoom and other video platforms (via links or APIs)",
      "Payment processors",
      "Email and SMS providers",
      "Accounting software",
      "Existing student information systems (where an API exists)",
    ],
    auditCta: {
      title: "Check how your enrollment pages work on a phone",
      body: "Parents often browse and enroll from their phones. Our free audit reviews mobile speed and layout, broken pages and links, forms, SSL, and calls to action, and provides a real report with screenshots.",
    },
    faq: [
      {
        q: "Can you build a full learning management system?",
        a: "We can build focused features such as course pages and progress tracking. For a complete LMS, an established platform is often more cost-effective, and we will say so if that fits.",
      },
      {
        q: "How do you handle student data?",
        a: "We design role-based access so families only see their own information and staff see what they need. If you operate under specific privacy requirements, we review them with you at the start.",
      },
      {
        q: "Can parents pay online?",
        a: "Yes, through a payment processor integrated with your system.",
      },
      {
        q: "Can this work for online courses as well as in-person classes?",
        a: "Yes. We can support live-session links, recorded content, and mixed formats.",
      },
      {
        q: "Do you build mobile apps for schools?",
        a: "Yes, with Flutter or React Native. Many organizations start with a mobile-friendly portal and add an app later.",
      },
    ],
    relatedPages: [
      { href: "/technologies/nextjs", label: "Next.js websites and portals" },
      { href: "/technologies/flutter", label: "Flutter mobile apps" },
      { href: "/free-audit", label: "Get a free website audit" },
    ],
  },
  {
    slug: "startups-saas",
    name: "Startups & SaaS",
    seoTitle: "Software Development for Startups and SaaS | Delvix Studio",
    seoDescription:
      "MVP development, SaaS product builds, and ongoing engineering support for startups and early-stage software companies. Built by Delvix Studio.",
    h1: "Software for Startups & SaaS",
    subline:
      "Get a real first version in front of users, keep the codebase healthy enough to build on, and add engineering capacity without a full-time hire.",
    intro:
      "Early-stage teams have two competing needs: learn from real users quickly and avoid building something that has to be thrown away. Delvix Studio works with founders and small product teams to scope a focused first version, build it on a mainstream stack, and then keep improving it. We favor common, well-supported tools such as Next.js, Node.js, PostgreSQL, and AWS so you can hire for them later. We will also tell you when a feature can wait, when a no-code tool is enough for now, and when something in the plan is likely to cost more than it returns.",
    problems: [
      "The idea is clear but the scope is not, and a full wish list would take far longer and cost far more than the budget allows.",
      "A prototype built quickly by a freelancer or a template is hard to extend, and nobody is sure what is safe to change.",
      "Billing, user accounts, roles, and admin tools take weeks that could have gone into the core product.",
      "There is no engineering capacity between launch and the next funding milestone to handle bugs and improvements.",
      "Founders are unsure whether to build web first or mobile first, and what to buy rather than build.",
    ],
    whatWeBuild: [
      {
        title: "MVP development",
        body: "A focused first version that covers the core user flow, built on a stack you can grow with, with a clear list of what was deliberately left out.",
      },
      {
        title: "SaaS foundations",
        body: "User accounts, roles, subscriptions and billing, email notifications, and an admin area, so the product team can work on what is unique.",
      },
      {
        title: "Web and mobile front ends",
        body: "Next.js or React web apps and React Native or Flutter mobile apps that share a single back end.",
      },
      {
        title: "AI features",
        body: "Practical features using OpenAI or Anthropic models, such as extraction, summarization, or assisted drafting, with logging and cost controls.",
      },
      {
        title: "Ongoing engineering support",
        body: "A dedicated developer or a retainer for fixes, improvements, and infrastructure, so you have capacity without hiring early.",
      },
    ],
    beforeAfter: [
      {
        before: "A long wish list with no clear first release.",
        after: "A scoped MVP with a defined must-have set and a backlog for later.",
      },
      {
        before: "A prototype nobody wants to touch.",
        after: "A typed, organized codebase with documentation and ownership transferred to you.",
      },
      {
        before: "Weeks go to login, billing, and admin screens.",
        after: "Those foundations are in place early so effort goes to the core product.",
      },
      {
        before: "Bugs wait for the next hire.",
        after: "A retainer or dedicated developer handles fixes and improvements.",
      },
    ],
    integrations: [
      "Stripe and other payment providers",
      "Authentication providers",
      "Transactional email and SMS services",
      "Analytics and error monitoring tools",
      "AWS services",
      "OpenAI and Anthropic APIs",
    ],
    auditCta: {
      title: "Check your landing page before you spend on traffic",
      body: "A slow or confusing page wastes ad spend and early interest. Our free audit checks mobile speed, broken pages and links, forms, SSL, mobile layout, and calls to action, and returns a real report with screenshots.",
    },
    faq: [
      {
        q: "Do I own the code and IP?",
        a: "Yes. Code ownership transfers to you on final payment, and we can sign an NDA on request before we discuss your idea.",
      },
      {
        q: "How do you handle changing scope?",
        a: "With a fixed-price engagement, we agree on scope up front and handle changes through a clear change process. With a dedicated or retainer model, priorities can change week to week.",
      },
      {
        q: "Should we build web or mobile first?",
        a: "It depends on how your users will use the product. Many products start on the web because it is faster to ship and update, and add a mobile app once the core flow is proven.",
      },
      {
        q: "Can you work with our in-house developers?",
        a: "Yes. We can add capacity alongside your team, follow your repository and review process, or build a module they will own.",
      },
      {
        q: "Will the codebase be easy for new hires to understand?",
        a: "We use mainstream tools, TypeScript, and consistent structure, and we document how to run and deploy the project, which helps future hires.",
      },
    ],
    relatedPages: [
      { href: "/technologies/nextjs", label: "Next.js development" },
      { href: "/technologies/aws", label: "AWS hosting" },
      { href: "/pricing", label: "Engagement models and pricing" },
    ],
  },
];

export function getIndustryPage(slug: string): IndustryPageContent | undefined {
  return industryPages.find((page) => page.slug === slug);
}
