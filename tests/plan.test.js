// The timeline templates must reproduce what the old hub generated.
// Expected offsets (days from the event) were read from the hub's Timeline tab.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/Plan.gs');

const far = '2026-01-01'; // "today" far in advance, so nothing is compressed
function offsets(req, designerTiers = ['Level 1', 'Series']) {
  return P.buildPlan(req, { today: far, designerTiers }).map(s => s.offset + ' ' + s.owner + ' ' + s.task.slice(0, 30));
}

test('Level 1 (Christmas at Calvary) matches the hub', () => {
  const got = P.buildPlan({ tier: 'Level 1', eventDate: '2026-12-23', needsDesign: 'Yes', registration: 'Yes', designItems: 'Main graphic' }, { today: far, designerTiers: ['Level 1', 'Series'] });
  assert.deepEqual(got.map(s => s.offset), [-84, -77, -77, -70, -69, -68, -63, -56, -56, -49, -49, -49, -35, -35, -35, -28, -21, -14, -14, -7, -7, -3, 2, 2, 7]);
  assert.equal(got[0].dueDate, '2026-09-30');
  assert.deepEqual(got.filter(s => s.owner === 'Designer').map(s => s.key), ['draft', 'final']);
});

test('Level 3 (Bonfire) matches the hub', () => {
  const got = P.buildPlan({ tier: 'Level 3', eventDate: '2026-11-08', needsDesign: 'Yes', registration: 'Yes' }, { today: far, designerTiers: ['Level 1', 'Series'] });
  assert.deepEqual(got.map(s => s.offset), [-35, -28, -27, -21, -21, -21, -14, -7, -7, -2, 2, 7]);
  assert.equal(got[1].owner, 'Comms', 'Level 3 is designed in-house');
});

test('Level 4 (1Team Night) matches the hub', () => {
  const got = P.buildPlan({ tier: 'Level 4', eventDate: '2027-03-05', needsDesign: 'Yes', registration: 'Yes' }, { today: far, designerTiers: ['Level 1', 'Series'] });
  assert.deepEqual(got.map(s => s.offset), [-24, -17, -16, -14, -14, -14, -7, -2, 2]);
  assert.equal(got[0].dueDate, '2027-02-09');
});

test('Series (A New Thing Coming, 5 weeks) matches the hub, including weekly posts', () => {
  const got = P.buildPlan({ tier: 'Series', eventDate: '2027-01-03', needsDesign: 'Yes', seriesWeeks: '5' }, { today: far, designerTiers: ['Level 1', 'Series'] });
  const weekly = got.filter(s => /^Week \d/.test(s.task));
  assert.deepEqual(weekly.map(s => s.dueDate), ['2026-12-30', '2027-01-06', '2027-01-13', '2027-01-20', '2027-01-27']);
  assert.equal(got.at(-1).task, 'Series wrap-up: log results, archive art & files');
  assert.equal(got.at(-1).dueDate, '2027-02-07');
  assert.equal(got[0].owner, 'Pastor');
});

test('Design only: 21-day timeline (in-house)', () => {
  const got = P.buildPlan({ tier: 'Design', eventDate: '2026-11-11', designItems: 'Social graphic' }, { today: far, designerTiers: ['Level 1', 'Series'] });
  assert.deepEqual(got.map(s => s.offset + s.owner), ['-21Comms', '-18Leader', '-7Comms']);
  assert.equal(got[0].dueDate, '2026-10-21');
  assert.equal(P.runwayFlag('Design', '2026-11-01', '2026-11-11'), 'COMPRESSED: 10 days of runway, Design needs 21');
  assert.equal(got[0].task, 'Create the design in-house: Social graphic');
});

test('conditional steps: no design, no registration', () => {
  const got = P.buildPlan({ tier: 'Level 4', eventDate: '2027-03-05', needsDesign: 'No', registration: 'No' }, { today: far, designerTiers: [] });
  assert.ok(!got.some(s => s.channel === 'Design' || s.channel === 'PCO'));
});

test('short notice compresses past steps to today with a note', () => {
  const got = P.buildPlan({ tier: 'Level 3', eventDate: '2026-11-08', needsDesign: 'Yes', registration: 'No' }, { today: '2026-11-04', designerTiers: [] });
  const first = got[0];
  assert.equal(first.dueDate, '2026-11-04');
  assert.equal(first.notes, 'Compressed: original date Sunday October-4-2026');
  assert.equal(P.runwayFlag('Level 3', '2026-11-04', '2026-11-08'), 'COMPRESSED: 4 days of runway, Level 3 needs 35');
  assert.equal(P.runwayFlag('Level 1', '2026-11-04', '2026-12-23'), 'COMPRESSED: 49 days of runway, Level 1 needs 84');
  assert.equal(P.runwayFlag('Level 4', '2026-11-02', '2027-03-05'), '');
});

test('tier suggestions follow the audience questions', () => {
  // Older wording still works for imported requests.
  assert.equal(P.suggestTier({ requestType: 'Promotion', whoFor: 'A specific age group (Kids / Students / Young Adults)', reach: 'Under 25%' }), 'Level 3');
  assert.equal(P.suggestTier({ requestType: 'Promotion', whoFor: 'Level 3 - All NextGen (Calvary Kids, Calvary Students, Calvary Young Adults)', reach: '80%+' }), 'Level 3', 'the chosen level wins');
  assert.equal(P.suggestTier({ requestType: 'Promotion', whoFor: 'Level 1 - Whole church + community', reach: '80%+', bridge: 'Yes' }), 'Level 1');
  assert.equal(P.suggestTier({ requestType: 'Promotion', whoFor: 'Level 2 - A core repeatable next step (LifeGroups, Serving, Giving, Calvary 101, Baptism...)', reach: '25-49%' }), 'Level 2');
  assert.equal(P.suggestTier({ requestType: 'Promotion', whoFor: 'Level 3 - All NextGen (Calvary Kids, Calvary Students, Calvary Young Adults)', reach: 'Under 25%' }), 'Level 3');
  assert.equal(P.suggestTier({ requestType: 'Promotion', whoFor: 'Level 4 - Everything else', reach: '25-49%' }), 'Level 4');
  assert.equal(P.suggestTier({ requestType: 'Series' }), 'Series');
  assert.equal(P.suggestTier({ requestType: 'Design' }), 'Design');
});

test('dates read "Friday November-20-2026" and weekdays are bolded in emails', () => {
  const { createContext } = require('./gas-mock');
  const g = createContext({ userEmail: 'a@church.test', now: new Date(2026, 10, 20, 9), owner: 'a@church.test' });
  assert.equal(g.prettyIso('2026-11-20'), 'Friday November-20-2026');
  assert.equal(g.prettyIso('2026-10-04'), 'Sunday October-4-2026');
  assert.equal(g.boldWeekdays('<td title="Friday">Due Friday November-20-2026</td>'), '<td title="Friday">Due <b>Friday</b> November-20-2026</td>');
  assert.equal(g.reformatHubDates_('Compressed: original date Sun, Oct 4, 2026 | Files uploaded Mon, Nov 16, 2026'),
    'Compressed: original date Sunday October-4-2026 | Files uploaded Monday November-16-2026');
});
