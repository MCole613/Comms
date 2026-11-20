// End-to-end: setup → submit → review → plan → design rounds → changes → import.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext, makeSpreadsheet } = require('./gas-mock');

const NOW = new Date(2026, 10, 20, 9, 0); // Fri Nov 20 2026
const ADMIN = 'admin@church.test', DESIGNER = 'designer@church.test', PASTOR = 'pastor@church.test', KARA = 'kara@church.test';

function app() {
  const g = createContext({ userEmail: ADMIN, now: NOW, owner: ADMIN });
  g.setup();
  const parent = g.__drive.folder('Comms parent');
  g.__call('apiSaveSettings', { 'Master calendar ID': 'master@group.calendar.google.com', 'Drive parent folder': parent.getUrl() });
  g.__call('apiSavePerson', { email: ADMIN, name: 'Michael Admin', role: 'Communications', ministry: 'Communications' });
  g.__call('apiSavePerson', { email: DESIGNER, name: 'Jamie Designer', role: 'Designer' });
  g.__call('apiSavePerson', { email: PASTOR, name: 'Pat Pastor', role: 'Pastor' });
  g.__mail.length = 0;
  return { g, parent };
}

const PROMO = {
  ministry: 'Calvary Kids', kind: 'Promoting an event or ministry (communications, plus design if needed)',
  'promo.title': 'Spring Kids Camp', 'promo.whoFor': 'A specific age group (Kids / Students / Young Adults)',
  'promo.reach': '25-49%', 'promo.bridge': 'No', 'promo.nextStepType': 'Sign up / register',
  'promo.oneNextStep': 'Register in Church Center.', 'promo.story': 'Last year a shy 3rd grader found friends.',
  'promo.eventDate': '2027-03-12', 'promo.registration': 'Yes', 'promo.needsDesign': 'Yes',
  'promo.designItems': ['Main graphic / key art', 'Social graphics']
};
const SERIES = {
  ministry: 'Pastoral / Staff', kind: 'Sermon series', 'series.title': 'Rooted', 'series.bigIdea': 'Deep roots, real fruit.',
  'series.eventDate': '2027-03-07', 'series.seriesWeeks': '4', 'series.oneNextStep': 'Join a LifeGroup',
  'series.designItems': ['Series key art / main graphic'], 'series.nextStepType': 'Join a LifeGroup'
};

function asKara(g) {
  g.__setUser(KARA);
  g.__call('apiSetMyProfile', 'Kara Kids', 'Calvary Kids');
}

test('setup creates the locked data file and makes the owner an admin', () => {
  const { g } = app();
  const people = g.__table('People');
  assert.equal(people.find(p => p.email === ADMIN).role, 'Communications');
  const s = g.readSettings_();
  assert.equal(s['Designer handles'], 'Level 1, Series');
  g.setup(); // re-running is safe
  assert.equal(g.__table('People').filter(p => p.email === ADMIN).length, 1);
});

test('new staff must give their name before submitting', () => {
  const { g } = app();
  g.__setUser(KARA);
  assert.throws(() => g.__api('apiSubmitRequest', PROMO, []), /tell us your name/);
  g.__call('apiSetMyProfile', 'Kara Kids', 'Calvary Kids');
  assert.equal(g.__call('apiBootstrap').user.name, 'Kara Kids');
});

