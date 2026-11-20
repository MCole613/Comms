// The 3 files in dist/ are what gets pasted into Apps Script, so test them directly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createContext } = require('./gas-mock');
const { build } = require('../scripts/bundle');

const dist = path.join(__dirname, '..', 'dist');

test('dist/ is up to date with src/ (run `npm run bundle` after editing)', () => {
  const fresh = build();
  for (const name of Object.keys(fresh)) {
    assert.equal(fs.readFileSync(path.join(dist, name), 'utf8'), fresh[name], 'dist/' + name + ' is stale');
  }
  assert.deepEqual(fs.readdirSync(dist).sort(), ['Code.gs', 'Index.html', 'appsscript.json']);
});

test('the bundled page has everything inlined', () => {
  const html = fs.readFileSync(path.join(dist, 'Index.html'), 'utf8');
  assert.ok(!/include\(/.test(html));
  assert.match(html, /<style>[\s\S]*\.topbar/);
  assert.match(html, /function renderForm/);
  assert.match(html, /<\?!= formLogicSource\(\) \?>/);
  JSON.parse(fs.readFileSync(path.join(dist, 'appsscript.json'), 'utf8'));
});

test('the bundled Code.gs runs the whole flow on its own', () => {
  const ADMIN = 'admin@church.test', KARA = 'kara@church.test';
  const g = createContext({ userEmail: ADMIN, now: new Date(2026, 10, 20, 9), owner: ADMIN, sources: [path.join(dist, 'Code.gs')] });
  g.setup();
  g.__setUser(KARA);
  g.apiSetMyProfile('Kara Kids', 'Calvary Kids');
  const id = g.apiSubmitRequest({
    ministry: 'Calvary Kids', kind: 'Graphic design only (t-shirt, logo, flyer, etc. - no communications plan)',
    'design.title': 'Movie Night graphic', 'design.whoFor': 'Kids and parents', 'design.designItems': ['Social graphic'],
    'design.eventDate': '2027-01-29', 'design.textFinal': 'Yes'
  }, []).requestId;
  g.__setUser(ADMIN);
  g.apiReview(id, { action: 'approve', tier: 'Design' });
  const tasks = g.__table('Tasks');
  assert.deepEqual([...tasks.map(t => t.dueDate)], ['2027-01-08', '2027-01-11', '2027-01-22'], '21-day design timeline');
  g.apiUploadFiles(id, [{ name: 'draft.png', data: 'eA==' }], 'draft');
  g.__setUser(KARA);
  g.apiApproveDesign(id);
  assert.equal(g.__table('Requests')[0].designState, 'Approved');
  assert.equal(typeof g.importFromHub, 'function');
  assert.equal(typeof g.doGet, 'function');
});
