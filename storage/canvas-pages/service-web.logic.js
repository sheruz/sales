
class Component extends DCLogic {
  renderVals() {
    return {
      problems: [
        { title: 'Data in five places', text: 'The same customer or order is typed into a sheet, an email and a WhatsApp group.' },
        { title: 'Nobody knows the status', text: 'Your team asks "where is this?" because there is no single screen to check.' },
        { title: 'Tools that almost fit', text: 'You pay for software that covers 70% of the job and work around the rest by hand.' },
        { title: 'Customers wait on you', text: 'Clients email for updates, quotes or documents they could see themselves in a portal.' }
      ],
      gets: [
        { icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8z', title: 'Roles and permissions', text: 'Admin, staff and customer access, each seeing only what they should.' },
        { icon: 'M3 3v18h18M7 15l4-4 3 3 5-6', title: 'Dashboards and reports', text: 'The numbers you check every morning, on one screen.' },
        { icon: 'M4 4h6v6H4zM14 14h6v6h-6zM7 10v4a3 3 0 0 0 3 3h4', title: 'Integrations', text: 'Payments, email, calendar, accounting and your existing tools.' },
        { icon: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2', title: 'Works on every screen', text: 'Responsive layouts for desktop, tablet and phone.' },
        { icon: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5zM9 12l2 2 4-4', title: 'Security basics built in', text: 'Encrypted credentials, access control, audit logs and backups.' },
        { icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6', title: 'Handover docs', text: 'Source code, setup guide and admin training on launch.' }
      ],
      process: [
        { n: '01', title: 'Discovery call', text: 'We walk through your current process, the people involved and what success looks like.', out: 'A clear problem statement' },
        { n: '02', title: 'Written scope', text: 'Screens, features, integrations, price and timeline, on paper.', out: 'Scope + fixed price in 3 days' },
        { n: '03', title: 'Design', text: 'Clickable screens for the main flows, approved before any code.', out: 'Clickable prototype' },
        { n: '04', title: 'Build', text: 'We build in weekly cycles and show you working software every week.', out: 'A demo link every week' },
        { n: '05', title: 'Launch & handover', text: 'Deployment, data import, team training and source code transfer.', out: 'Live app + full code ownership' }
      ],
      fit: ['Your team repeats the same manual steps every day', 'You know the process and want software built around it', 'You want to own the code and data'],
      notFit: ['A ready-made tool already does exactly what you need', 'You need a simple marketing website only', 'The process is still changing every week'],
      tech: ['Next.js', 'React', 'TypeScript', 'Node.js', 'Laravel', 'PostgreSQL', 'AWS'],
      faq: [
        { q: 'Can you work with our existing tools?', a: 'Yes. Most web apps we build connect to tools you already use, such as accounting, email, payments or calendars.' },
        { q: 'Do we need a designer?', a: 'No. Design is part of the project: you approve clickable screens before we build.' },
        { q: 'Can we start small?', a: 'Yes. We often build the first version around one workflow and add more once it is in use.' },
        { q: 'Where is it hosted?', a: 'On your own cloud account (for example AWS) or ours, your choice. You keep full access either way.' },
        { q: 'What does it cost?', a: 'It depends on the screens and integrations. You get a fixed price in the written scope before any work starts.' }
      ]
    };
  }
}
