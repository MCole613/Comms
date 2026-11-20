/**
 * Data.gs — storage. Each table is a tab in the app's data spreadsheet; every
 * cell is stored as plain text so dates stay 'YYYY-MM-DD'.
 */

function db_() {
  var id = PropertiesService.getScriptProperties().getProperty('DATA_SPREADSHEET_ID');
  if (!id) throw new Error('The app has not been set up yet. Run setup() from the Apps Script editor.');
  if (!db_.cache) db_.cache = SpreadsheetApp.openById(id);
  return db_.cache;
}

function sheet_(name) {
  var sh = db_().getSheetByName(name);
  if (!sh) throw new Error('Missing "' + name + '" table. Run setup() again.');
  return sh;
}

function readTable_(name) {
  var values = sheet_(name).getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var keyFor = {};
  COLUMNS[name].forEach(function (c) { keyFor[c[1]] = c[0]; });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    if (values[r].join('') === '') continue;
    var o = { _row: r + 1 };
    COLUMNS[name].forEach(function (c) { o[c[0]] = ''; });
    headers.forEach(function (h, c) { if (keyFor[h]) o[keyFor[h]] = String(values[r][c] === null ? '' : values[r][c]); });
    rows.push(o);
  }
  return rows;
}

function rowOf_(name, o) {
  return COLUMNS[name].map(function (c) {
    var v = o[c[0]];
    return v === undefined || v === null ? '' : String(v);
  });
}

function appendRows_(name, objs) {
  if (!objs.length) return;
  var sh = sheet_(name);
  var range = sh.getRange(sh.getLastRow() + 1, 1, objs.length, COLUMNS[name].length);
  range.setNumberFormat('@');
  range.setValues(objs.map(function (o) { return rowOf_(name, o); }));
}

function updateRow_(name, o) {
  if (!o._row) throw new Error('Cannot update a row that was never saved.');
  var range = sheet_(name).getRange(o._row, 1, 1, COLUMNS[name].length);
  range.setNumberFormat('@');
  range.setValues([rowOf_(name, o)]);
}

function readSettings_() {
  var values = sheet_(TABLES.SETTINGS).getDataRange().getValues();
  var out = {};
  for (var i = 1; i < values.length; i++) {
    var k = String(values[i][0] || '').trim();
    if (k) out[k] = String(values[i][1] === null ? '' : values[i][1]).trim();
  }
  return out;
}

function writeSettings_(changes) {
  var sh = sheet_(TABLES.SETTINGS);
  var values = sh.getDataRange().getValues();
  Object.keys(changes).forEach(function (key) {
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === key) {
        sh.getRange(i + 1, 2).setNumberFormat('@').setValue(String(changes[key]));
        return;
      }
    }
    sh.appendRow([key, String(changes[key]), '']);
    values.push([key, changes[key], '']);
  });
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function nowText_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

function todayIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function lc_(s) { return String(s || '').trim().toLowerCase(); }

function splitList_(s) {
  return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(String);
}

function logActivity_(requestId, by, type, text, link) {
  appendRows_(TABLES.ACTIVITY, [{ at: nowText_(), requestId: requestId, by: by, type: type, text: text || '', link: link || '' }]);
}
