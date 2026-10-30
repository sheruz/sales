
class Component extends DCLogic {
  renderVals() {
    return {
      facts: [
        { k: 'Client', v: 'Delvix (our own product)' },
        { k: 'Type', v: 'Multi-tenant B2B SaaS' },
        { k: 'Our role', v: 'Product design, engineering, launch' },
        { k: 'Status', v: 'In production · early access for agencies' },
        { k: 'Billing', v: 'Paddle subscriptions + credits' }
      ],
      modules: [
        { n: '01', title: 'Prospect sourcing', text: 'Finds businesses by industry and location through Google Places, with duplicates removed.' },
        { n: '02', title: 'Website crawl + enrichment', text: 'Collects public contact details and finds decision makers through a provider waterfall.' },
        { n: '03', title: 'Deep website audit', text: 'A headless browser checks each site on desktop and mobile and stores screenshot evidence.' },
        { n: '04', title: 'Evidence-based outreach', text: 'AI writes a short email about one verified problem. Nothing invented.' },
        { n: '05', title: 'AI reply agent', text: 'Classifies replies and drafts answers, handing off to a human when needed.' },
        { n: '06', title: 'Packages, credits, Super Admin', text: 'Versioned plans, usage credits, Paddle billing and full platform control.' }
      ],
      shots: [
        { id: 'CS-02', note: 'Deep audit findings with screenshots · 1600×1000', caption: 'Deep audit with real evidence' },
        { id: 'CS-03', note: 'Pipeline / opportunities view · 1600×1000', caption: 'Pipeline from sourced to won' },
        { id: 'CS-04', note: 'Super Admin packages screen · 1600×1000', caption: 'Packages and credits in Super Admin' },
        { id: 'CS-05', note: 'Pitch review: finding next to the email draft · 1600×1000', caption: 'Every email reviewed before sending' }
      ],
      stack: ['Next.js', 'TypeScript', 'PostgreSQL', 'Prisma', 'Playwright', 'Paddle', 'OpenAI / Claude', 'AWS'],
      eng: [
        { title: 'Tenant isolation', text: 'Every query scoped to the organization.' },
        { title: 'Encrypted credentials', text: 'Per-tenant API keys stored encrypted.' },
        { title: 'SSRF protection', text: 'Audits can never reach internal addresses.' },
        { title: 'Credit ledger', text: 'Reserve, commit and refund, charged exactly once.' },
        { title: '2FA + audit logs', text: 'Every Super Admin action is recorded.' },
        { title: 'Isolated audit worker', text: 'Browser jobs run apart from the web app.' }
      ],
      results: [
        { v: '[ADD]', k: 'Companies audited' },
        { v: '[ADD]', k: 'Reply rate' },
        { v: '[ADD]', k: 'Meetings booked' }
      ]
    };
  }
}
