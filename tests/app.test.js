// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext, FORMS } = require('./gas-mock');
const { hubTabs } = require('./fixtures/hub');
const { visibleSections } = require('../src/FormLogic.gs');

const NOW = new Date(2026, 10, 20, 9, 0); // Fri Nov 20 2026

function hub(user = 'kids@example.org') {
  // Folders must exist in the mock Drive, so build the context first and then point rows at them.
  const g = createContext({ tabs: hubTabs(), userEmail: user, now: NOW });
  const parent = g.__drive.folder('Comms parent');
  const kids = g.__drive.folder('REQ-2026-006');
  const cfg = g.__sheets.Config.data.find(r => r[0] === 'Drive Parent Folder');
  cfg[1] = parent.getUrl();
  const req = g.__sheets.Requests.data;
  const col = req[0].indexOf('Design Folder');
  req.find(r => r[0] === 'REQ-2026-006')[col] = kids.getUrl();
  return { g, parent, kids };
}

/** Answers keyed by item id, from {title: value}. */
function byTitle(kind, map) {
  const out = {};
  for (const [title, v] of Object.entries(map)) {
    // Some titles repeat across sections (series vs. design details); the later one is the promotion path.
    const it = FORMS[kind].items.filter(i => i.title === title).pop();
    if (!it) throw new Error('No question titled ' + title);
    out[it.id] = v;
  }
  return out;
}

const PROMO = {
  'Your name': 'Kara Kids', 'Ministry / department': 'Calvary Kids',
  'What do you need?': 'Promoting an event or ministry (communications, plus design if needed)',
  'Event or initiative name': 'Spring Kids Camp', 'Who is this for?': 'A specific age group (Kids / Students / Young Adults)',
  'How much of the church is this relevant to?': '25-49%',
  'Is this a "bridge" event designed to invite first-time guests or the community?': 'No',
  'What is the ONE next step you want people to take?': 'Sign up / register',
  'Describe that one next step in a sentence': 'Register in Church Center.',
  'Share one story or human moment that shows why this matters': 'Last year a shy 3rd grader found friends.',
  'Event / launch date': '2027-03-12', 'Does this need registration in PCO / Church Center?': 'Yes',
  'Do you need graphic design for this?': 'Yes', 'What needs to be designed?': ['Main graphic / key art', 'Social graphics']
};

/* ---------------- branching ---------------- */

test('form branching follows the real request form', () => {
  const { g } = hub();
  const desc = g.__call('apiForm', 'request', '');
  const titles = (answers) => visibleSections(desc.sections, answers).indexes.map(i => desc.sections[i].title);

  assert.equal(visibleSections(desc.sections, {}).complete, false, 'must pick what you need first');
  assert.deepEqual(titles(byTitle('request', { 'What do you need?': 'Sermon series' })), [desc.sections[0].title, 'Sermon series details']);
  assert.deepEqual(titles(byTitle('request', { 'What do you need?': 'Graphic design only (t-shirt, logo, flyer, etc. - no communications plan)' })),
    [desc.sections[0].title, 'Graphic design only']);

  const promoNo = byTitle('request', { 'What do you need?': PROMO['What do you need?'], 'Do you need graphic design for this?': 'No' });
  assert.deepEqual(titles(promoNo), [desc.sections[0].title, 'Audience & the ask', 'Dates & details', 'Last thing']);
  const promoYes = byTitle('request', { 'What do you need?': PROMO['What do you need?'], 'Do you need graphic design for this?': 'Yes' });
  assert.deepEqual(titles(promoYes), [desc.sections[0].title, 'Audience & the ask', 'Dates & details', 'Design details', 'Last thing']);
});

test('email is prefilled and locked to the signed-in person', () => {
  const { g } = hub();
  const desc = g.__call('apiForm', 'request', '');
  const emailId = FORMS.request.items.find(i => i.title === 'Your email').id;
  assert.deepEqual(desc.prefill[emailId], { value: 'kids@example.org', lock: true });
  const nameId = FORMS.request.items.find(i => i.title === 'Your name').id;
  assert.equal(desc.prefill[nameId].value, 'Kara Kids', 'name learned from earlier requests');
});

