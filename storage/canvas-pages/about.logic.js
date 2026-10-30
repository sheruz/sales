
class Component extends DCLogic {
  renderVals() {
    return {
      principles: [
        { n: '01', title: 'Scope in writing', text: 'Before any code, you get features, price and timeline on paper.' },
        { n: '02', title: 'Show, don’t tell', text: 'A working demo every week instead of status reports.' },
        { n: '03', title: 'Talk to builders', text: 'You speak directly with the developers on your project.' },
        { n: '04', title: 'You own it', text: 'Code, data and accounts are yours on final payment.' },
        { n: '05', title: 'Honest advice', text: 'If a ready-made tool fits better, we’ll tell you.' }
      ],
      photos: [
        { id: 'ABOUT-02', note: 'Your workspace / desk setup · 1200×900' },
        { id: 'ABOUT-03', note: 'You on a client call or whiteboarding · 1200×900' },
        { id: 'ABOUT-04', note: 'Team photo (only if you have a team) · 1200×900' }
      ]
    };
  }
}
