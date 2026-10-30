
class Component extends DCLogic {
  renderVals() {
    const it = (icon, title, desc, href, active) => ({ icon, title, desc, href, bg: active ? '#F5F7FB' : 'transparent' });
    return {
      groups: [
        { title: 'What we build', items: [
          it('M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20', 'Web applications', 'Portals, dashboards, internal tools', '/services/web-applications', true),
          it('M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2', 'Mobile apps', 'iOS and Android', '/services/mobile-apps'),
          it('M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10', 'Custom ERP', 'Operations in one system', '/services/erp-development'),
          it('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8z', 'Custom CRM', 'Your sales process, built in', '/services/crm-development'),
          it('M17.5 19H7a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 11 4 4 0 0 1 17.5 19z', 'SaaS platforms', 'Multi-tenant, billing-ready', '/services/saas-development')
        ] },
        { title: 'How we work', items: [
          it('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6', 'Fixed-price projects', 'Written scope, agreed price', '/services/fixed-price-projects'),
          it('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM17 11l2 2 4-4', 'Dedicated developers', 'Extra hands in your team', '/services/dedicated-developers'),
          it('M21 12a9 9 0 1 1-3-6.7M21 4v5h-5', 'Product retainer', 'Monthly improvements', '/services/product-retainer'),
          it('M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'Project rescue', 'Take over a stalled build', '/services/project-rescue'),
          it('M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM16 8l-2 6-6 2 2-6z', 'Technical consulting', 'A senior view on your plan', '/services/technical-consulting')
        ] },
        { title: 'By stage', items: [
          it('M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 4c3-1 6-1 6-1s0 3-1 6l-7 7-5-5 7-7z', 'MVP development', 'Launch the first version', '/services/mvp-development'),
          it('M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM21 21l-5-5', 'Discovery & scoping', 'Plan before you spend', '/services/discovery'),
          it('M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z', 'Legacy modernization', 'Replace old systems safely', '/services/legacy-modernization'),
          it('M4 4h6v6H4zM14 14h6v6h-6zM7 10v4a3 3 0 0 0 3 3h4', 'Automation & integrations', 'Connect your tools', '/services/automation-integrations'),
          it('M3 4h18v12H3zM8 20h8M12 16v4', 'Website development', 'Fast, clear business sites', '/services/website-development')
        ] }
      ]
    };
  }
}
