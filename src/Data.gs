/**
 * Data.gs — read-only access to the Communications Hub spreadsheet.
 * Columns are found by their header text, so reordering columns is safe.
 */

function hub_() {
  return SpreadsheetApp.openById(HUB_SPREADSHEET_ID);
}

function tz_() {
  return Session.getScriptTimeZone();
}

function todayIso_() {
  return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
}

/** Any cell value → 'YYYY-MM-DD' (or '' when it isn't a date). */
function toIso_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  var m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return m[1] + '-' + m[2] + '-' + m[3];
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) {
    return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  }
  var d = new Date(s.replace(/^[A-Za-z]{3},\s*/, ''));
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}

function toText_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd HH:mm');
  }
  return String(v).trim();
}

/** Reads a tab into objects keyed by header text. */
function readTab_(name) {
  var sh = hub_().getSheetByName(name);
  if (!sh) throw new Error('The hub spreadsheet has no "' + name + '" tab.');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.join('').trim() === '') continue;
    var obj = {};
    headers.forEach(function (h, c) { if (h && !(h in obj)) obj[h] = row[c]; });
    rows.push(obj);
  }
  return rows;
}

/** Config tab: column A = setting, column B = value. */
function readConfig_() {
  var sh = hub_().getSheetByName(TABS.CONFIG);
  if (!sh) throw new Error('The hub spreadsheet has no "' + TABS.CONFIG + '" tab.');
  var values = sh.getDataRange().getValues();
  var out = {};
  values.forEach(function (row) {
    var key = String(row[0] || '').trim();
    if (key && !(key in out)) out[key] = toText_(row[1]);
  });
  return out;
}

function lc_(s) { return String(s || '').trim().toLowerCase(); }

function safeUrl_(s) {
  s = String(s || '').trim();
  return /^https:\/\//i.test(s) ? s : '';
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

function readRequests_() {
  return readTab_(TABS.REQUESTS).map(function (r) {
    return {
      requestId: toText_(r['Request ID']),
      submitted: toText_(r['Submitted']),
      requester: toText_(r['Requester']),
      requesterEmail: lc_(r['Requester Email']),
      ministry: toText_(r['Ministry']),
      title: toText_(r['Event / Initiative']),
      eventDate: toIso_(r['Event Date']),
      suggestedTier: toText_(r['Suggested Tier']),
      tier: toText_(r['Final Tier']) || toText_(r['Suggested Tier']),
      mode: toText_(r['Mode']),
      status: toText_(r['Status']),
      flags: toText_(r['Flags']),
      requestType: toText_(r['Request Type']),
      whoFor: toText_(r['Who For']),
      reach: toText_(r['Reach']),
      bridge: toText_(r['Bridge Event']),
      nextStepType: toText_(r['Next Step Type']),
      story: toText_(r['Story']),
      oneNextStep: toText_(r['One Next Step']),
      timeLocation: toText_(r['Event Time & Location']),
      registration: toText_(r['PCO Registration']),
      details: toText_(r['Details']),
      needsDesign: toText_(r['Needs Design']),
      designItems: toText_(r['Design Items']),
      designSpecs: toText_(r['Design Specs']),
      inspiration: toText_(r['Inspiration']),
      anythingElse: toText_(r['Anything Else']),
      designFolder: safeUrl_(r['Design Folder']),
      seriesWeeks: toText_(r['Series Weeks']),
      weeklyTitles: toText_(r['Weekly Titles']),
      visualDirection: toText_(r['Visual Direction']),
      messageToRequester: toText_(r['Message to Requester']),
      changeRequests: toText_(r['Change Requests']),
      designState: toText_(r['Design State']),
      designRound: toText_(r['Design Round']),
      feedbackLog: toText_(r['Design Feedback Log']),
      heldFeedback: toText_(r['Held Feedback']),
      results: toText_(r['Results (post-event)'])
    };
  }).filter(function (r) { return r.requestId; });
}

/** The fields a list view needs. */
function requestSummary_(r, tasks) {
  var mine = tasks.filter(function (t) { return t.requestId === r.requestId; });
  var open = mine.filter(function (t) { return !t.done; });
  return {
    requestId: r.requestId, title: r.title, ministry: r.ministry, requester: r.requester,
    eventDate: r.eventDate, tier: r.tier, mode: r.mode, status: r.status, flags: r.flags,
    designState: r.designState, designRound: r.designRound, requestType: r.requestType,
    needsDesign: r.needsDesign, designItems: r.designItems, designFolder: r.designFolder,
    tasksDone: mine.length - open.length, tasksTotal: mine.length,
    nextDue: open.length ? open[0].dueDate : ''
  };
}

/* ------------------------------------------------------------------ */
/* Timeline tasks                                                      */
/* ------------------------------------------------------------------ */

function readTasks_(config, requests) {
  var requesterById = {};
  (requests || []).forEach(function (r) { requesterById[r.requestId] = { email: r.requesterEmail, name: r.requester }; });

  var seen = {};
  var tasks = [];
  readTab_(TABS.TIMELINE).forEach(function (t) {
    var key = toText_(t['Task Key']);
    var requestId = toText_(t['Request ID']);
    if (!key || !requestId) return;
    // The hub occasionally writes a task twice; show it once.
    var dedupe = key + '|' + toText_(t['Task']);
    if (seen[dedupe]) return;
    seen[dedupe] = true;

    var owner = toText_(t['Owner']);
    var who = resolveOwner_(owner, toText_(t['Assigned Email']), toText_(t['Assigned To']), config, requesterById[requestId]);
    tasks.push({
      taskKey: key,
      requestId: requestId,
      event: toText_(t['Event']),
      dueDate: toIso_(t['Due Date']),
      channel: toText_(t['Channel']),
      task: toText_(t['Task']),
      owner: owner,
      tier: toText_(t['Tier']),
      status: toText_(t['Status']) || 'Not started',
      done: DONE_TASK.test(toText_(t['Status'])),
      notes: toText_(t['Notes']),
      assigneeName: who.name,
      assigneeEmail: who.email
    });
  });
  tasks.sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0; });
  return tasks;
}

function resolveOwner_(owner, assignedEmail, assignedName, config, requester) {
  if (assignedEmail) return { email: lc_(assignedEmail), name: assignedName || assignedEmail };
  var role = OWNER_TO_ROLE[lc_(owner)];
  if (role) {
    var email = lc_(config[ROLE_CONFIG_KEYS[role]]);
    var name = role === 'designer' ? config['Designer name'] : role === 'pastor' ? config['Pastor name'] : owner;
    return { email: email, name: name || owner };
  }
  if (/leader/i.test(owner) && requester) return { email: requester.email, name: requester.name || owner };
  return { email: '', name: owner };
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

function currentUser_(config, requests) {
  var email = lc_(Session.getActiveUser().getEmail());
  if (!email) throw new Error('Could not identify you. Please sign in with your church Google account.');
  var name = '';
  (requests || []).forEach(function (r) { if (r.requesterEmail === email && r.requester) name = r.requester; });
  if (email === lc_(config[ROLE_CONFIG_KEYS.designer]) && config['Designer name']) name = config['Designer name'];
  if (email === lc_(config[ROLE_CONFIG_KEYS.pastor]) && config['Pastor name']) name = config['Pastor name'];
  return {
    email: email,
    name: name,
    isAdmin: email === lc_(config[ROLE_CONFIG_KEYS.admin]),
    isDesigner: email === lc_(config[ROLE_CONFIG_KEYS.designer]),
    isPastor: email === lc_(config[ROLE_CONFIG_KEYS.pastor])
  };
}
