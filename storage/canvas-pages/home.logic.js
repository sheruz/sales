
class Component extends DCLogic {
  renderVals() {
    const I = {
      globe: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20',
      phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
      boxes: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
      users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
      cloud: 'M17.5 19H7a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 11 4 4 0 0 1 17.5 19z',
      flow: 'M4 4h6v6H4zM14 14h6v6h-6zM7 10v4a3 3 0 0 0 3 3h4',
      spark: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
      buoy: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM4.9 4.9l4.3 4.3M14.8 14.8l4.3 4.3M14.8 9.2l4.3-4.3M4.9 19.1l4.3-4.3',
      file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6',
      play: 'M6 4l14 8-14 8z',
      shield: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5zM9 12l2 2 4-4',
      clock: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 6v6l4 2',
      tag: 'M20 12l-8 8-9-9V3h8zM7.5 8a.5.5 0 1 0 0-1a.5.5 0 0 0 0 1z',
      msg: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
      send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
      bot: 'M5 8h14v12H5zM12 4v4M9 13h.01M15 13h.01M9 17h6',
      truck: 'M1 4h14v12H1zM15 9h4l3 3v4h-7M5.5 19a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3zM18.5 19a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3z',
      home: 'M3 11l9-8 9 8M5 10v10h14V10',
      steth: 'M6 3v6a4 4 0 0 0 8 0V3M10 13v3a5 5 0 0 0 10 0v-2M20 12a2 2 0 1 0 0-4a2 2 0 0 0 0 4z',
      hat: 'M2 18h20M4 18v-3a8 8 0 0 1 16 0v3M10 7V4h4v3',
      cart: 'M3 3h2l2.4 12h11.2L21 7H6M9 20a1 1 0 1 0 0-2a1 1 0 0 0 0 2zM18 20a1 1 0 1 0 0-2a1 1 0 0 0 0 2z',
      brief: 'M3 7h18v13H3zM8 7V4h8v3M3 13h18',
      cap: 'M2 9l10-5 10 5-10 5-10-5zM6 11v5c3 2 9 2 12 0v-5',
      rocket: 'M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 4c3-1 6-1 6-1s0 3-1 6l-7 7-5-5 7-7zM15 9a1 1 0 1 0 0-2a1 1 0 0 0 0 2z'
    };
    const promisesShort = ['Fixed scope', 'Weekly demos', 'You own the code'];
    const mq = [
      { icon: I.file, text: 'Written scope in 3 days' },
      { icon: I.play, text: 'A working demo every week' },
      { icon: I.tag, text: 'Fixed price, agreed up front' },
      { icon: I.shield, text: 'Your code and IP on final payment' },
      { icon: I.clock, text: 'Overlap with your working hours' },
      { icon: I.msg, text: 'Direct line to the developers' }
    ];
    return {
      promisesShort,
      marquee: mq.concat(mq),
      services: [
        { icon: I.globe, title: 'Web applications', text: 'Portals, dashboards and internal tools that replace spreadsheets and email threads.', href: '/services/web-applications' },
        { icon: I.phone, title: 'Mobile apps', text: 'iOS and Android apps for your customers, drivers or field teams.', href: '/services/mobile-apps' },
        { icon: I.boxes, title: 'Custom ERP', text: 'Inventory, orders, billing and operations in one system built around your process.', href: '/services/erp-development' },
        { icon: I.users, title: 'Custom CRM', text: 'Pipelines, follow-ups and client history the way your team actually sells.', href: '/services/crm-development' },
        { icon: I.cloud, title: 'SaaS platforms', text: 'Multi-tenant products with billing, roles and admin from day one.', href: '/services/saas-development' },
        { icon: I.flow, title: 'Automation & integrations', text: 'Connect your CRM, payments, email and calendar so work moves on its own.', href: '/services/automation-integrations' },
        { icon: I.spark, title: 'AI integrations', text: 'Assistants, document processing and agents connected to your own data.', href: '/ai/ai-integrations' },
        { icon: I.buoy, title: 'Project rescue', text: 'Stalled build or missing developer? We review, plan and get it shipped.', href: '/services/project-rescue' }
      ],
      aiPoints: [
        { icon: I.file, title: 'Document processing', text: 'Read invoices, forms and contracts and put the data where it belongs.' },
        { icon: I.send, title: 'Sales & outreach automation', text: 'Research, personalized emails and reply handling, with you in control.' },
        { icon: I.msg, title: 'Website & WhatsApp assistants', text: 'Answer common questions and capture leads around the clock.' },
        { icon: I.bot, title: 'Agents on your systems', text: 'AI that reads your CRM or database and drafts the next action for approval.' }
      ],
      steps: [
        { n: '01', title: 'Discovery call', text: '30 minutes to understand the problem and your goals.' },
        { n: '02', title: 'Written scope', text: 'Features, price and timeline on paper within 3 days.' },
        { n: '03', title: 'Design', text: 'Clickable screens you approve before we build.' },
        { n: '04', title: 'Build + weekly demos', text: 'See working software every week, not just updates.' },
        { n: '05', title: 'Launch', text: 'Deployment, data migration and team handover.' },
        { n: '06', title: 'Support & grow', text: 'Fixes, improvements and new features on a retainer.' }
      ],
      models: [
        { title: 'Fixed-price project', text: 'Best when the scope is clear: a new app, portal or system.', points: ['Written scope and fixed price', 'Milestone payments', 'Weekly demos'], featured: false, border: '1px solid #E4E7EF', bg: '#FFFFFF', fg: '#0B1220', muted: '#4B5568', btnBg: '#F5F7FB', btnFg: '#0B1220' },
        { title: 'Monthly retainer', text: 'Best for a live product that keeps improving every month.', points: ['Planned work each month', 'Priority fixes', 'Monthly report and roadmap'], featured: true, border: '1px solid #0B1220', bg: '#0B1220', fg: '#F5F7FB', muted: '#A3ADC2', btnBg: '#6366F1', btnFg: '#FFFFFF' },
        { title: 'Dedicated developer', text: 'Best when you need extra hands inside your own team.', points: ['Full-time or part-time', 'Works in your tools', 'Overlap with your hours'], featured: false, border: '1px solid #E4E7EF', bg: '#FFFFFF', fg: '#0B1220', muted: '#4B5568', btnBg: '#F5F7FB', btnFg: '#0B1220' }
      ],
      compare: [
        { row: 'Scope', us: 'Written and fixed in 3 days', them: 'Vague estimate' },
        { row: 'Progress', us: 'Working demo every week', them: 'Status emails' },
        { row: 'Price', us: 'Agreed before work starts', them: 'Changes as you go' },
        { row: 'Code ownership', us: 'Yours on final payment', them: 'Often unclear' },
        { row: 'Who you talk to', us: 'The developers building it', them: 'An account manager' },
        { row: 'Working hours', us: 'Overlap with your timezone', them: 'Their timezone' }
      ],
      industries: [
        { icon: I.truck, title: 'Logistics & trucking', text: 'Dispatch, driver applications, quotes and documents.', img: 'HOME-IND-1', imgNote: 'Photo: truck yard or dispatcher at a screen', href: '/industries/logistics-trucking' },
        { icon: I.home, title: 'Real estate', text: 'Tenant portals, maintenance requests and owner reports.', img: 'HOME-IND-2', imgNote: 'Photo: apartment building or property manager', href: '/industries/real-estate' },
        { icon: I.steth, title: 'Clinics & healthcare', text: 'Bookings, patient intake and reminders.', img: 'HOME-IND-3', imgNote: 'Photo: clinic reception', href: '/industries/healthcare-clinics' },
        { icon: I.hat, title: 'Construction & trades', text: 'Quotes, job scheduling and site reports.', img: 'HOME-IND-4', imgNote: 'Photo: site crew with tablet', href: '/industries/construction-trades' },
        { icon: I.cart, title: 'Retail & inventory', text: 'Stock, orders and multi-location sales.', img: 'HOME-IND-5', imgNote: 'Photo: warehouse shelves', href: '/industries/retail-inventory' },
        { icon: I.brief, title: 'Professional services', text: 'Client portals, intake and billing.', img: 'HOME-IND-6', imgNote: 'Photo: small office team', href: '/industries/professional-services' },
        { icon: I.cap, title: 'Education & training', text: 'Course portals, enrolment and progress tracking.', img: 'HOME-IND-7', imgNote: 'Photo: classroom or online class', href: '/industries/education' },
        { icon: I.rocket, title: 'Startups & SaaS', text: 'MVPs and SaaS products ready to sell.', img: 'HOME-IND-8', imgNote: 'Photo: founders at a whiteboard', href: '/industries/startups-saas' }
      ],
      csStack: ['Next.js', 'TypeScript', 'PostgreSQL', 'Playwright', 'Paddle', 'OpenAI / Claude'],
      auditChecks: ['Mobile speed', 'Broken pages and links', 'Contact and quote forms', 'SSL and security basics', 'Mobile layout', 'Calls to action'],
      stack: [
        { group: 'Frontend', items: ['Next.js', 'React', 'Tailwind'] },
        { group: 'Backend', items: ['Node.js', 'Laravel / PHP', 'Python'] },
        { group: 'Mobile', items: ['React Native', 'Flutter'] },
        { group: 'Data & cloud', items: ['PostgreSQL', 'AWS'] },
        { group: 'AI', items: ['OpenAI', 'Anthropic Claude'] }
      ],
      faq: [
        { q: 'How fast can you start?', a: 'Usually within a week of the discovery call. You get a written scope within 3 days of that call.' },
        { q: 'How does pricing work?', a: 'Fixed price for clearly scoped projects, a monthly fee for retainers, and a monthly rate for dedicated developers. The price is agreed in writing before any work starts.' },
        { q: 'Who owns the code?', a: 'You do. Full source code and IP transfer to you with the final payment.' },
        { q: 'Which timezones do you work with?', a: 'We work remotely with clients in the US, UK, Europe and the Gulf and agree fixed overlap hours with each client.' },
        { q: 'Will you sign an NDA?', a: 'Yes, before we see any confidential details.' },
        { q: 'What happens after launch?', a: 'We fix issues found after launch and can continue on a monthly retainer for improvements and new features.' }
      ]
    };
  }
}
