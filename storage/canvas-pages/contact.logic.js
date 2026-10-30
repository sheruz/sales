
class Component extends DCLogic {
  renderVals() {
    return {
      channels: [
        { title: 'Book a free 30-minute call', value: 'Pick a time that suits you', href: '#', icon: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18' },
        { title: 'WhatsApp', value: 'Quickest for short questions', href: '#', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
        { title: 'Email', value: 'info@delvixstudio.com', href: 'mailto:info@delvixstudio.com', icon: 'M3 5h18v14H3zM3 6l9 7 9-7' },
        { title: 'Phone', value: '+1 609 691 6966', href: 'tel:+16096916966', icon: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2' }
      ]
    };
  }
}