test('submitting a promotion: validated, suggested tier, runway, folder, emails', () => {
  const { g } = app();
  asKara(g);
  const files = [{ name: 'logo.png', mimeType: 'image/png', data: Buffer.from('png').toString('base64') }];
  const res = g.__call('apiSubmitRequest', { ...PROMO, 'series.title': 'stray answer from a hidden section' }, files);
  assert.equal(res.requestId, 'REQ-2026-001');
  const r = g.__table('Requests')[0];
  assert.equal(r.status, 'Needs Review');
  assert.equal(r.suggestedTier, 'Level 3');
  assert.equal(r.title, 'Spring Kids Camp');
  assert.equal(r.designItems, 'Main graphic / key art, Social graphics');
  assert.equal(r.flags, '', '112 days is plenty of runway');
  assert.ok(!('bigIdea' in r) || r.bigIdea === '', 'hidden-section answers ignored');
  assert.match(r.designFolder, /drive\.google\.com\/drive\/folders\//);
  assert.equal(g.__drive.folders[r.designFolder.split('/').pop()].files[0].name, 'logo.png');
  assert.ok(g.__mail.some(m => m.to === KARA && /Request received/.test(m.subject)));
  assert.ok(g.__mail.some(m => m.to === ADMIN && /New request to review/.test(m.subject)));
});

test('validation: required answers, real choices, no past dates', () => {
  const { g } = app();
  asKara(g);
  const missing = { ...PROMO }; delete missing['promo.story'];
  assert.throws(() => g.__api('apiSubmitRequest', missing, []), /Share one story/);
  assert.throws(() => g.__api('apiSubmitRequest', { ...PROMO, 'promo.reach': '200%' }, []), /not an option/);
  assert.throws(() => g.__api('apiSubmitRequest', { ...PROMO, 'promo.eventDate': '2026-01-01' }, []), /already passed/);
  assert.equal(g.__table('Requests').length, 0);
});

test('admin approval builds the plan, assigns people, syncs the calendar', () => {
  const { g } = app();
  asKara(g);
  g.__call('apiSubmitRequest', PROMO, []);
  assert.throws(() => g.__api('apiReview', 'REQ-2026-001', { action: 'approve' }), /Only the communications team/);

  g.__setUser(ADMIN);
  g.__call('apiReview', 'REQ-2026-001', { action: 'approve', tier: 'Level 3', message: 'Looks great!' });
  const r = g.__table('Requests')[0];
  assert.equal(r.status, 'Planned');
  assert.equal(r.tier, 'Level 3');
  assert.equal(r.mode, 'Sprinkle (NextGen channels)');
  assert.equal(r.designState, 'Briefed');
  const tasks = g.__table('Tasks');
  assert.equal(tasks.length, 12);
  assert.equal(tasks.find(t => /final copy/.test(t.task)).assigneeEmail, KARA, 'Leader tasks go to the submitter');
  assert.equal(tasks.find(t => t.key === 'draft').assigneeEmail, ADMIN, 'Level 3 designed in-house');
  assert.equal(Object.keys(g.__calendar.events).length, 1);
  assert.match(Object.values(g.__calendar.events)[0].title, /^\[L3\] Spring Kids Camp/);
  assert.ok(g.__mail.some(m => m.to === KARA && /Approved/.test(m.subject) && /Looks great/.test(m.htmlBody)));
});

test('needs-info and decline notify the requester', () => {
  const { g } = app();
  asKara(g);
  g.__call('apiSubmitRequest', PROMO, []);
  g.__setUser(ADMIN);
  assert.throws(() => g.__api('apiReview', 'REQ-2026-001', { action: 'needsInfo' }), /what information/);
  g.__call('apiReview', 'REQ-2026-001', { action: 'needsInfo', message: 'What age range?' });
  assert.equal(g.__table('Requests')[0].status, 'Needs Info');
  assert.ok(g.__mail.some(m => m.to === KARA && /More info needed/.test(m.subject)));
  g.__call('apiReview', 'REQ-2026-001', { action: 'decline', message: 'Calendar is full that week.' });
  assert.equal(g.__table('Requests')[0].status, 'Declined');
});

test('Level 1 sprint cap is enforced unless overridden', () => {
  const { g } = app();
  g.__call('apiSaveSettings', { 'Sprint cap per year': '1' });
  asKara(g);
  const big = { ...PROMO, 'promo.whoFor': 'Whole church + community', 'promo.reach': '80%+' };
  g.__call('apiSubmitRequest', big, []);
  g.__call('apiSubmitRequest', { ...big, 'promo.title': 'Second big event' }, []);
  g.__setUser(ADMIN);
  g.__call('apiReview', 'REQ-2026-001', { action: 'approve', tier: 'Level 1' });
  assert.throws(() => g.__api('apiReview', 'REQ-2026-002', { action: 'approve', tier: 'Level 1' }), /^Error: CAP: 1 of 1/);
  g.__call('apiReview', 'REQ-2026-002', { action: 'approve', tier: 'Level 1', overrideCap: true });
  assert.equal(g.__table('Requests')[1].status, 'Planned');
  assert.equal(Object.keys(g.__calendar.events).length, 4, 'event + sprint window each');
});

test('design rounds: draft → feedback → revision → held → released → approved → delivered', () => {
  const { g } = app();
  asKara(g);
  g.__call('apiSubmitRequest', PROMO, []);
  g.__setUser(ADMIN);
  g.__call('apiReview', 'REQ-2026-001', { action: 'approve', tier: 'Level 3' });
  const file = [{ name: 'draft1.png', mimeType: 'image/png', data: 'eA==' }];
  const id = 'REQ-2026-001';
  const state = () => g.__table('Requests')[0];
  const open = (key) => g.__table('Tasks').filter(t => t.key === key && t.status === 'Not started');

  // Kara can't deliver designs.
  g.__setUser(KARA);
  assert.throws(() => g.__api('apiUploadFiles', id, file, 'draft'), /Only the designer/);

  g.__setUser(ADMIN);
  g.__call('apiUploadFiles', id, file, 'draft');
  assert.equal(state().designState, 'In Review');
  assert.equal(open('draft').length, 0, 'draft step closed');
  assert.equal(open('review')[0].dueDate, '2026-11-23', 'review due in 3 days');
  assert.ok(g.__mail.some(m => m.to === KARA && /First draft ready/.test(m.subject)));

  const fb = (text) => ({ kind: 'Changing the design (look, layout, photos, colors)', text });
  g.__setUser(KARA);
  g.__call('apiDesignFeedback', id, fb('More blue please.'), []);
  assert.equal(state().designState, 'Revising');
  assert.equal(state().designRound, '1');
  assert.equal(open('revision')[0].task, 'Round 1 revisions: More blue please.');
  assert.equal(open('revision')[0].assigneeEmail, ADMIN);
  assert.throws(() => g.__api('apiApproveDesign', id), /no draft waiting/);

  g.__setUser(ADMIN);
  g.__call('apiUploadFiles', id, file, 'draft');
  g.__setUser(KARA);
  g.__call('apiDesignFeedback', id, fb('Bigger logo.'), []);
  g.__setUser(ADMIN);
  g.__call('apiUploadFiles', id, file, 'draft');
  g.__setUser(KARA);
  const third = g.__call('apiDesignFeedback', id, fb('Actually, try orange.'), []);
  assert.equal(third.held, true, 'only 2 rounds included');
  assert.equal(state().designState, 'Feedback Held');
  assert.ok(g.__mail.some(m => m.to === ADMIN && /Extra design round/.test(m.subject)));

  g.__setUser(ADMIN);
  g.__call('apiReleaseHeldFeedback', id, true);
  assert.equal(state().designRound, '3');
  g.__call('apiUploadFiles', id, file, 'draft');
  g.__setUser(KARA);
  g.__call('apiApproveDesign', id);
  assert.equal(state().designState, 'Approved');
  assert.equal(open('review').length, 0);

  g.__setUser(ADMIN);
  g.__call('apiUploadFiles', id, [{ name: 'final.zip', data: 'eA==' }], 'final');
  assert.equal(state().designState, 'Delivered');
  assert.equal(open('final').length, 0);
  const log = g.__table('Activity').filter(a => a.requestId === id).map(a => a.type);
  assert.deepEqual(log.filter(t => t === 'Feedback').length, 4, '3 rounds + release note');
});

test('designer-handled tiers: brief emailed on approval, designer owns the work', () => {
  const { g } = app();
  g.__setUser(PASTOR);
  g.__call('apiSetMyProfile', 'Pat Pastor', 'Pastoral / Staff');
  g.__call('apiSubmitRequest', SERIES, []);
  g.__setUser(ADMIN);
  g.__call('apiReview', 'REQ-2026-001', { action: 'approve', tier: 'Series' });
  const tasks = g.__table('Tasks');
  assert.equal(tasks.filter(t => /^Week \d/.test(t.task)).length, 4);
  assert.equal(tasks.find(t => t.key === 'draft').assigneeEmail, DESIGNER);
  assert.equal(tasks.find(t => t.key === 'brief').status, 'Done', 'brief auto-sent');
  assert.equal(tasks.find(t => /locked with pastor/.test(t.task)).assigneeEmail, PASTOR);
  const brief = g.__mail.find(m => m.to === DESIGNER && /Design brief: Rooted/.test(m.subject));
  assert.ok(brief);
  assert.match(brief.htmlBody, /Deep roots, real fruit\./);
  assert.equal(brief.replyTo, PASTOR);
  assert.match(g.__table('Requests')[0].flags, /COMPRESSED: 107 days|^$/);
  const ev = Object.values(g.__calendar.events)[0];
  assert.match(ev.title, /^\[Series\] Rooted/);
});

test('date change on a planned request waits for admin, then shifts open tasks', () => {
  const { g } = app();
  asKara(g);
  g.__call('apiSubmitRequest', PROMO, []);
  g.__setUser(ADMIN);
  g.__call('apiReview', 'REQ-2026-001', { action: 'approve', tier: 'Level 3' });
  const before = g.__table('Tasks').find(t => /final copy/.test(t.task)).dueDate;

  g.__setUser(KARA);
  const res = g.__call('apiRequestChange', 'REQ-2026-001', { changes: ['Event or launch date'], newDate: '2027-03-19', details: 'Camp moved a week.' });
  assert.equal(res.pendingDate, '2027-03-19');
  assert.equal(g.__table('Requests')[0].eventDate, '2027-03-12', 'not applied yet');
  assert.ok(g.__mail.some(m => m.to === ADMIN && /Change request/.test(m.subject)));
  assert.throws(() => g.__api('apiApplyNewDate', 'REQ-2026-001'), /Only the communications team/);

  g.__setUser(ADMIN);
  g.__call('apiApplyNewDate', 'REQ-2026-001');
  const after = g.__table('Tasks').find(t => /final copy/.test(t.task)).dueDate;
  assert.equal(g.__table('Requests')[0].eventDate, '2027-03-19');
  assert.equal(require('../src/Plan.gs').daysBetweenIso(before, after), 7);
  assert.equal(Object.keys(g.__calendar.events).length, 1, 'calendar re-synced, not duplicated');
});

test('cancelling closes open tasks and removes calendar events', () => {
  const { g } = app();
  asKara(g);
  g.__call('apiSubmitRequest', PROMO, []);
  g.__setUser(ADMIN);
  g.__call('apiReview', 'REQ-2026-001', { action: 'approve', tier: 'Level 3' });
  g.__setUser(KARA);
  g.__call('apiRequestChange', 'REQ-2026-001', { changes: ['Cancel this request'], details: 'Camp is off.' });
  assert.equal(g.__table('Requests')[0].status, 'Cancelled');
  assert.ok(g.__table('Tasks').every(t => t.status === 'Cancelled'));
  assert.equal(Object.keys(g.__calendar.events).length, 0);
});

test('tasks: permissions, review steps, request completes when everything is done', () => {
  const { g } = app();
  asKara(g);
  g.__call('apiSubmitRequest', { ...PROMO, 'promo.needsDesign': 'No' }, []);
  g.__setUser(ADMIN);
  g.__call('apiReview', 'REQ-2026-001', { action: 'approve', tier: 'Level 4' });
  const tasks = g.__table('Tasks');
  const karaTask = tasks.find(t => t.assigneeEmail === KARA);
  const adminTask = tasks.find(t => t.assigneeEmail === ADMIN);
  g.__setUser(KARA);
  assert.throws(() => g.__api('apiSetTaskDone', adminTask.taskKey, true), /Only the person assigned/);
  g.__call('apiSetTaskDone', karaTask.taskKey, true);
  assert.equal(g.__call('apiMyTasks').find(t => t.taskKey === karaTask.taskKey).status, 'Done');
  g.__setUser(ADMIN);
  g.__table('Tasks').filter(t => t.status !== 'Done').forEach(t => g.__call('apiSetTaskDone', t.taskKey, true));
  assert.equal(g.__table('Requests')[0].status, 'Done');
  g.__call('apiSetTaskDone', adminTask.taskKey, false);
  assert.equal(g.__table('Requests')[0].status, 'Planned', 'reopening a task reopens the request');
});

test('home, design queue, calendar and detail views', () => {
  const { g } = app();
  asKara(g);
  g.__call('apiSubmitRequest', PROMO, []);
  g.__setUser(ADMIN);
  let home = g.__call('apiHome');
  assert.equal(home.stats.needsReview, 1);
  assert.equal(home.actionNeeded.length, 1);
  g.__call('apiReview', 'REQ-2026-001', { action: 'approve', tier: 'Level 3' });
  home = g.__call('apiHome');
  assert.equal(home.stats.needsReview, 0);
  assert.ok(home.myTasks.length > 0);
  assert.equal(g.__call('apiDesignQueue')[0].handledBy, 'in-house');
  assert.equal(g.__call('apiCalendar', '2027-03')[0].title, 'Spring Kids Camp');
  assert.equal(g.__call('apiCalendar', '2027-05').length, 0);
  const d = g.__call('apiRequestDetail', 'REQ-2026-001');
  assert.equal(d.can.deliver, true);
  g.__setUser(PASTOR);
  const other = g.__call('apiRequestDetail', 'REQ-2026-001');
  assert.equal(other.can.change, false);
  assert.equal(other.can.deliver, false);
});

test('admin-only settings and people', () => {
  const { g } = app();
  asKara(g);
  assert.throws(() => g.__api('apiAdminData'), /Only the communications team/);
  assert.throws(() => g.__api('apiSaveSettings', { 'Sprint cap per year': '99' }), /Only the communications team/);
  g.__setUser(ADMIN);
  assert.throws(() => g.__api('apiSavePerson', { email: ADMIN, role: 'Staff' }), /own admin role/);
  g.__call('apiSaveSettings', { 'Sprint cap per year': '8', 'Not a setting': 'x' });
  assert.equal(g.readSettings_()['Sprint cap per year'], '8');
  assert.equal(g.readSettings_()['Not a setting'], undefined);
});

test('import from the old hub: settings, people, requests, tasks, history', () => {
  const { g } = app();
  const hub = makeSpreadsheet('hub', 'Hub');
  const put = (name, rows) => { const sh = hub.insertSheet(name); rows.forEach(r => sh.appendRow(r)); };
  put('Config', [
    ['Setting', 'Value', '', 'Ministries (form dropdown)'],
    ['Your email', ADMIN, '', 'Calvary Kids'],
    ['Designer name', 'Jamie Designer', '', 'Calvary Students'],
    ['Designer email', DESIGNER],
    ['Master calendar link', 'https://calendar.google.com/calendar/u/0/r?cid=master%40group.calendar.google.com'],
    ['Sprint cap per year', '6'], ['Brand header color', '#00b5e2'], ['Designer handles', 'Level 1, Series']
  ]);
  const RH = ['Request ID', 'Submitted', 'Requester', 'Requester Email', 'Ministry', 'Event / Initiative', 'Event Date', 'Suggested Tier', 'Final Tier', 'Mode', 'Status', 'Flags', 'Who For', 'Story', 'Details', 'Needs Design', 'Design Items', 'Design Folder', 'Request Type', 'Series Weeks', 'Design State', 'Design Round', 'Design Feedback Log'];
  put('Requests', [RH,
    ['REQ-2026-002', new Date(2026, 9, 15, 19, 10), 'Pat Pastor', PASTOR, 'Sermon Series', 'A New Thing', new Date(2027, 0, 3), 'Series', 'Series', 'Series (multi-week)', 'Planned', '', 'Whole church', 'God is doing a new thing.', 'Isaiah 43', 'Yes', 'Key art', '', 'Sermon Series', '5', 'Approved', '1', 'Nov 16 | Round 1 from Pat: drop the pink\nNov 16 | APPROVED by Pat'],
    ['REQ-2026-005', '11/2/2026 18:42:54', 'Kara Kids', KARA, 'Calvary Kids', '1Team Night', '3/5/2027', 'Level 4', 'Level 4', 'Snuggle', 'Planned', '', 'A specific ministry or group', 'Honoring our team', '', 'Yes', 'Main graphic', '', 'Promotion', '', 'Briefed', '0', '']
  ]);
  const TH = ['Task Key', 'Request ID', 'Event', 'Due Date', 'Channel', 'Task', 'Owner', 'Tier', 'Status', 'Google Task ID', 'Notes', 'Assigned To', 'Assigned Email'];
  put('Timeline', [TH,
    ['REQ-2026-005-01', 'REQ-2026-005', '1Team Night', 'Tue, Feb 9, 2027', 'Content', 'Send final copy, story and photos for this request (reply to the Communications email)', 'Ministry Leader', 'Level 4', 'Not started', 'x', '', 'Kara Kids', KARA],
    ['REQ-2026-005-02', 'REQ-2026-005', '1Team Night', 'Tue, Feb 16, 2027', 'Design', 'Create the design in-house: Main graphic', 'Michael', 'Level 4', 'Not started', 'y', '', '', ''],
    ['REQ-2026-005-08', 'REQ-2026-005', '1Team Night', 'Wed, Mar 3, 2027', 'Social', 'Reminder post; bulletin listing', 'Michael', 'Level 4', 'Not started', 'a', '', '', ''],
    ['REQ-2026-005-08', 'REQ-2026-005', '1Team Night', 'Wed, Mar 3, 2027', 'Social', 'Reminder post; bulletin listing', 'Michael', 'Level 4', 'Not started', 'b', '', '', ''],
    ['REQ-2026-002-07', 'REQ-2026-002', 'A New Thing', 'Sun, Nov 29, 2026', 'Design', 'FINAL assets delivered to request folder', 'Designer', 'Series', 'Not started', 'z', '', '', '']
  ]);
  g.__spreadsheets.hub = hub;

  const out = g.__call('importFromHub', 'hub');
  assert.deepEqual([out.requests, out.tasks], [2, 4], 'duplicate hub task skipped');
  assert.equal(out.completed, 0);
  assert.equal(g.readSettings_()['Master calendar ID'], 'master@group.calendar.google.com');
  assert.equal(g.readSettings_()['Ministries'], 'Calvary Kids, Calvary Students');
  const people = g.__table('People');
  assert.equal(people.find(p => p.email === KARA).name, 'Kara Kids');
  const reqs = g.__table('Requests');
  const series = reqs.find(r => r.requestId === 'REQ-2026-002');
  assert.equal(series.eventDate, '2027-01-03');
  assert.equal(series.requestType, 'Series');
  assert.equal(series.bigIdea, 'God is doing a new thing.');
  assert.equal(reqs.find(r => r.requestId === 'REQ-2026-005').eventDate, '2027-03-05');
  const tasks = g.__table('Tasks');
  const content = tasks.find(t => t.taskKey === 'REQ-2026-005-01');
  assert.equal(content.task, 'Send final copy, story and photos for this request');
  assert.equal(content.owner, 'Leader');
  assert.equal(tasks.find(t => t.taskKey === 'REQ-2026-005-02').assigneeEmail, ADMIN);
  assert.equal(tasks.find(t => t.taskKey === 'REQ-2026-002-07').assigneeEmail, DESIGNER);
  assert.equal(tasks.find(t => t.taskKey === 'REQ-2026-005-02').key, 'draft');
  assert.equal(g.__table('Activity').filter(a => a.requestId === 'REQ-2026-002' && a.type === 'Approved').length, 1);

  // Re-running skips what's there; new IDs continue after imported ones.
  assert.equal(g.__call('importFromHub', 'hub').skipped, 2);
  asKara(g);
  assert.equal(g.__call('apiSubmitRequest', PROMO, []).requestId, 'REQ-2026-006');
});

test('the app never emails placeholder addresses', () => {
  const { g } = app();
  g.__call('apiSavePerson', { email: 'design@example.com', name: 'x', role: 'Designer' });
  asKara(g);
  g.__call('apiSubmitRequest', PROMO, []);
  assert.ok(!g.__mail.some(m => /@example\./.test(m.to)));
});
