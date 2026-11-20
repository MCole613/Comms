/**
 * Auth.gs — email sign-in codes, so people outside the church Google domain
 * (volunteers, contractors, outside designers) can use the app.
 *
 *  1. Someone enters their email. If they're on the People list (or their
 *     address is in "Self sign-up domains"), the app emails a 6-digit code.
 *  2. They enter the code and get a session token, kept on their device for
 *     90 days. Every call from the page goes through call(), which checks it.
 */

var SESSION_DAYS = 90;
var CODE_MINUTES = 10;
var CODE_TRIES = 5;
var CODES_PER_HOUR = 5;

/** Set by call() for the length of one request. */
var CURRENT_SESSION_ = null;

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function validEmail_(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/** May this email sign in? People list (active) or a self sign-up domain. */
function canSignIn_(email, people, settings) {
  if (personByEmail_(email, people)) return true;
  // Someone the admin deactivated stays out, even at a self sign-up domain.
  var listed = readTable_(TABLES.PEOPLE).some(function (x) { return lc_(x.email) === email; });
  if (listed) return false;
  var domain = email.split('@')[1];
  return splitList_(settings['Self sign-up domains']).map(lc_).indexOf(domain) >= 0;
}

/* ---------------- public sign-in API (no session needed) ---------------- */

function apiRequestCode(email) {
  email = lc_(email);
  if (!validEmail_(email)) throw new Error('Enter a valid email address.');
  var cache = CacheService.getScriptCache();
  var rlKey = 'rl:' + hash_(email);
  var sent = Number(cache.get(rlKey)) || 0;
  if (sent >= CODES_PER_HOUR) throw new Error('Too many codes requested. Please wait an hour and try again.');

  var settings = readSettings_();
  if (canSignIn_(email, readPeople_(), settings)) {
    var code = String(Math.floor(100000 + Math.random() * 900000));
    cache.put('otp:' + hash_(email), JSON.stringify({ h: hash_(email + ':' + code), t: 0 }), CODE_MINUTES * 60);
    cache.put(rlKey, String(sent + 1), 3600);
    send_(settings, {
      to: email,
      subject: 'Your sign-in code: ' + code,
      html: '<p>Your code for <b>' + esc_(settings['Brand header text'] || 'the Communications app') + '</b> is:</p>' +
        '<p style="font:700 28px Helvetica,Arial,sans-serif;letter-spacing:6px">' + code + '</p>' +
        '<p style="color:#66727f">It expires in ' + CODE_MINUTES + ' minutes. If you didn\'t ask for it, you can ignore this email.</p>'
    });
  }
  // Same answer either way, so the page doesn't reveal who has access.
  return { ok: true };
}

function apiVerifyCode(email, code) {
  email = lc_(email);
  code = String(code || '').replace(/\D/g, '');
  var cache = CacheService.getScriptCache();
  var key = 'otp:' + hash_(email);
  var raw = cache.get(key);
  if (!raw) throw new Error('That code has expired. Request a new one.');
  var rec = JSON.parse(raw);
  if (rec.h !== hash_(email + ':' + code)) {
    rec.t++;
    if (rec.t >= CODE_TRIES) { cache.remove(key); throw new Error('Too many wrong tries. Request a new code.'); }
    cache.put(key, JSON.stringify(rec), CODE_MINUTES * 60);
    throw new Error('That code isn\'t right. Check the email and try again.');
  }
  cache.remove(key);

  var token = createSession_(email);
  // Self sign-up: add them to People so they show up for admins.
  withLock_(function () {
    if (!readTable_(TABLES.PEOPLE).some(function (p) { return lc_(p.email) === email; })) {
      appendRows_(TABLES.PEOPLE, [{ email: email, name: '', role: ROLES.STAFF, ministry: '', active: 'Yes' }]);
    }
  });
  return { token: token };
}

function createSession_(email) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var now = new Date();
  var expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  withLock_(function () {
    appendRows_(TABLES.SESSIONS, [{
      tokenHash: hash_(token), email: lc_(email), created: nowText_(),
      expires: Utilities.formatDate(expires, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
    }]);
  });
  return token;
}

function sessionFor_(token) {
  if (!token || String(token).length < 32) return null;
  var h = hash_(token);
  var now = nowText_();
  var s = readTable_(TABLES.SESSIONS).filter(function (x) { return x.tokenHash === h; })[0];
  if (!s || s.revoked === 'Yes' || s.expires < now) return null;
  return s;
}

/** Sign out this device. */
function apiSignOut() {
  var s = CURRENT_SESSION_;
  if (!s || !s._row) return { ok: true };
  withLock_(function () { s.revoked = 'Yes'; updateRow_(TABLES.SESSIONS, s); });
  return { ok: true };
}

/* ---------------- the one entry point the page calls ---------------- */

/**
 * Every signed-in request goes through here: call(token, 'apiHome', []).
 * The api* functions refuse to run without a session set by this function.
 */
function call(token, name, args) {
  var api = apiMap_();
  if (!Object.prototype.hasOwnProperty.call(api, name)) throw new Error('Unknown action.');
  var s = sessionFor_(token);
  if (!s) throw new Error('SIGNIN: Please sign in again.');
  var people = readPeople_();
  var p = personByEmail_(s.email, people);
  // Removed or deactivated people lose access straight away.
  if (!p && !canSignIn_(s.email, people, readSettings_())) throw new Error('SIGNIN: Your access has been removed. Ask the communications team.');
  CURRENT_SESSION_ = s;
  try {
    return api[name].apply(null, args || []);
  } finally {
    CURRENT_SESSION_ = null;
  }
}

/** Removes expired sessions (runs with the weekly digest). */
function cleanupSessions_() {
  var now = nowText_();
  var sh = sheet_(TABLES.SESSIONS);
  var rows = readTable_(TABLES.SESSIONS);
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].expires < now || rows[i].revoked === 'Yes') sh.deleteRow(rows[i]._row);
  }
}