/* ---------------- submitting ---------------- */

test('submitting a request goes through the real form and returns the new ID', () => {
  const { g, parent } = hub();
  const answers = byTitle('request', { ...PROMO, 'Your email': 'someone-else@example.org' });
  const files = [{ name: 'logo.png', mimeType: 'image/png', data: Buffer.from('png').toString('base64') }];
  const res = g.__call('apiSubmit', 'request', answers, files, '');

  assert.equal(res.requestId, 'REQ-2026-105');
  const sub = g.__submissions[0];
  assert.equal(sub.kind, 'request');
  assert.equal(sub.answers['Your email'], 'kids@example.org', 'browser cannot spoof the email');
  assert.equal(sub.answers['Event or initiative name'], 'Spring Kids Camp');
  assert.ok(sub.answers['Event / launch date'] instanceof Date || Object.prototype.toString.call(sub.answers['Event / launch date']) === '[object Date]');
  assert.deepEqual([...sub.answers['What needs to be designed?']], ['Main graphic / key art', 'Social graphics']);

  // Attachments landed in Drive and the link was added to the form answer.
  const uploads = parent.children.find(c => c.name === 'App uploads');
  assert.equal(uploads.children[0].files[0].name, 'logo.png');
  assert.match(sub.answers['Inspiration or reference links'], /Attachments: https:\/\/drive\.google\.com\/drive\/folders\//);
});

test('answers from hidden sections are not submitted', () => {
  const { g } = hub();
  const answers = byTitle('request', { ...PROMO, 'Do you need graphic design for this?': 'No', 'Series title (working title is fine)': 'stray' });
  g.__call('apiSubmit', 'request', answers, [], '');
  const sent = g.__submissions[0].answers;
  assert.equal(sent['Series title (working title is fine)'], undefined);
  assert.equal(sent['What needs to be designed?'], undefined, 'design section skipped when design = No');
});

test('missing required answers are rejected before anything is submitted', () => {
  const { g } = hub();
  const answers = byTitle('request', { ...PROMO });
  delete answers[FORMS.request.items.find(i => i.title === 'Share one story or human moment that shows why this matters').id];
  assert.throws(() => g.apiSubmit('request', answers, [], ''), /Share one story/);
  assert.equal(g.__submissions.length, 0);
});

test('choices that are not on the form are rejected', () => {
  const { g } = hub();
  const answers = byTitle('request', { ...PROMO, 'Ministry / department': 'Made Up Ministry' });
  assert.throws(() => g.apiSubmit('request', answers, [], ''), /not an option/);
});

test('design feedback is sent through the feedback form for your own request only', () => {
  const { g, kids } = hub();
  const answers = byTitle('feedback', {
    'What kind of change is this?': 'Fixing a mistake (typo, date, time, name)',
    'What needs to change? (list everything in this one message)': 'Date should be 12/18.'
  });
  const files = [{ name: 'markup.png', mimeType: 'image/png', data: Buffer.from('x').toString('base64') }];
  g.__call('apiSubmit', 'feedback', answers, files, 'REQ-2026-006');
  const sub = g.__submissions[0];
  assert.equal(sub.answers['Request ID'], 'REQ-2026-006');
  assert.equal(sub.answers['Your email'], 'kids@example.org');
  assert.equal(kids.files[0].name, 'markup.png', 'feedback files go into the request folder');

  g.__setUser('pastor@example.org');
  assert.throws(() => g.apiSubmit('feedback', answers, [], 'REQ-2026-006'), /Only the person who submitted/);
});

test('admin can send a change for any request', () => {
  const { g } = hub('admin@example.org');
  const answers = byTitle('change', { 'What is changing?': ['Event or launch date'], 'New date (if the date is changing)': '2026-12-04', 'Tell us what changed': 'Moved a week.' });
  g.__call('apiSubmit', 'change', answers, [], 'REQ-2026-006');
  assert.equal(g.__submissions[0].answers['Request ID'], 'REQ-2026-006');
});

/* ---------------- reading the hub ---------------- */

test('tasks are routed to people, including Owner = Michael/Designer/Ministry Leader', () => {
  const { g } = hub('admin@example.org');
  const mine = g.__call('apiMyTasks');
  assert.ok(mine.some(t => /Stage announcement/.test(t.task)), 'Owner "Michael" → admin from Config');
  assert.equal(mine.filter(t => t.taskKey === 'REQ-2026-008-16').length, 1, 'duplicate hub rows shown once');

  g.__setUser('designer@example.org');
  assert.ok(g.__call('apiMyTasks').some(t => /FINAL assets/.test(t.task)));

  g.__setUser('kids@example.org');
  assert.deepEqual(g.__call('apiMyTasks').map(t => t.taskKey), ['REQ-2026-006-V2']);
});

test('dates in the hub formats are understood', () => {
  const { g } = hub();
  const all = g.__call('apiRequests', 'all');
  assert.equal(all.find(r => r.requestId === 'REQ-2026-010').eventDate, '2027-03-27');
  assert.equal(all.find(r => r.requestId === 'REQ-2026-002').eventDate, '2027-01-03');
  const tl = g.__call('apiTeamTimeline');
  assert.equal(tl.find(t => t.taskKey === 'REQ-2026-002-07').dueDate, '2026-11-29');
});

test('home dashboard numbers', () => {
  const { g } = hub('admin@example.org');
  const h = g.__call('apiHome');
  assert.equal(h.stats.needsReview, 1);
  assert.equal(h.stats.overdue, 1, 'Nov 18 stage task (listed twice in the hub, counted once); Nov 20 is today, not overdue');
  assert.equal(h.stats.sprints, 1);
  assert.equal(h.reviewQueue.length, 1, 'admin sees the review queue');
  g.__setUser('kids@example.org');
  assert.equal(g.__call('apiHome').reviewQueue.length, 0);
});

test('design queue splits designer vs in-house work and hides approved designs', () => {
  const { g } = hub('designer@example.org');
  const q = g.__call('apiDesignQueue');
  const ids = q.items.map(i => i.requestId);
  assert.ok(!ids.includes('REQ-2026-002'), 'approved series art is out of the queue');
  assert.equal(q.items.find(i => i.requestId === 'REQ-2026-008').handledBy, 'designer');
  assert.equal(q.items.find(i => i.requestId === 'REQ-2026-006').handledBy, 'in-house');
});

test('designer can upload finals into the request folder; others cannot', () => {
  const { g, kids } = hub('designer@example.org');
  g.__call('apiUploadFiles', 'REQ-2026-006', [{ name: 'final.png', mimeType: 'image/png', data: 'eA==' }]);
  assert.equal(kids.files[0].name, 'final.png');
  g.__setUser('pastor@example.org');
  assert.throws(() => g.apiUploadFiles('REQ-2026-006', [{ name: 'x', data: 'eA==' }]), /Only the person/);
});

test('the app never writes to the hub spreadsheet', () => {
  const { g } = hub('admin@example.org');
  // The mock throws on any write; run every API once.
  g.apiBootstrap(); g.apiHome(); g.apiMyTasks(); g.apiRequests('all'); g.apiRequests('mine');
  g.apiRequestDetail('REQ-2026-008'); g.apiTeamTimeline(); g.apiDesignQueue();
});

test('requests whose whole plan is done drop out of the design queue', () => {
  const { g } = hub('designer@example.org');
  // Mark every CK task done, the way the hub leaves finished work (status stays "Planned").
  const tl = g.__sheets.Timeline.data;
  tl.forEach(r => { if (r[1] === 'REQ-2026-006') r[8] = 'Done'; });
  assert.ok(!g.__call('apiDesignQueue').items.some(i => i.requestId === 'REQ-2026-006'));
});
