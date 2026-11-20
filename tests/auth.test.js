// Email sign-in codes: who can get in, and that nothing works without a session.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext } = require('./gas-mock');

const ADMIN = 'michael@church.test';
function app() {
  const g = createContext({ userEmail: ADMIN, now: new Date(2026, 10, 20, 9), owner: ADMIN });
  g.setup();
  g.__call('apiSavePerson', { email: ADMIN, name: 'Michael', role: 'Communications' });
  g.__call('apiSavePerson', { email: 'designer@freelance.test', name: 'Outside Designer', role: 'Designer' });
  g.__mail.length = 0;
  return g;
}
const codeFrom = (g, email) => { const m = g.__mail.filter(x => x.to === email).pop(); return m && /code: (\d{6})/.exec(m.subject)[1]; };

test('setup lets the owner\'s domain sign up on its own', () => {
  const g = app();
  assert.equal(g.readSettings_()['Self sign-up domains'], 'church.test');
});

test('someone on the People list (outside the church domain) can sign in with a code', () => {
  const g = app();
  g.__call('apiRequestCode', 'Designer@Freelance.test ');
  const code = codeFrom(g, 'designer@freelance.test');
  assert.match(code, /^\d{6}$/);
  const { token } = g.__call('apiVerifyCode', 'designer@freelance.test', code);
  const boot = JSON.parse(JSON.stringify(g.call(token, 'apiBootstrap', [])));
  assert.equal(boot.user.email, 'designer@freelance.test');
  assert.equal(boot.user.isDesigner, true);
  assert.throws(() => g.apiVerifyCode('designer@freelance.test', code), /expired/, 'codes work once');
});

test('strangers get the same answer but no email', () => {
  const g = app();
  assert.deepEqual(g.__call('apiRequestCode', 'stranger@gmail.test'), { ok: true });
  assert.equal(g.__mail.length, 0);
  assert.throws(() => g.apiVerifyCode('stranger@gmail.test', '123456'), /expired/);
});

test('self sign-up domain: new staff get in and are added to People', () => {
  const g = app();
  g.__call('apiRequestCode', 'newstaff@church.test');
  const { token } = g.__call('apiVerifyCode', 'newstaff@church.test', codeFrom(g, 'newstaff@church.test'));
  const boot = JSON.parse(JSON.stringify(g.call(token, 'apiBootstrap', [])));
  assert.equal(boot.user.known, false, 'asked for their name next');
  assert.ok(g.__table('People').some(p => p.email === 'newstaff@church.test' && p.role === 'Staff'));
});

test('wrong codes are limited', () => {
  const g = app();
  g.__call('apiRequestCode', ADMIN);
  for (let i = 0; i < 4; i++) assert.throws(() => g.apiVerifyCode(ADMIN, '000000'), /isn't right/);
  assert.throws(() => g.apiVerifyCode(ADMIN, '000000'), /Too many wrong tries/);
  assert.throws(() => g.apiVerifyCode(ADMIN, codeFrom(g, ADMIN)), /expired/);
});

test('code requests are rate limited', () => {
  const g = app();
  for (let i = 0; i < 5; i++) g.apiRequestCode(ADMIN);
  assert.throws(() => g.apiRequestCode(ADMIN), /Too many codes/);
});

test('nothing runs without a valid session', () => {
  const g = app();
  assert.throws(() => g.apiHome(), /SIGNIN/, 'direct calls are refused');
  assert.throws(() => g.call('not-a-real-token-but-long-enough-to-check-0000', 'apiHome', []), /SIGNIN/);
  assert.throws(() => g.call(g.__token(), 'setup', []), /Unknown action/, 'only api functions can be called');
});

test('deactivating someone ends their access, even at the church domain', () => {
  const g = app();
  g.__setUser('staff@church.test');
  g.__call('apiSetMyProfile', 'Sam Staff', '');
  const token = g.__token();
  g.__setUser(ADMIN);
  g.__call('apiSavePerson', { email: 'staff@church.test', name: 'Sam Staff', role: 'Staff', active: 'No' });
  assert.throws(() => g.call(token, 'apiHome', []), /access has been removed/);
  g.__mail.length = 0;
  g.apiRequestCode('staff@church.test');
  assert.equal(g.__mail.length, 0, 'no new code either');
});

test('signing out ends the session', () => {
  const g = app();
  const token = g.__token();
  g.call(token, 'apiSignOut', []);
  assert.throws(() => g.call(token, 'apiHome', []), /SIGNIN/);
});

test('sessions expire after 90 days', () => {
  const g = app();
  const token = g.__token();
  g.__setNow(new Date(2027, 1, 19, 9));
  assert.throws(() => g.call(token, 'apiHome', []), /SIGNIN/);
});
