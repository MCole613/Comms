// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const T = require(path.join(__dirname, '..', 'src', 'Timeline.gs'));

const templates = [
  { deliverable: 'Every Request', step: 1, task: 'Review', anchor: 'Submitted', offset: 2, assignee: 'Communications Director' },
  { deliverable: 'Every Request', step: 2, task: 'Sign-off', anchor: 'Submitted', offset: 2, assignee: "Submitter's Approver" },
  { deliverable: 'Every Request', step: 9, task: 'Recap', anchor: 'Event', offset: 3, assignee: "Submitter's Assistant" },
  { deliverable: 'Graphic Design', step: 1, task: 'First draft', anchor: 'Event', offset: -35, assignee: 'Designer' },
  { deliverable: 'Graphic Design', step: 2, task: 'Review draft', anchor: 'Event', offset: -32, assignee: 'Submitter' },
  { deliverable: 'Graphic Design', step: 3, task: 'Final files', anchor: 'Event', offset: -28, assignee: 'Designer' },
  { deliverable: 'Social Media', step: 1, task: 'Schedule posts', anchor: 'Event', offset: -21, assignee: 'Social Media' }
];
const monFri = T.parseWorkDays('Mon, Tue, Wed, Thu, Fri');

test('parseWorkDays handles custom weeks and falls back to Mon–Fri', () => {
  assert.deepEqual(T.parseWorkDays('Tue,Wed,Thu,Fri,Sun'), [true, false, true, true, true, true, false]);
  assert.deepEqual(T.parseWorkDays(''), monFri);
  assert.deepEqual(T.parseWorkDays('nonsense'), monFri);
});

test('only includes tasks for chosen deliverables plus Every Request', () => {
  const r = T.buildTimeline({ eventDate: '2027-03-20', submittedDate: '2027-01-04', deliverables: ['Graphic Design'], templates, workDays: monFri });
  const names = r.items.map(i => i.task);
  assert.ok(names.includes('First draft'));
  assert.ok(names.includes('Review'));
  assert.ok(!names.includes('Schedule posts'));
});

test('event-anchored dates land on the previous work day; sorted by due date', () => {
  // 2027-03-20 is a Saturday. -35 days = Sat 2027-02-13 → Fri 2027-02-12.
  const r = T.buildTimeline({ eventDate: '2027-03-20', submittedDate: '2027-01-04', deliverables: ['Graphic Design'], templates, workDays: monFri });
  const draft = r.items.find(i => i.task === 'First draft');
  assert.equal(draft.dueDate, '2027-02-12');
  assert.equal(r.rush, false);
  const dates = r.items.map(i => i.dueDate);
  assert.deepEqual(dates, [...dates].sort());
  // Post-event task (+3 = Tue 03-23) stays after the event
  assert.equal(r.items.at(-1).task, 'Recap');
  assert.equal(r.items.at(-1).dueDate, '2027-03-23');
});

test('submit-anchored offsets count working days', () => {
  // Friday 2027-01-08 + 2 work days = Tue 2027-01-12
  const r = T.buildTimeline({ eventDate: '2027-03-20', submittedDate: '2027-01-08', deliverables: [], templates, workDays: monFri });
  assert.equal(r.items.find(i => i.task === 'Review').dueDate, '2027-01-12');
});

test('short notice compresses the schedule proportionally and keeps steps in order', () => {
  // Submitted Thu 2027-03-04, event Sat 03-20 — draft would ideally have been due 02-12.
  const r = T.buildTimeline({ eventDate: '2027-03-20', submittedDate: '2027-03-04', deliverables: ['Graphic Design', 'Social Media'], templates, workDays: monFri, minLeadDays: 42 });
  assert.equal(r.rush, true);
  const get = (name) => r.items.find(i => i.task === name);
  assert.equal(get('First draft').rush, true);
  assert.equal(get('First draft').dueDate, '2027-03-05', 'first step starts on the next work day');
  assert.equal(get('First draft').idealDueDate, '2027-02-12');
  // Each step lands on a later day than the one before it.
  assert.ok(get('Review draft').dueDate > get('First draft').dueDate);
  assert.ok(get('Final files').dueDate > get('Review draft').dueDate);
  // Everything pre-event stays before the event, on work days.
  for (const i of r.items.filter(i => i.task !== 'Recap')) {
    assert.ok(i.dueDate < '2027-03-20', i.task);
    const day = T.parseIsoDate(i.dueDate).getDay();
    assert.ok(day >= 1 && day <= 5, i.task + ' on a weekday');
  }
});

test('ideal-notice requests are not compressed', () => {
  const r = T.buildTimeline({ eventDate: '2027-03-20', submittedDate: '2027-01-04', deliverables: ['Graphic Design'], templates, workDays: monFri, minLeadDays: 42 });
  assert.ok(r.items.every(i => i.dueDate === i.idealDueDate));
});

test('enough notice but below minimum lead days is still flagged rush', () => {
  const r = T.buildTimeline({ eventDate: '2027-03-20', submittedDate: '2027-02-01', deliverables: ['Social Media'], templates, workDays: monFri, minLeadDays: 60 });
  assert.equal(r.rush, true);
  assert.ok(r.items.every(i => !i.rush));
});

const team = [
  { email: 'dir@x.org', name: 'Director', role: 'Communications Director' },
  { email: 'd1@x.org', name: 'Designer One', role: 'Designer' },
  { email: 'd2@x.org', name: 'Designer Two', role: 'Designer' },
  { email: 'asst@x.org', name: 'Assistant', role: 'Admin' },
  { email: 'boss@x.org', name: 'Boss', role: 'Leadership' }
];
const fallback = { email: 'dir@x.org', name: 'Director' };

test('assigns based on who submitted (assistant / approver / self)', () => {
  const leader = { email: 'lead@x.org', name: 'Leader', assistantEmail: 'asst@x.org', approverEmail: 'boss@x.org' };
  assert.equal(T.resolveAssignee('Submitter', leader, team, {}, fallback).email, 'lead@x.org');
  assert.equal(T.resolveAssignee("Submitter's Assistant", leader, team, {}, fallback).email, 'asst@x.org');
  assert.equal(T.resolveAssignee("Submitter's Approver", leader, team, {}, fallback).email, 'boss@x.org');

  const solo = { email: 'boss@x.org', name: 'Boss' };
  assert.equal(T.resolveAssignee("Submitter's Assistant", solo, team, {}, fallback).email, 'boss@x.org', 'no assistant → submitter');
  assert.equal(T.resolveAssignee("Submitter's Approver", solo, team, {}, fallback), null, 'no approver → step skipped');
});

test('role tasks go to the least-busy holder, consistently within one request', () => {
  const sub = { email: 'lead@x.org', name: 'Leader' };
  const cache = {};
  const counts = { 'd1@x.org': 5, 'd2@x.org': 1 };
  assert.equal(T.resolveAssignee('Designer', sub, team, counts, fallback, cache).email, 'd2@x.org');
  counts['d2@x.org'] = 99;
  assert.equal(T.resolveAssignee('designer', sub, team, counts, fallback, cache).email, 'd2@x.org', 'same request keeps same designer');
});

test('unfilled roles fall back to the fallback assignee', () => {
  const r = T.resolveAssignee('Video', { email: 'lead@x.org' }, team, {}, fallback);
  assert.equal(r.email, 'dir@x.org');
  assert.match(r.role, /unfilled/);
});
