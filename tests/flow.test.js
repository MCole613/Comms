// End-to-end: setup → submit → emails → complete tasks → digest, against mocked Google services.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext } = require('./gas-mock');

function freshHub() {
  const g = createContext({ userEmail: 'students@church.org', now: new Date(2027, 0, 4, 9, 0) }); // Mon Jan 4 2027
  g.setup();
  // Replace placeholder team with "real" addresses.
  const team = g.__sheets['Team'].data;
  team.length = 1;
  [
    ['Comms Director', 'comms@church.org', 'Communications Director', 'Communications', '', '', 'Yes'],
    ['Dana Designer', 'design@church.org', 'Designer', 'Communications', '', '', 'Yes'],
    ['Sam Social', 'social@church.org', 'Social Media', 'Communications', '', '', 'Yes'],
    ['Pat Student Pastor', 'students@church.org', 'Leadership', 'Students', 'asst@church.org', 'xp@church.org', 'Yes'],
    ['Alex Assistant', 'asst@church.org', 'Ministry Assistant', 'Students', '', '', 'Yes'],
    ['Jordan XP', 'xp@church.org', 'Leadership', 'Executive', '', '', 'Yes']
  ].forEach(r => team.push(r));
  return g;
}

const form = {
  title: 'Winter Retreat', eventDate: '2027-02-27', eventTime: 'Fri 6pm – Sun noon', ministry: 'Students',
  location: 'Camp <Pinewood>', description: 'Annual retreat', keyMessage: 'Register now!', callToAction: 'Sign up',
  link: 'https://example.org/retreat', contact: 'Pat', designNotes: 'Snowy, fun',
  deliverables: ['Graphic Design', 'Social Media'],
  files: [{ name: 'logo.png', mimeType: 'image/png', data: Buffer.from('png').toString('base64') }]
};

test('setup seeds all sheets', () => {
  const g = freshHub();
  for (const s of ['Settings', 'Team', 'Task Templates', 'Requests', 'Tasks']) assert.ok(g.__sheets[s], s);
  assert.ok(g.readSettings_()['Upload Folder ID']);
});

test('bootstrap lists deliverables (not Every Request) and ministries', () => {
  const g = freshHub();
  const b = g.apiBootstrap();
  assert.equal(b.user.name, 'Pat Student Pastor');
  assert.ok(b.deliverables.includes('Graphic Design'));
  assert.ok(!b.deliverables.includes('Every Request'));
  assert.ok(b.ministries.includes('Students'));
});

test('submitting builds timeline, assigns by submitter, and emails the designer', () => {
  const g = freshHub();
  const res = g.apiSubmitRequest(form);
  assert.equal(res.requestId, 'REQ-2701-001');
  assert.equal(res.warnings.length, 0, String(res.warnings));

  const tasks = g.readTable_('Tasks');
  const byTask = Object.fromEntries(tasks.map(t => [t.task, t]));
  assert.equal(byTask['Supervisor sign-off'].assigneeEmail, 'xp@church.org', 'approver from submitter record');
  assert.equal(byTask['Send photos & attendance recap'].assigneeEmail, 'asst@church.org', "submitter's assistant");
  assert.equal(byTask['Review draft & send feedback'].assigneeEmail, 'students@church.org');
  assert.equal(byTask['Create first draft (slides / screens / social sizes)'].assigneeEmail, 'design@church.org');
  assert.equal(byTask['Schedule posts'].assigneeEmail, 'social@church.org');
  assert.ok(!byTask['Place in bulletin'], 'unselected deliverables excluded');

  const req = g.readTable_('Requests')[0];
  assert.equal(req.designerEmail, 'design@church.org');
  assert.equal(req.rush, '', '54 days of notice beats the 42-day minimum');

  const mail = g.__mail;
  const brief = mail.find(m => m.to === 'design@church.org');
  assert.ok(brief, 'designer brief sent');
  assert.match(brief.subject, /Design brief: Winter Retreat/);
  assert.match(brief.htmlBody, /Camp &lt;Pinewood&gt;/, 'user content is escaped');
  assert.match(brief.htmlBody, /logo\.png/);
  assert.equal(brief.replyTo, 'students@church.org');
  assert.ok(mail.find(m => m.to === 'students@church.org' && /Request received/.test(m.subject)));
  assert.ok(mail.find(m => m.to === 'social@church.org'));
  assert.ok(mail.find(m => m.to === 'xp@church.org'));
  assert.ok(!mail.some(m => /example\./.test(m.to)), 'no mail to placeholders');

  const folder = g.__folders.find(f => f.files.length);
  assert.ok(folder.editors.includes('design@church.org'));
});

test('a leader with no approver skips the sign-off step', () => {
  const g = freshHub();
  g.__setUser('xp@church.org');
  g.apiSubmitRequest({ ...form, files: [] });
  assert.ok(!g.readTable_('Tasks').some(t => t.task === 'Supervisor sign-off'));
});

test('completing a step notifies the next owner and updates request status', () => {
  const g = freshHub();
  g.apiSubmitRequest(form);
  g.__mail.length = 0;

  g.__setUser('design@church.org');
  const draft = g.apiMyTasks().find(t => /first draft/.test(t.task));
  g.apiUpdateTask(draft.taskId, 'Done');

  const nudge = g.__mail.find(m => m.to === 'students@church.org');
  assert.ok(nudge, 'submitter told feedback is needed');
  assert.match(nudge.subject, /You're up: Review draft/);
  assert.equal(g.readTable_('Requests')[0].status, 'In Progress');
});

test('only the assignee, submitter or an admin can change a task', () => {
  const g = freshHub();
  g.apiSubmitRequest(form);
  const t = g.readTable_('Tasks').find(t => t.assigneeEmail === 'social@church.org');
  g.__setUser('asst@church.org');
  assert.throws(() => g.apiUpdateTask(t.taskId, 'Done'), /Only the person assigned/);
  g.__setUser('comms@church.org');
  assert.equal(g.apiUpdateTask(t.taskId, 'Done').status, 'Done');
});

test('request becomes Complete when every task is done', () => {
  const g = freshHub();
  g.apiSubmitRequest(form);
  g.__setUser('comms@church.org');
  g.readTable_('Tasks').forEach(t => g.apiUpdateTask(t.taskId, 'Done'));
  assert.equal(g.readTable_('Requests')[0].status, 'Complete');
});

test('views return data', () => {
  const g = freshHub();
  g.apiSubmitRequest(form);
  assert.equal(g.apiRequests().length, 1);
  assert.ok(g.apiRequestDetail('REQ-2701-001').tasks.length > 5);
  assert.ok(g.apiTeamTimeline().length > 5);
  const p = g.apiPreviewTimeline('2027-02-27', ['Video']);
  assert.ok(p.items.some(i => i.task === 'Film'));
});

test('weekly digest emails people with tasks due this week', () => {
  const g = freshHub();
  g.apiSubmitRequest(form);
  g.__mail.length = 0;
  g.sendWeeklyDigest();
  assert.ok(g.__mail.some(m => m.to === 'comms@church.org' && /this week/.test(m.subject)));
});

test('second request gets the next ID', () => {
  const g = freshHub();
  g.apiSubmitRequest(form);
  assert.equal(g.apiSubmitRequest({ ...form, files: [] }).requestId, 'REQ-2701-002');
});
