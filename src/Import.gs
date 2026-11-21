/**
 * Import.gs — one-time move from the old Communications Hub spreadsheet.
 *
 * Run importFromHub() from the Apps Script editor after setup(). It copies
 * settings, people, requests, timeline tasks and design feedback history.
 * Safe to re-run: requests that were already imported are skipped.
 */

var HUB_SPREADSHEET_ID = '1mc1sJEt76YJsyKz4t92aja0ggfwnc43IS0aheGX20h8';

function importFromHub(hubId) {
  var hub = SpreadsheetApp.openById(hubId || HUB_SPREADSHEET_ID);
  var summary = importHub_(hub);
  Logger.log(JSON.stringify(summary));
  return summary;
}

function hubTab_(hub, name) {
  var sh = hub.getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  var headers = values.shift().map(function (h) { return String(h).trim(); });
  return values.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    var o = {};
    headers.forEach(function (h, i) { if (h && !(h in o)) o[h] = r[i]; });
    return o;
  });
}

function hubText_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  return String(v).trim();
}

function hubDate_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var s = String(v).trim(), m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return m[0];
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  var d = new Date(s.replace(/^[A-Za-z]{3},\s*/, ''));
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function importHub_(hub) {
  var out = { settings: 0, people: 0, requests: 0, tasks: 0, activity: 0, skipped: 0 };

  /* ---- settings (Config tab: column A = setting, B = value, D = ministries) ---- */
  var cfgValues = hub.getSheetByName('Config').getDataRange().getValues();
  var cfg = {};
  var ministries = [];
  cfgValues.forEach(function (r, i) {
    if (r[0]) cfg[String(r[0]).trim()] = hubText_(r[1]);
    if (i > 0 && r[3]) ministries.push(String(r[3]).trim());
  });
  var settings = {};
  ['Brand header text', 'Brand header color', 'Brand header text color', 'Brand accent color', 'Brand font', 'Brand header font',
    'Brand footer text', 'Designer handles', 'Sprint cap per year', 'Included revision rounds', 'Revision turnaround days', 'Review window days']
    .forEach(function (k) { if (cfg[k]) settings[k] = cfg[k]; });
  if (cfg['Master calendar link']) settings['Master calendar ID'] = calendarIdFrom_(cfg['Master calendar link']);
  if (cfg['Drive Parent Folder']) settings['Drive parent folder'] = cfg['Drive Parent Folder'];
  if (ministries.length) settings['Ministries'] = ministries.join(', ');
  writeSettings_(settings);
  out.settings = Object.keys(settings).length;

  /* ---- requests ---- */
  var hubRequests = hubTab_(hub, 'Requests');
  var have = {};
  readTable_(TABLES.REQUESTS).forEach(function (r) { have[r.requestId] = true; });

  /* ---- people ---- */
  var people = readPeople_();
  var newPeople = {};
  function addPerson(email, name, role, ministry) {
    email = lc_(email);
    if (!email) return;
    var existing = personByEmail_(email, people) || newPeople[email];
    if (existing) {
      if (role !== ROLES.STAFF && existing.role === ROLES.STAFF) existing.role = role;
      if (name && (!existing.name || existing.name === email.split('@')[0])) existing.name = name;
      if (existing._row) updateRow_(TABLES.PEOPLE, existing);
      return;
    }
    newPeople[email] = { email: email, name: name || email.split('@')[0], role: role, ministry: ministry || '', active: 'Yes' };
  }
  var requesterName = {};
  hubRequests.forEach(function (r) { requesterName[lc_(r['Requester Email'])] = hubText_(r['Requester']); });
  addPerson(cfg['Your email'], requesterName[lc_(cfg['Your email'])], ROLES.ADMIN, 'Communications');
  addPerson(cfg['Designer email'], cfg['Designer name'], ROLES.DESIGNER, 'Communications');
  addPerson(cfg['Pastor email'], cfg['Pastor name'], ROLES.PASTOR, 'Pastoral / Staff');
  hubRequests.forEach(function (r) { addPerson(r['Requester Email'], hubText_(r['Requester']), ROLES.STAFF, hubText_(r['Ministry'])); });
  var fresh = Object.keys(newPeople).map(function (k) { return newPeople[k]; });
  appendRows_(TABLES.PEOPLE, fresh);
  out.people = fresh.length;
  people = readPeople_();

  var TYPE = { 'promotion': 'Promotion', 'sermon series': 'Series', 'design only': 'Design' };
  var rows = [];
  var activity = [];
  hubRequests.forEach(function (h) {
    var id = hubText_(h['Request ID']);
    if (!id) return;
    if (have[id]) { out.skipped++; return; }
    var type = TYPE[lc_(h['Request Type'])] || 'Promotion';
    var r = {
      requestId: id, submitted: hubText_(h['Submitted']), requester: hubText_(h['Requester']), requesterEmail: lc_(h['Requester Email']),
      ministry: hubText_(h['Ministry']), requestType: type, title: hubText_(h['Event / Initiative']), eventDate: hubDate_(h['Event Date']),
      suggestedTier: hubText_(h['Suggested Tier']), tier: hubText_(h['Final Tier']), mode: hubText_(h['Mode']),
      status: hubText_(h['Status']) === 'Approved' ? STATUS.PLANNED : hubText_(h['Status']), flags: hubText_(h['Flags']),
      whoFor: hubText_(h['Who For']), reach: hubText_(h['Reach']), bridge: hubText_(h['Bridge Event']), nextStepType: hubText_(h['Next Step Type']),
      story: hubText_(h['Story']), oneNextStep: hubText_(h['One Next Step']), timeLocation: hubText_(h['Event Time & Location']),
      registration: hubText_(h['PCO Registration']), details: hubText_(h['Details']), needsDesign: hubText_(h['Needs Design']),
      designItems: hubText_(h['Design Items']), designSpecs: hubText_(h['Design Specs']), inspiration: hubText_(h['Inspiration']),
      anythingElse: hubText_(h['Anything Else']), designFolder: hubText_(h['Design Folder']), calendarIds: hubText_(h['Calendar IDs']),
      results: hubText_(h['Results (post-event)']), seriesWeeks: hubText_(h['Series Weeks']), weeklyTitles: hubText_(h['Weekly Titles']),
      visualDirection: hubText_(h['Visual Direction']), messageToRequester: hubText_(h['Message to Requester']),
      requestedNewDate: hubDate_(h['Requested New Date']), designState: hubText_(h['Design State']),
      designStateSince: hubDate_(h['Design State Since']), designRound: hubText_(h['Design Round']) || '0',
      heldFeedback: hubText_(h['Held Feedback']), updatedAt: nowText_()
    };
    if (type === 'Series') {
      // The hub stored the series big idea in "Story" and the scripture in "Details".
      r.bigIdea = r.story; r.scripture = r.details;
    }
    if (r.status === STATUS.PLANNED && r.needsDesign === 'Yes' && !r.designState) r.designState = DESIGN.BRIEFED;
    rows.push(r);
    activity.push({ at: r.submitted, requestId: id, by: r.requesterEmail, type: 'Imported', text: 'Imported from the Communications Hub.' });
    String(h['Design Feedback Log'] || '').split('\n').filter(String).forEach(function (line) {
      activity.push({ at: r.submitted, requestId: id, by: '', type: /APPROVED/.test(line) ? 'Approved' : 'Feedback', text: line.trim() });
    });
    if (hubText_(h['Change Requests'])) activity.push({ at: r.submitted, requestId: id, by: '', type: 'Change', text: hubText_(h['Change Requests']) });
  });
  appendRows_(TABLES.REQUESTS, rows);
  out.requests = rows.length;

  /* ---- tasks ---- */
  var imported = {};
  rows.forEach(function (r) { imported[r.requestId] = r; });
  var OWNER = { 'michael': 'Comms', 'designer': 'Designer', 'pastor': 'Pastor', 'ministry leader': 'Leader' };
  var seen = {};
  var tasks = [];
  hubTab_(hub, 'Timeline').forEach(function (t) {
    var rid = hubText_(t['Request ID']);
    var r = imported[rid];
    if (!r) return;
    var text = hubText_(t['Task']);
    var dedupe = hubText_(t['Task Key']) + '|' + text;
    if (seen[dedupe]) return; // the hub sometimes wrote a task twice
    seen[dedupe] = true;
    var owner = OWNER[lc_(t['Owner'])] || 'Comms';
    tasks.push({
      taskKey: hubText_(t['Task Key']), requestId: rid, dueDate: hubDate_(t['Due Date']), channel: hubText_(t['Channel']),
      task: text.replace(/ \(reply to the Communications email\)$/, '').replace(/ \(auto-emailed on approval\)$/, ''),
      owner: owner,
      assigneeEmail: lc_(t['Assigned Email']) || (owner === 'Comms' && cfg['Your email'] ? lc_(cfg['Your email']) : ownerEmail_(owner, r, people)),
      status: /^done$/i.test(hubText_(t['Status'])) ? TASK.DONE : TASK.OPEN, notes: reformatHubDates_(hubText_(t['Notes'])), key: workflowKey_(text)
    });
  });
  appendRows_(TABLES.TASKS, tasks);
  out.tasks = tasks.length;

  // The hub left finished requests as "Planned"; close the ones whose plan is complete.
  out.completed = 0;
  rows.forEach(function (r) {
    var mine = tasks.filter(function (t) { return t.requestId === r.requestId; });
    if (r.status === STATUS.PLANNED && mine.length && mine.every(function (t) { return t.status === TASK.DONE; })) {
      refreshRequestStatus_(r.requestId);
      out.completed++;
    }
  });

  appendRows_(TABLES.ACTIVITY, activity);
  out.activity = activity.length;
  return out;
}

/** "Sun, Oct 4, 2026" (the hub's style) → "Sunday October-4-2026". */
function reformatHubDates_(s) {
  return String(s).replace(/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), ([A-Z][a-z]{2}) (\d{1,2}), (\d{4})\b/g, function (m, mon, day, year) {
    var mi = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(mon);
    return mi < 0 ? m : prettyIso(year + '-' + ('0' + (mi + 1)).slice(-2) + '-' + ('0' + day).slice(-2));
  });
}

function workflowKey_(text) {
  if (/^design brief/i.test(text)) return 'brief';
  if (/^(first draft due|create the design in-house)/i.test(text)) return 'draft';
  if (/^review the /i.test(text)) return 'review';
  if (/^design check-in/i.test(text)) return 'checkin';
  if (/^final (assets|design files)/i.test(text)) return 'final';
  if (/^round \d+ revisions/i.test(text)) return 'revision';
  if (/log results|wrap-up/i.test(text)) return 'results';
  return '';
}
