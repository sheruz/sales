
class Component extends DCLogic {
  renderVals() {
    return {
      nav: [
        { label: 'Services', drop: true },
        { label: 'AI', drop: true },
        { label: 'Industries', drop: true },
        { label: 'Technologies', drop: true },
        { label: 'Work', drop: false },
        { label: 'Company', drop: true }
      ]
    };
  }
}
