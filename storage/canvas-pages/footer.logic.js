
class Component extends DCLogic {
  renderVals() {
    return {
      socials: [
        { label: 'LinkedIn', icon: 'M4 9h4v11H4zM6 4a2 2 0 1 0 0 4a2 2 0 0 0 0-4zM10 9h4v1.5c.6-1 2-1.8 3.5-1.8 2.6 0 3.5 1.7 3.5 4.3V20h-4v-6c0-1.2-.4-2-1.6-2s-1.4 1-1.4 2v6h-4z' },
        { label: 'Instagram', icon: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM17.5 6.5h.01' },
        { label: 'Facebook', icon: 'M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z' }
      ],
      cols: [
        { title: 'Services', links: ['Web applications', 'Mobile apps', 'Custom ERP', 'Custom CRM', 'SaaS platforms', 'Project rescue'] },
        { title: 'AI', links: ['AI integrations', 'AI agents', 'Document processing', 'Chatbots', 'Delvix Autopilot'] },
        { title: 'Industries', links: ['Logistics & trucking', 'Real estate', 'Clinics', 'Construction', 'Retail', 'All industries'] },
        { title: 'Company', links: ['About', 'How we work', 'Work', 'Pricing', 'Security', 'Contact'] },
        { title: 'Legal', links: ['Privacy', 'Terms', 'Cookies'] }
      ]
    };
  }
}
