
class Component extends DCLogic {
  renderVals() {
    return {
      pains: [
        { n: '01', title: 'Dispatch on spreadsheets', text: 'Loads, drivers and trucks tracked in sheets that only one person understands.' },
        { n: '02', title: 'Driver applications by email', text: 'Paper or PDF forms, missing documents and slow follow-up while good drivers go elsewhere.' },
        { n: '03', title: 'Quote requests that wait', text: 'Shippers send requests by phone or email and the fastest carrier wins.' },
        { n: '04', title: 'Documents everywhere', text: 'BOLs, PODs and insurance papers in inboxes, phones and folders.' },
        { n: '05', title: '"Where is my load?" calls', text: 'Customers call for updates your team has to chase drivers for.' }
      ],
      builds: [
        { dir: 'row', title: 'Dispatch board', text: 'See every load, driver and truck on one screen and assign work in a few clicks.', points: ['Drag-and-drop load assignment', 'Driver and truck availability', 'Status updates from the driver app'], img: 'IND-02 · Dispatch board', imgNote: 'Screenshot or mockup of a dispatch board · 1600×1100' },
        { dir: 'row-reverse', title: 'Driver application portal', text: 'A mobile-friendly application that collects licenses and documents and tracks each applicant.', points: ['Works on any phone', 'Document upload and checklists', 'Applicant status for your team'], img: 'IND-03 · Driver application on a phone', imgNote: 'Phone mockup of the application form · 1200×1100' },
        { dir: 'row', title: 'Customer quote form', text: 'Shippers request a quote in under a minute and your team gets every detail in one place.', points: ['Lanes, freight type and dates', 'Instant notification to sales', 'Quote history per customer'], img: 'IND-04 · Quote form', imgNote: 'Screenshot of a quote request flow · 1600×1100' },
        { dir: 'row-reverse', title: 'Document management', text: 'Every BOL, POD and insurance file attached to the right load and customer.', points: ['Upload from the driver app', 'Search by load or customer', 'Expiry reminders for insurance'], img: 'IND-05 · Document library', imgNote: 'Screenshot of documents linked to a load · 1600×1100' }
      ],
      flow: [
        { step: 'Quote request', before: 'Phone call or email, typed into a sheet', after: 'Web form straight into your system' },
        { step: 'Load assigned', before: 'Calls and texts to find a driver', after: 'Assigned on the dispatch board' },
        { step: 'Status updates', before: 'Customer calls to ask', after: 'Driver updates status in the app' },
        { step: 'Paperwork', before: 'Photos sent on WhatsApp', after: 'POD uploaded and attached to the load' },
        { step: 'Invoice', before: 'Built by hand at month end', after: 'Generated from the completed load' }
      ],
      integrations: ['GPS / ELD data feeds', 'QuickBooks', 'Google Workspace', 'Microsoft 365', 'WhatsApp', 'Email'],
      faq: [
        { q: 'Can you connect to our ELD or GPS provider?', a: 'In most cases, yes, if your provider offers an API or data export. We confirm this during the discovery call.' },
        { q: 'Do drivers need to install an app?', a: 'Not always. Many driver features work as a mobile web app that opens from a link.' },
        { q: 'Can we start with one part, like driver applications?', a: 'Yes. Starting with one workflow is common, and the rest can be added later.' },
        { q: 'Who owns the system?', a: 'You do. The source code and data are yours on final payment.' },
        { q: 'How do we start?', a: 'Book a free call. You get a written scope and fixed price within 3 days.' }
      ]
    };
  }
}
