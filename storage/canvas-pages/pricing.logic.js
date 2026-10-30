
class Component extends DCLogic {
  renderVals() {
    const light = { border: '1px solid #1E2738', bg: '#121A2B', fg: '#F5F7FB', muted: '#A3ADC2', btnBg: '#1B2340', btnFg: '#F5F7FB', featured: false };
    return {
      models: [
        Object.assign({}, light, { title: 'Fixed-price project', price: '[From $X]', unit: 'per project', text: 'A defined app, portal or system with a written scope.', points: ['Written scope in 3 days', 'Milestone payments', 'Weekly demos', 'Full code ownership'], cta: 'Get a quote' }),
        Object.assign({}, light, { title: 'Monthly retainer', price: '[From $X]', unit: '/ month', text: 'Ongoing improvements to a live product.', points: ['Planned work each month', 'Priority fixes', 'Monthly report', 'Cancel with 30 days notice'], cta: 'Discuss a retainer', featured: true, border: '1px solid #6366F1', bg: '#F5F7FB', fg: '#0B1220', muted: '#4B5568', btnBg: '#6366F1', btnFg: '#FFFFFF' }),
        Object.assign({}, light, { title: 'Dedicated developer', price: '[From $X]', unit: '/ month', text: 'A developer working inside your team and tools.', points: ['Full-time or part-time', 'Overlap with your hours', 'Your tools and process', 'Replace if not a fit'], cta: 'Hire a developer' })
      ],
      offers: [
        { name: '[Offer name, e.g. Website fix + speed-up]', price: '[$X]', text: '[What is included and delivery days]' },
        { name: '[Offer name, e.g. Mobile quote form]', price: '[$X]', text: '[What is included and delivery days]' },
        { name: '[Offer name, e.g. Discovery & scope]', price: '[$X]', text: '[What is included and delivery days]' }
      ],
      factors: [
        { t: 'Number of screens and user roles', d: 'More user types and screens mean more design and build time.' },
        { t: 'Integrations', d: 'Each connected system (payments, accounting, ELD) adds work.' },
        { t: 'Data migration', d: 'Moving existing spreadsheets or old systems into the new one.' },
        { t: 'Mobile apps', d: 'A native app on top of a web app adds a second front end.' },
        { t: 'AI features', d: 'AI usage costs are billed by the provider on your own account.' }
      ],
      faq: [
        { q: 'Do you charge by the hour?', a: 'No. Projects are fixed price based on the written scope. Retainers and dedicated developers are monthly.' },
        { q: 'How do payments work?', a: 'Fixed-price projects are paid in milestones. Monthly plans are paid at the start of each month.' },
        { q: 'What if we need changes during the project?', a: 'Small changes fit into weekly demos. Bigger changes get a written estimate before we do them.' },
        { q: 'Which payment methods do you accept?', a: '[CONFIRM: e.g. bank transfer, card, Payoneer]' }
      ]
    };
  }
}
