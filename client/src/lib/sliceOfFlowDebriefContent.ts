export const BRIDGE_ROWS = [
  { pizza: 'Order Deck', team: 'Product Backlog', desc: 'All the work that could be done' },
  { pizza: 'Orders Queue', team: 'Sprint Backlog', desc: 'Work committed for this iteration' },
  { pizza: 'Prep Station', team: 'In Development', desc: 'Actively being worked on' },
  { pizza: 'Oven', team: 'In Review / Testing', desc: "Waiting for validation (you can't rush it)" },
  { pizza: 'Pizza Box', team: 'Deployment / Release', desc: 'Ready to ship to the customer' },
  { pizza: 'Served', team: 'Done / In Production', desc: 'Delivered and accepted' },
  { pizza: 'Burnt Pizza', team: 'Defect / Rework', desc: 'Left too long without attention' },
  { pizza: 'Angry Customer', team: 'Missed SLA / Unhappy Stakeholder', desc: 'Lead time exceeded expectations' },
  { pizza: 'WIP Limit', team: 'WIP Limit', desc: 'Stop starting, start finishing' },
  { pizza: 'Push (Round 1)', team: 'Scope Creep / Overcommitment', desc: 'Work forced in regardless of capacity' },
  { pizza: 'Pull (Round 2)', team: 'Pull System / Kanban', desc: 'Take work only when you have capacity' },
] as const;

export const DISCUSSION_QUESTIONS = [
  'Where are the "ovens" (bottlenecks) in our real workflow?',
  'What happens to quality when we take on too much work at once?',
  'How would explicit WIP limits change our daily standup?',
  "What's our team's equivalent of a \"burnt pizza\"?",
  'Do we push work into the system or pull it when we have capacity?',
  'How could we measure lead time for our actual work items?',
] as const;
