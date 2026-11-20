/**
 * Db.gs — tiny helper layer that treats each sheet as a table of objects.
 * All data cells are stored as plain text so dates come back as 'YYYY-MM-DD'.
 */

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet "' + name + '". Run setup() from the Apps Script editor first.');
  return sh;
}

/** Reads a sheet into [{key: value, _row: n}] using COLUMNS for header mapping. */
function readTable_(name) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var cols = COLUMNS[name];
  var keyFor = {};
  cols.forEach(function (c) { keyFor[c[1]] = c[0]; });

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    if (values[r].join('').trim() === '') continue;
    var obj = { _row: r + 1 };
    for (var c = 0; c < headers.length; c++) {
      var key = keyFor[headers[c]];
      if (key) obj[key] = String(values[r][c]).trim();
    }
    rows.push(obj);
  }
  return rows;
}

function toRow_(name, obj) {
  return COLUMNS[name].map(function (c) {
    var v = obj[c[0]];
    return v === undefined || v === null ? '' : String(v);
  });
}

/** Appends many objects in one write. */
function appendRows_(name, objs) {
  if (!objs.length) return;
  var sh = sheet_(name);
  var start = sh.getLastRow() + 1;
  var width = COLUMNS[name].length;
  var range = sh.getRange(start, 1, objs.length, width);
  range.setNumberFormat('@');
  range.setValues(objs.map(function (o) { return toRow_(name, o); }));
}

/** Writes changed fields back to an object previously returned by readTable_. */
function updateRow_(name, obj) {
  var sh = sheet_(name);
  var range = sh.getRange(obj._row, 1, 1, COLUMNS[name].length);
  range.setNumberFormat('@');
  range.setValues([toRow_(name, obj)]);
}

function readSettings_() {
  var values = sheet_(SHEETS.SETTINGS).getDataRange().getDisplayValues();
  var out = {};
  for (var i = 1; i < values.length; i++) {
    if (values[i][0]) out[String(values[i][0]).trim()] = String(values[i][1]).trim();
  }
  return out;
}

function setSetting_(key, value) {
  var sh = sheet_(SHEETS.SETTINGS);
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      sh.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value, '']);
}

function readTeam_() {
  return readTable_(SHEETS.TEAM).filter(function (p) {
    return p.email && !/^(no|false|n)$/i.test(p.active || '');
  });
}

function readTemplates_() {
  return readTable_(SHEETS.TEMPLATES).filter(function (t) { return t.deliverable && t.task; });
}

function splitEmails_(s) {
  return String(s || '').split(/[\s,;]+/).map(function (e) { return e.trim().toLowerCase(); })
    .filter(function (e) { return e.indexOf('@') > 0; });
}
