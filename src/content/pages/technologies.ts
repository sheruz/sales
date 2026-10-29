export type TechPageContent = {
  slug: string;
  name: string;
  group: string;
  seoTitle: string;
  seoDescription: string;
  h1: string;
  whyWeUseIt: string;
  whatWeBuild: Array<{ title: string; body: string }>; // 4
  stackFit: string;
  whenSomethingElse: string;
  faq: Array<{ q: string; a: string }>; // 4
  relatedPages: Array<{ href: string; label: string }>; // 3
};

export const technologyPages: TechPageContent[] = [
  {
    slug: "nextjs",
    name: "Next.js",
    group: "Web frameworks",
    seoTitle: "Next.js Development Services | Delvix Studio",
    seoDescription:
      "Delvix Studio builds fast, search-friendly websites and web apps with Next.js. Marketing sites, customer portals, and dashboards that your team can maintain.",
    h1: "Next.js development for sites and apps that need to be fast and findable",
    whyWeUseIt:
      "Next.js lets us build marketing pages and application screens in one codebase. Pages can be rendered ahead of time so they load quickly and are easy for search engines to read, while interactive parts stay interactive. It is built on React, which means a large hiring pool if you ever want to bring development in-house. We also like that deployment options are flexible: you are not locked into one host.",
    whatWeBuild: [
      {
        title: "Marketing and lead-generation websites",
        body: "Service pages, landing pages, and blogs with clean metadata, sensible URLs, and forms that actually reach your inbox or CRM.",
      },
      {
        title: "Customer and client portals",
        body: "Logged-in areas where customers see orders, documents, or project status without emailing your team for updates.",
      },
      {
        title: "Internal dashboards",
        body: "Admin screens on top of your existing database or API so staff can stop working out of spreadsheets.",
      },
      {
        title: "Headless content sites",
        body: "Sites that pull content from a CMS so non-technical people can edit copy without a developer.",
      },
    ],
    stackFit:
      "We usually pair Next.js with TypeScript, PostgreSQL, and either its own server routes or a separate Node.js API when the backend needs to serve a mobile app too. For many small and mid-sized projects, one Next.js codebase is enough and keeps hosting and maintenance simple.",
    whenSomethingElse:
      "If your site is a handful of static pages that rarely change, a simpler static site or a hosted builder may cost you less to run. If your team already lives in Laravel and needs mostly server-rendered CRUD screens, staying in Laravel is often the more practical choice. We will tell you if Next.js is more than you need.",
    faq: [
      {
        q: "Is Next.js good for SEO?",
        a: "It gives you a strong technical base: server-rendered pages, control over titles and descriptions, and good performance options. It does not replace good content and a sensible site structure, which we help with too.",
      },
      {
        q: "Can you add Next.js to my existing website?",
        a: "Sometimes. We can rebuild specific sections, such as a new marketing site, while leaving your current app in place. We would review what you have first before recommending a path.",
      },
      {
        q: "Who owns the code?",
        a: "You do. Code ownership transfers on final payment, and we work in repositories that you can have access to.",
      },
      {
        q: "Where will the site be hosted?",
        a: "We can deploy to a managed platform or to AWS, depending on your budget, traffic, and compliance needs. We explain the monthly cost before you commit.",
      },
    ],
    relatedPages: [
      { href: "/technologies/react", label: "React development" },
      { href: "/technologies/postgresql", label: "PostgreSQL databases" },
      { href: "/free-audit", label: "Get a free website audit" },
    ],
  },
  {
    slug: "react",
    name: "React",
    group: "Web frameworks",
    seoTitle: "React Development Services | Delvix Studio",
    seoDescription:
      "Delvix Studio builds interactive web interfaces with React: dashboards, booking flows, and tools that replace spreadsheets and manual steps.",
    h1: "React development for interfaces people actually enjoy using",
    whyWeUseIt:
      "React is a mature, widely understood library for building interfaces out of reusable pieces. That matters for you in practical ways: components keep the interface consistent as it grows, there is a large ecosystem of well-tested libraries, and almost any web developer can read the code later. We use it when a screen has real interaction in it, such as filtering, editing, drag-and-drop, or live updates.",
    whatWeBuild: [
      {
        title: "Operational dashboards",
        body: "Tables, filters, and status boards that give a team one place to see what needs attention today.",
      },
      {
        title: "Multi-step forms and quote tools",
        body: "Guided flows that collect the right information, validate it as the user goes, and hand clean data to your team.",
      },
      {
        title: "Scheduling and booking interfaces",
        body: "Calendar and availability screens for appointments, crews, drivers, or resources.",
      },
      {
        title: "SaaS product front ends",
        body: "The user-facing side of a software product, built to be extended as you add features.",
      },
    ],
    stackFit:
      "For most web projects we use React through Next.js. For apps that live entirely behind a login, a plain React front end talking to a Node.js, Laravel, or Python API also works well. React skills carry over to React Native, so one team can often reason about both web and mobile.",
    whenSomethingElse:
      "A brochure site with a contact form does not need a JavaScript framework at all. If the interface is mostly forms and tables over a database and you already have a Laravel back end, server-rendered pages can be faster to build and cheaper to maintain. We would rather give you the lighter option when it fits.",
    faq: [
      {
        q: "Do I need React or can a simple website builder do the job?",
        a: "If you need a handful of pages and a contact form, a builder is often fine. React makes sense when the interface has real logic: dashboards, calculators, portals, or tools your staff use all day.",
      },
      {
        q: "Will the app work well on phones?",
        a: "Yes. We design responsive layouts and test on real screen sizes. If you need a native app experience, we would discuss React Native or Flutter.",
      },
      {
        q: "Can you take over a React project someone else started?",
        a: "Often yes. We start with a code review so we can tell you honestly whether to build on it or rework parts of it.",
      },
      {
        q: "How do you keep the interface from getting messy over time?",
        a: "We build reusable components, use TypeScript, and keep logic separated from layout. That makes later changes cheaper.",
      },
    ],
    relatedPages: [
      { href: "/technologies/nextjs", label: "Next.js development" },
      { href: "/technologies/react-native", label: "React Native apps" },
      { href: "/technologies/nodejs", label: "Node.js back ends" },
    ],
  },
  {
    slug: "nodejs",
    name: "Node.js",
    group: "Back end",
    seoTitle: "Node.js Development Services | Delvix Studio",
    seoDescription:
      "Delvix Studio builds APIs, integrations, and back-end services with Node.js and TypeScript for web apps, mobile apps, and automation workflows.",
    h1: "Node.js development for APIs, integrations, and back-end services",
    whyWeUseIt:
      "Node.js lets us use JavaScript and TypeScript on the server as well as in the browser. That means one language across the stack, shared types between front end and back end, and fewer handoffs. It handles many simultaneous connections well, which suits APIs, webhooks, and anything that waits on other services.",
    whatWeBuild: [
      {
        title: "REST and GraphQL APIs",
        body: "Back ends that serve your web app and mobile apps from one source of truth, with authentication and role-based access.",
      },
      {
        title: "Third-party integrations",
        body: "Connections between your software and tools like payment processors, CRMs, accounting systems, email, and SMS providers.",
      },
      {
        title: "Webhook and background job processing",
        body: "Reliable handling of incoming events and scheduled tasks such as reminders, syncs, and report generation.",
      },
      {
        title: "Real-time features",
        body: "Live status updates, notifications, and chat-style features where users should not need to refresh the page.",
      },
    ],
    stackFit:
      "Node.js commonly sits behind a Next.js or React front end, or behind a React Native or Flutter app, with PostgreSQL as the database. Hosting on AWS is a common choice when you need more control than a managed platform gives you.",
    whenSomethingElse:
      "For heavy data processing, machine learning, or document analysis, Python is usually a better fit. If your team or existing system is built on Laravel and you only need to add features, adding a second back-end language rarely pays off. We would keep to what you already have.",
    faq: [
      {
        q: "Do you use TypeScript with Node.js?",
        a: "Yes, by default. It catches many mistakes before they reach users and makes the code easier for the next developer to pick up.",
      },
      {
        q: "Can you integrate with software we already use?",
        a: "Usually, if the tool offers an API or webhooks. We check the documentation and limits before we promise anything.",
      },
      {
        q: "Is Node.js secure enough for business data?",
        a: "Security depends on how it is built and hosted. We use access controls, encrypted credentials, and standard practices, and we keep dependencies updated during support periods.",
      },
      {
        q: "Can one back end serve both web and mobile apps?",
        a: "Yes. That is a common setup and often saves money compared with building two separate back ends.",
      },
    ],
    relatedPages: [
      { href: "/technologies/postgresql", label: "PostgreSQL databases" },
      { href: "/technologies/aws", label: "AWS hosting" },
      { href: "/technologies/python", label: "Python development" },
    ],
  },
  {
    slug: "laravel",
    name: "Laravel",
    group: "Back end",
    seoTitle: "Laravel Development Services | Delvix Studio",
    seoDescription:
      "Delvix Studio builds and maintains business applications, admin panels, and APIs with Laravel and PHP. New builds, upgrades, and rescues.",
    h1: "Laravel development for business applications that need to ship and last",
    whyWeUseIt:
      "Laravel is a mature PHP framework with sensible defaults for authentication, queues, email, file storage, and database work. For internal tools, admin panels, and data-heavy business applications it is often one of the fastest ways to get something solid and maintainable in front of users. PHP hosting is also widely available and inexpensive.",
    whatWeBuild: [
      {
        title: "Admin panels and internal tools",
        body: "Back-office systems for managing customers, jobs, inventory, or content, with roles and permissions for each team member.",
      },
      {
        title: "Custom business workflows",
        body: "Software that follows your actual process, such as quoting, approvals, document handling, and invoicing steps.",
      },
      {
        title: "APIs for web and mobile apps",
        body: "Clean back ends that power a React, Flutter, or React Native front end.",
      },
      {
        title: "Upgrades and rescues of existing Laravel apps",
        body: "Moving older versions forward, fixing performance issues, and making a fragile codebase safer to change.",
      },
    ],
    stackFit:
      "Laravel works well with MySQL or PostgreSQL, and can pair with a React or Next.js front end when you need richer interfaces. If you already run on Laravel, we are generally happy to extend it rather than propose a rewrite.",
    whenSomethingElse:
      "If your product is heavily real-time or your team is entirely JavaScript, Node.js can simplify things. If the core of the project is machine learning or document processing, Python will likely do that part better. A full rewrite of a working Laravel app is rarely the right call, and we will say so.",
    faq: [
      {
        q: "Is PHP still a good choice?",
        a: "For many business applications, yes. Modern PHP with Laravel is well supported, well documented, and has a deep talent pool.",
      },
      {
        q: "Can you upgrade an old Laravel version?",
        a: "Usually. We start with an assessment of the code and its dependencies and then give you an honest scope for the upgrade.",
      },
      {
        q: "Can Laravel work with a modern front end?",
        a: "Yes. It can serve an API to a React or mobile front end or render pages itself, depending on what the project needs.",
      },
      {
        q: "Will we be locked into Delvix to maintain it?",
        a: "No. It is a mainstream framework and you own the code, so another competent PHP developer can pick it up.",
      },
    ],
    relatedPages: [
      { href: "/technologies/postgresql", label: "PostgreSQL databases" },
      { href: "/technologies/react", label: "React front ends" },
      { href: "/contact", label: "Talk to us about your project" },
    ],
  },
  {
    slug: "python",
    name: "Python",
    group: "Back end and AI",
    seoTitle: "Python Development Services | Delvix Studio",
    seoDescription:
      "Delvix Studio uses Python for automation, data processing, document handling, and AI-powered workflows that save your team manual work.",
    h1: "Python development for automation, data work, and AI-powered workflows",
    whyWeUseIt:
      "Python has the best-supported tooling for working with data, documents, and AI models. It is readable, which keeps scripts and services maintainable, and it connects easily to spreadsheets, PDFs, email, and APIs. We reach for it when the job is about processing information rather than serving pages.",
    whatWeBuild: [
      {
        title: "Workflow automation",
        body: "Scripts and services that pull data from email, spreadsheets, or portals and push it where it belongs, without someone retyping it.",
      },
      {
        title: "Document processing",
        body: "Reading invoices, forms, and PDFs into structured data, with a review step for anything uncertain.",
      },
      {
        title: "Data cleanup and reporting",
        body: "Combining exports from several systems into one dependable report your team can trust.",
      },
      {
        title: "AI-powered back ends",
        body: "Services that call language models for classification, summarization, or drafting, with logging and human review built in.",
      },
    ],
    stackFit:
      "Python services typically run alongside a Node.js or Laravel application, communicating through an API or a job queue, and store data in PostgreSQL. Cloud hosting on AWS suits scheduled jobs and longer-running tasks.",
    whenSomethingElse:
      "If you only need a standard web app with forms and dashboards, a Python service adds moving parts you do not need. Node.js or Laravel will usually be simpler. For a one-off task that a no-code automation tool can handle, we would point you there first.",
    faq: [
      {
        q: "Can Python automate our spreadsheet-based processes?",
        a: "Often yes. We start by mapping the steps, then decide whether a script, a small web tool, or a full application makes the most sense.",
      },
      {
        q: "Do you build AI features with Python?",
        a: "Yes, usually by calling established model APIs rather than training models from scratch. See our OpenAI and Anthropic pages for more.",
      },
      {
        q: "How do you handle errors in automations?",
        a: "We build logging and alerts so failures are visible, and we design a manual fallback for anything that matters to your business.",
      },
      {
        q: "Can the automation run without someone launching it?",
        a: "Yes. We can schedule it or trigger it from an event such as a new email, form submission, or file upload.",
      },
    ],
    relatedPages: [
      { href: "/technologies/openai", label: "OpenAI integrations" },
      { href: "/technologies/anthropic", label: "Anthropic Claude integrations" },
      { href: "/technologies/aws", label: "AWS hosting" },
    ],
  },
  {
    slug: "react-native",
    name: "React Native",
    group: "Mobile",
    seoTitle: "React Native App Development | Delvix Studio",
    seoDescription:
      "Delvix Studio builds iOS and Android apps with React Native: driver apps, field tools, and customer apps from a single codebase.",
    h1: "React Native development for iOS and Android apps from one codebase",
    whyWeUseIt:
      "React Native lets us build real native apps for iPhone and Android from a shared codebase. For most business apps, that cuts cost and keeps both platforms consistent. It also shares skills and often logic with a React web app, which helps if you need both a web dashboard and a mobile app.",
    whatWeBuild: [
      {
        title: "Field and driver apps",
        body: "Apps for crews and drivers to see assignments, capture photos and signatures, and update job status from the road.",
      },
      {
        title: "Customer-facing apps",
        body: "Booking, ordering, account, and notification experiences for your customers.",
      },
      {
        title: "Companion apps for web platforms",
        body: "Mobile access to the same data your web dashboard uses, built against a shared API.",
      },
      {
        title: "Internal staff apps",
        body: "Lightweight tools for checklists, inspections, and inventory counts that replace paper and clipboards.",
      },
    ],
    stackFit:
      "React Native apps usually talk to a Node.js or Laravel API and use PostgreSQL behind it. If you already have a React web team or codebase, React Native is the natural next step.",
    whenSomethingElse:
      "If the app depends heavily on advanced graphics, unusual hardware access, or platform-specific features, fully native Swift or Kotlin may serve you better. If you want a highly custom, animation-rich interface with tight control over every pixel, Flutter is worth comparing. If staff only need occasional access, a well-built mobile web app may be enough and much cheaper.",
    faq: [
      {
        q: "Do I need an app, or will a mobile website do?",
        a: "A mobile-friendly web app is cheaper and faster to launch. An app makes sense when you need push notifications, camera access, offline use, or a presence in the app stores.",
      },
      {
        q: "Does the app work offline?",
        a: "It can, if we design for it. Offline support adds scope, so we agree on which actions must work without signal during planning.",
      },
      {
        q: "Who handles App Store and Google Play submission?",
        a: "We guide you through the process and prepare the builds. The store accounts belong to your business.",
      },
      {
        q: "Can the same team build the back end?",
        a: "Yes. We can build the API, admin dashboard, and mobile app together so they fit from day one.",
      },
    ],
    relatedPages: [
      { href: "/technologies/flutter", label: "Flutter development" },
      { href: "/technologies/nodejs", label: "Node.js back ends" },
      { href: "/industries/logistics-trucking", label: "Software for logistics and trucking" },
    ],
  },
  {
    slug: "flutter",
    name: "Flutter",
    group: "Mobile",
    seoTitle: "Flutter App Development | Delvix Studio",
    seoDescription:
      "Delvix Studio builds cross-platform mobile apps with Flutter for teams that want a consistent, custom interface on iOS and Android.",
    h1: "Flutter development for polished cross-platform mobile apps",
    whyWeUseIt:
      "Flutter draws its own interface rather than relying on platform controls, which gives us precise control over how the app looks and behaves on both iOS and Android. It is a strong choice when design consistency matters or when the app has a custom, animated feel. One codebase serves both platforms.",
    whatWeBuild: [
      {
        title: "Customer apps with a branded feel",
        body: "Apps where the interface itself is part of the product experience and should look identical across devices.",
      },
      {
        title: "Booking and service apps",
        body: "Scheduling, payments, reminders, and account management for service businesses and clinics.",
      },
      {
        title: "Data-entry and inspection tools",
        body: "Forms with photo capture, checklists, and sync for people working in the field.",
      },
      {
        title: "MVP mobile apps for startups",
        body: "A first version of a mobile product that covers the core flow so you can learn from real users.",
      },
    ],
    stackFit:
      "Flutter apps connect to the same kinds of back ends we use elsewhere: Node.js or Laravel APIs, with PostgreSQL for data and AWS for hosting. Flutter does not share code with a React web app, so it suits projects where mobile is the primary product.",
    whenSomethingElse:
      "If you already have a React web app and want to reuse skills and logic, React Native is usually a better match. For a simple tool used by a few staff members, a responsive web app is cheaper. For apps that rely deeply on one platform's native features, native development may be the better path.",
    faq: [
      {
        q: "Flutter or React Native, which should I pick?",
        a: "If you have a React web app or team, React Native tends to fit. If design control and a custom interface are the priority, Flutter is a strong option. We will recommend based on your project, not our preference.",
      },
      {
        q: "Will it feel native on iPhone and Android?",
        a: "It can follow each platform's conventions where that matters. Most business users will not notice a difference when it is built carefully.",
      },
      {
        q: "Can Flutter also produce a web version?",
        a: "It can, but for content-heavy or search-driven sites we recommend a separate web build, such as Next.js.",
      },
      {
        q: "What happens after launch?",
        a: "Apps need updates as iOS and Android change. We offer retainer support for fixes and improvements, and you can choose whether to use it.",
      },
    ],
    relatedPages: [
      { href: "/technologies/react-native", label: "React Native development" },
      { href: "/industries/healthcare-clinics", label: "Software for healthcare clinics" },
      { href: "/industries/startups-saas", label: "Software for startups and SaaS" },
    ],
  },
  {
    slug: "postgresql",
    name: "PostgreSQL",
    group: "Data",
    seoTitle: "PostgreSQL Database Development | Delvix Studio",
    seoDescription:
      "Delvix Studio designs and builds on PostgreSQL: reliable data models, migrations from spreadsheets, reporting, and backups for business software.",
    h1: "PostgreSQL database design for software that has to be right",
    whyWeUseIt:
      "PostgreSQL is a reliable, open-source relational database with strong data integrity, good support for structured queries and reporting, and flexible fields when you need them. It is our default for business applications because it handles the unglamorous work well: keeping records consistent, auditable, and fast to query as the data grows.",
    whatWeBuild: [
      {
        title: "Data models that reflect your business",
        body: "Tables and relationships for customers, jobs, orders, documents, and users, designed around how your team actually works.",
      },
      {
        title: "Spreadsheet-to-database migrations",
        body: "Careful cleanup and import of existing spreadsheets, including handling duplicates, inconsistent formats, and missing values.",
      },
      {
        title: "Reporting and search",
        body: "Queries and views behind dashboards, exports, and filters so your team can find answers without asking a developer.",
      },
      {
        title: "Backup and recovery setup",
        body: "Scheduled backups and a restore process that is tested rather than assumed.",
      },
    ],
    stackFit:
      "PostgreSQL works with every back end we build in: Node.js, Laravel, and Python. On AWS we typically run it as a managed database so patching and backups are handled by the platform.",
    whenSomethingElse:
      "If your data is a small amount of simple content, a hosted CMS or even a spreadsheet may be enough. If you have an established MySQL setup under a Laravel app, there is rarely a reason to migrate. For specialized needs, like very high-volume event streams or document-only storage, another database may suit better, and we would discuss it with you.",
    faq: [
      {
        q: "Can you move our spreadsheet data into a real database?",
        a: "Yes. We review the sheets, agree on a clean structure with you, and migrate the data with checks so nothing silently goes missing.",
      },
      {
        q: "Who owns the data?",
        a: "You do. The database lives in an account you control or can take over, and we explain how to export it.",
      },
      {
        q: "How do you protect the data?",
        a: "We use access controls, encrypted credentials, and regular backups. We cover this in more detail on our security page.",
      },
      {
        q: "Will it slow down as we grow?",
        a: "Good design and indexing keep most business applications fast for a long time. We plan for the growth you realistically expect.",
      },
    ],
    relatedPages: [
      { href: "/technologies/aws", label: "AWS hosting" },
      { href: "/technologies/nodejs", label: "Node.js back ends" },
      { href: "/security", label: "How we handle security" },
    ],
  },
  {
    slug: "aws",
    name: "AWS",
    group: "Infrastructure",
    seoTitle: "AWS Cloud Hosting and Deployment | Delvix Studio",
    seoDescription:
      "Delvix Studio deploys and hosts web apps and back ends on AWS with managed databases, file storage, backups, and clear monthly cost estimates.",
    h1: "AWS hosting and deployment for apps that need room to grow",
    whyWeUseIt:
      "AWS offers managed databases, file storage, email delivery, scheduled jobs, and hosting options in one place, with fine control over access and regions. It is useful when an application needs reliable storage, backups, or integrations beyond what a simple host provides. We use it where the added control is worth the added complexity.",
    whatWeBuild: [
      {
        title: "Production deployments",
        body: "Setting up your application to run in an AWS account that belongs to your business, with environments for testing and live use.",
      },
      {
        title: "Managed databases and backups",
        body: "PostgreSQL on a managed service, with automated backups and a documented way to restore.",
      },
      {
        title: "File and document storage",
        body: "Secure storage for uploads such as compliance documents, photos, and signed forms, with access limited to the right users.",
      },
      {
        title: "Scheduled and background jobs",
        body: "Reliable processing for reports, reminders, imports, and automation tasks.",
      },
    ],
    stackFit:
      "AWS pairs with our Node.js, Laravel, and Python services and with PostgreSQL. For a Next.js site that does not need much infrastructure, a simpler managed platform may do the job, and we can use AWS only for the pieces that benefit from it.",
    whenSomethingElse:
      "For a small marketing site or a modest app with predictable traffic, a managed platform is usually cheaper and easier to run. If your company already standardizes on another cloud, we would rather work there than push you to move. We give you an estimated monthly cost up front so there are no surprises.",
    faq: [
      {
        q: "Will the AWS account be in our name?",
        a: "That is our recommendation. It keeps ownership clear and means you are never dependent on us to access your own infrastructure.",
      },
      {
        q: "How much will hosting cost each month?",
        a: "It depends on the size of the application and its traffic. We estimate it during planning and explain which choices affect the bill.",
      },
      {
        q: "Do you handle backups?",
        a: "We set up automated backups for databases and important files and show you how restores work. Retention depends on the agreement for your project.",
      },
      {
        q: "Can you manage hosting after launch?",
        a: "Yes, under a retainer if you want us to handle updates and monitoring. You can also manage it yourself or hand it to another team.",
      },
    ],
    relatedPages: [
      { href: "/technologies/postgresql", label: "PostgreSQL databases" },
      { href: "/security", label: "How we handle security" },
      { href: "/technologies/nodejs", label: "Node.js back ends" },
    ],
  },
  {
    slug: "openai",
    name: "OpenAI",
    group: "AI",
    seoTitle: "OpenAI Integration Services | Delvix Studio",
    seoDescription:
      "Delvix Studio integrates OpenAI models into business software for drafting, classification, extraction, and search, with human review and clear limits.",
    h1: "OpenAI integrations that do a specific job and stay under your control",
    whyWeUseIt:
      "OpenAI offers capable language models through a well-documented API, along with tools for structured output and working with images and audio. We use it for narrow, useful tasks: sorting incoming messages, extracting fields from documents, drafting replies for a person to approve, and answering questions from your own content. We prefer small features that save real time over open-ended chatbots.",
    whatWeBuild: [
      {
        title: "Document and message extraction",
        body: "Pulling names, dates, amounts, and other fields out of emails, PDFs, and forms into structured records, with a review screen for anything uncertain.",
      },
      {
        title: "Drafting assistants",
        body: "Suggested replies, summaries, and descriptions that staff can edit and approve before anything is sent.",
      },
      {
        title: "Classification and routing",
        body: "Tagging and sorting requests so they reach the right person or queue faster.",
      },
      {
        title: "Search over your own content",
        body: "Question-and-answer tools grounded in your documents, with links back to the sources.",
      },
    ],
    stackFit:
      "We call OpenAI from a Node.js or Python service, store results and logs in PostgreSQL, and keep API keys in encrypted configuration. Because the model is behind a thin layer in our code, we can swap or add providers, including Anthropic, without redoing the application.",
    whenSomethingElse:
      "If the task is rule-based, ordinary code is cheaper, faster, and more predictable than a model. If your data cannot leave your own environment, we would discuss options before using any hosted model API. Where Anthropic's models perform better on your particular task, we will recommend that instead, and we test both on your real examples where it matters.",
    faq: [
      {
        q: "Can AI make mistakes?",
        a: "Yes. That is why we design human review into workflows where errors would matter, and why we log inputs and outputs so problems can be investigated.",
      },
      {
        q: "Will our data be used to train models?",
        a: "Provider policies differ by plan and change over time. We review the current terms for the API plan being used and discuss them with you before sending business data.",
      },
      {
        q: "Do I need a chatbot?",
        a: "Often not. A focused feature, such as extracting data from an invoice, can save more time than a general chat window. We help you pick the use case that pays off.",
      },
      {
        q: "What does it cost to run?",
        a: "Usage-based fees depend on volume and the model chosen. We estimate it from your expected workload and design to keep calls efficient.",
      },
    ],
    relatedPages: [
      { href: "/technologies/anthropic", label: "Anthropic Claude integrations" },
      { href: "/technologies/python", label: "Python automation" },
      { href: "/industries/professional-services", label: "Software for professional services" },
    ],
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    group: "AI",
    seoTitle: "Anthropic Claude Integration Services | Delvix Studio",
    seoDescription:
      "Delvix Studio integrates Anthropic's Claude models into business software for long-document analysis, writing assistance, and workflow automation.",
    h1: "Anthropic Claude integrations for document-heavy and writing-heavy workflows",
    whyWeUseIt:
      "Claude models handle long documents and careful, instruction-following writing well, which makes them a strong fit for contracts, reports, policies, and lengthy email threads. We use them where the task involves reading a lot of text and producing a measured, structured result. As with any model, we pair them with review steps and logging.",
    whatWeBuild: [
      {
        title: "Long-document summarization and review",
        body: "Summaries and key-point extraction for reports, agreements, and policies, with references back to the source text.",
      },
      {
        title: "Writing and reply assistants",
        body: "Draft responses and internal notes in your tone, always staged for a person to edit and approve.",
      },
      {
        title: "Knowledge base question answering",
        body: "Tools that answer staff or customer questions from your approved documentation and show where the answer came from.",
      },
      {
        title: "Workflow steps inside automations",
        body: "Classification, triage, and data extraction steps inside larger automated processes.",
      },
    ],
    stackFit:
      "Like our OpenAI work, we connect Claude through a Node.js or Python service with results stored in PostgreSQL and credentials kept encrypted. Keeping the model behind our own interface means you are not locked to a single provider as models change.",
    whenSomethingElse:
      "For simple, rule-based tasks, regular code is the better tool. If another provider's model scores better on your own sample documents, we will recommend it. If your data has strict residency or confidentiality limits, we would review options with you before any text is sent to a hosted API.",
    faq: [
      {
        q: "Should I choose Claude or OpenAI?",
        a: "It depends on the task. We can test both on a sample of your real material and recommend based on results, cost, and speed.",
      },
      {
        q: "Can it read our existing documents?",
        a: "Yes, for supported file types. We prepare and index the content, and we review privacy and access rules with you first.",
      },
      {
        q: "How do you keep outputs trustworthy?",
        a: "We restrict the model to approved sources where possible, show citations, log activity, and require human approval for anything high-stakes.",
      },
      {
        q: "Can this be added to software we already have?",
        a: "Often. If your system has an API or database we can reach, we can add an AI step without rebuilding the whole application.",
      },
    ],
    relatedPages: [
      { href: "/technologies/openai", label: "OpenAI integrations" },
      { href: "/technologies/python", label: "Python automation" },
      { href: "/industries/professional-services", label: "Software for professional services" },
    ],
  },
];

export function getTechnologyPage(slug: string): TechPageContent | undefined {
  return technologyPages.find((page) => page.slug === slug);
}
