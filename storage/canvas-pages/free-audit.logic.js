
class Component extends DCLogic {
  renderVals() {
    return {
      checks: [
        { icon: 'M12 14l4-4M3.3 19a10 10 0 1 1 17.4 0', title: 'Mobile speed', text: 'How long your pages take to show content on a phone, measured with Google PageSpeed.' },
        { icon: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7', title: 'Broken pages and links', text: 'Pages and menu links that return errors or lead nowhere.' },
        { icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6', title: 'Forms', text: 'Whether contact, quote and booking forms load and work on mobile.' },
        { icon: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', title: 'SSL and security basics', text: 'Certificate status, HTTPS redirects and mixed content warnings.' },
        { icon: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2', title: 'Mobile layout', text: 'Sideways scrolling, overlapping elements and buttons too small to tap.' },
        { icon: 'M15 15l-2 5L9 9l11 4-5 2zM3 3l4 4', title: 'Calls to action', text: 'Whether visitors can call, book or ask for a quote without searching.' }
      ],
      how: [
        { n: '01', title: 'Send your website', text: 'Fill in the form. It takes under a minute.' },
        { n: '02', title: 'We run the checks', text: 'A real browser opens your site on desktop and iPhone and records evidence.' },
        { n: '03', title: 'Get your report', text: 'A short email with the top issues, screenshots and what to fix first.' }
      ]
    };
  }
}
