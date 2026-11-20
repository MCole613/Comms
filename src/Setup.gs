/**
 * Setup.gs — run setup() once from the Apps Script editor (safe to re-run).
 * Then run importFromHub() once to bring over everything from the old hub.
 */

function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DATA_SPREADSHEET_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('Communications App — Data (do not edit)');
    props.setProperty('DATA_SPREADSHEET_ID', ss.getId());
  }
  db_.cache = ss;

  ensureTable_(ss, TABLES.SETTINGS, ['Setting', 'Value', 'What it does'], DEFAULT_SETTINGS);
  [TABLES.PEOPLE, TABLES.REQUESTS, TABLES.TASKS, TABLES.ACTIVITY, TABLES.SESSIONS].forEach(function (name) {
    ensureTable_(ss, name, COLUMNS[name].map(function (c) { return c[1]; }), []);
  });
  var blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

  // The person running setup is the communications admin.
  var me = lc_(Session.getEffectiveUser().getEmail());
  if (me && !personByEmail_(me, readPeople_())) {
    appendRows_(TABLES.PEOPLE, [{ email: me, name: me.split('@')[0], role: ROLES.ADMIN, ministry: 'Communications', active: 'Yes' }]);
  }

  // Staff at the owner's domain (e.g. calvaryirwin.com) can sign in without being added.
  if (me && !readSettings_()['Self sign-up domains'] && !/@gmail\.com$/.test(me)) {
    writeSettings_({ 'Self sign-up domains': me.split('@')[1] });
  }

  // Lock the data file: only the app (running as its owner) edits it.
  ss.getSheets().forEach(function (sh) {
    var p = sh.protect().setDescription('Managed by the Communications App');
    p.getEditors().forEach(function (u) { if (lc_(u.getEmail()) !== me) p.removeEditor(u); });
    if (p.canDomainEdit()) p.setDomainEdit(false);
  });

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendWeeklyDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendWeeklyDigest').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();

  Logger.log('Setup complete. Data file: ' + ss.getUrl());
  return ss.getUrl();
}

function ensureTable_(ss, name, headers, seed) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (seed.length) {
      sh.getRange(2, 1, seed.length, headers.length).setNumberFormat('@').setValues(seed.map(function (r) { return r.map(String); }));
    }
    return sh;
  }
  // Add any columns introduced by newer versions of the app.
  var have = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  headers.forEach(function (h) {
    if (have.indexOf(h) < 0) { sh.getRange(1, have.length + 1).setValue(h).setFontWeight('bold'); have.push(h); }
  });
  if (name === TABLES.SETTINGS) {
    var keys = sh.getDataRange().getValues().map(function (r) { return String(r[0]); });
    seed.forEach(function (row) { if (keys.indexOf(row[0]) < 0) sh.appendRow(row); });
  }
  return sh;
}
