/**
 * Setup.gs — run setup() once from the Apps Script editor.
 * It is safe to run again: existing sheets and data are left alone.
 */

function setup() {
  var ss = ss_();
  if (!ss) throw new Error('Open this script from a Google Sheet (Extensions → Apps Script), or set the SPREADSHEET_ID script property.');

  ensureSheet_(ss, SHEETS.SETTINGS, ['Setting', 'Value', 'What it does'], DEFAULT_SETTINGS);
  ensureSheet_(ss, SHEETS.TEAM, headers_(SHEETS.TEAM), DEFAULT_TEAM);
  ensureSheet_(ss, SHEETS.TEMPLATES, headers_(SHEETS.TEMPLATES), DEFAULT_TEMPLATES);
  ensureSheet_(ss, SHEETS.REQUESTS, headers_(SHEETS.REQUESTS), []);
  ensureSheet_(ss, SHEETS.TASKS, headers_(SHEETS.TASKS), []);

  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  var settings = readSettings_();
  if (!settings['Upload Folder ID']) {
    var folder = DriveApp.createFolder((settings['App Name'] || 'Communications Hub') + ' — Request Files');
    setSetting_('Upload Folder ID', folder.getId());
  }

  installTriggers_();
  Logger.log('Setup complete. Next: edit the Team sheet, then Deploy → New deployment → Web app.');
}

function headers_(name) {
  return COLUMNS[name].map(function (c) { return c[1]; });
}

function ensureSheet_(ss, name, headers, seedRows) {
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1f3b57').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  if (seedRows.length) {
    var range = sh.getRange(2, 1, seedRows.length, headers.length);
    range.setNumberFormat('@');
    range.setValues(seedRows.map(function (r) { return r.map(String); }));
  }
  sh.autoResizeColumns(1, headers.length);
  return sh;
}

function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendWeeklyDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendWeeklyDigest').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
}

/** Adds a menu to the spreadsheet so admins can find the app. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Comms Hub')
    .addItem('Open the app', 'showAppLink_')
    .addItem('Run setup', 'setup')
    .addItem('Send weekly digest now', 'sendWeeklyDigest')
    .addToUi();
}

function showAppLink_() {
  var url = ScriptApp.getService().getUrl();
  var html = url
    ? '<p><a href="' + url + '" target="_blank">Open the Communications Hub</a></p><p style="font-size:12px;color:#666">Share this link with your staff.</p>'
    : '<p>The web app has not been deployed yet. In the Apps Script editor choose <b>Deploy → New deployment → Web app</b>.</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(360).setHeight(120), 'Communications Hub');
}
