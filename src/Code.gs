/**
 * Code.gs — web app entry point and the API the front end calls
 * through google.script.run.
 */

var MAX_FILE_BYTES = 10 * 1024 * 1024;

function doGet() {
  var settings = readSettings_();
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle(settings['App Name'] || 'Communications Hub')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ------------------------------------------------------------------ */
/* Identity & permissions                                              */
/* ------------------------------------------------------------------ */

function currentUser_() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) {
    throw new Error('Could not identify you. Make sure you are signed in with your church Google account.');
  }
  var team = readTeam_();
  for (var i = 0; i < team.length; i++) {
    if (String(team[i].email).toLowerCase() === email) {
      var p = team[i];
      p.email = email;
      p.onTeam = true;
      return p;
    }
  }
  return { email: email, name: email, role: '', ministry: '', onTeam: false };
}

function isAdmin_(user, settings) {
  if (String(user.role).toLowerCase() === ROLES.COMMS.toLowerCase()) return true;
  return splitEmails_(settings['Admin Emails']).indexOf(user.email) >= 0;
}

/* ------------------------------------------------------------------ */
/* API: bootstrap                                                      */
/* ------------------------------------------------------------------ */

function apiBootstrap() {
  var settings = readSettings_();
  var user = currentUser_();
  var seen = {};
  var deliverables = [];
  readTemplates_().forEach(function (t) {
    if (t.deliverable === EVERY_REQUEST || seen[t.deliverable]) return;
    seen[t.deliverable] = true;
    deliverables.push(t.deliverable);
  });
  var ministries = {};
  readTeam_().forEach(function (p) { if (p.ministry) ministries[p.ministry] = true; });

  return {
    appName: settings['App Name'] || 'Communications Hub',
    minLeadDays: Number(settings['Minimum Lead Days']) || 0,
    user: { email: user.email, name: user.name, role: user.role, ministry: user.ministry, onTeam: user.onTeam },
    isAdmin: isAdmin_(user, settings),
    deliverables: deliverables,
    ministries: Object.keys(ministries).sort(),
    today: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
  };
}

/* ------------------------------------------------------------------ */
/* API: timeline preview (no writes)                                   */
/* ------------------------------------------------------------------ */

function apiPreviewTimeline(eventDate, deliverables) {
  var user = currentUser_();
  var plan = planRequest_(user, eventDate, deliverables || [], readSettings_());
  return {
    rush: plan.timeline.rush,
    leadDays: plan.timeline.leadDays,
    items: plan.tasks.map(function (t) {
      return { deliverable: t.deliverable, task: t.task, dueDate: t.dueDate, assigneeName: t.assigneeName, assigneeRole: t.assigneeRole, rush: t.rush === 'Yes' };
    })
  };
}

/**
 * Builds the timeline and assigns each step to a person.
 * Returns {timeline, tasks[], designer} — nothing is saved.
 */
function planRequest_(user, eventDate, deliverables, settings) {
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var timeline = buildTimeline({
    eventDate: eventDate,
    submittedDate: today,
    deliverables: deliverables,
    templates: readTemplates_(),
    workDays: parseWorkDays(settings['Work Days']),
    minLeadDays: Number(settings['Minimum Lead Days']) || 0
  });

  var team = readTeam_();
  var openCounts = {};
  readTable_(SHEETS.TASKS).forEach(function (t) {
    if (t.status !== STATUS.DONE) {
      var e = String(t.assigneeEmail).toLowerCase();
      openCounts[e] = (openCounts[e] || 0) + 1;
    }
  });
  var fallbackEmail = splitEmails_(settings['Fallback Assignee Email'])[0];
  var comms = team.filter(function (p) { return String(p.role).toLowerCase() === ROLES.COMMS.toLowerCase(); })[0];
  var fallback = fallbackEmail ? { email: fallbackEmail, name: fallbackEmail } : comms;

  var cache = {};
  var tasks = [];
  var designer = null;
  timeline.items.forEach(function (item) {
    var who = resolveAssignee(item.assignee, user, team, openCounts, fallback, cache);
    if (!who) return; // e.g. no approver → approval step skipped
    if (String(item.assignee).toLowerCase() === ROLES.DESIGNER.toLowerCase()) designer = who;
    tasks.push({
      deliverable: item.deliverable,
      step: item.step,
      task: item.task,
      notes: item.notes,
      assigneeEmail: who.email,
      assigneeName: who.name,
      assigneeRole: who.role,
      dueDate: item.dueDate,
      status: STATUS.NOT_STARTED,
      rush: item.rush ? 'Yes' : ''
    });
  });
  return { timeline: timeline, tasks: tasks, designer: designer };
}

/* ------------------------------------------------------------------ */
/* API: submit a request                                               */
/* ------------------------------------------------------------------ */

function apiSubmitRequest(form) {
  var user = currentUser_();
  var settings = readSettings_();

  var title = clean_(form.title, 200);
  var eventDate = clean_(form.eventDate, 10);
  var deliverables = (form.deliverables || []).map(function (d) { return clean_(d, 100); }).filter(String);
  if (!title) throw new Error('Please give the request a title.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new Error('Please choose an event or launch date.');
  if (!deliverables.length) throw new Error('Choose at least one thing you need (graphics, social media, etc.).');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var plan = planRequest_(user, eventDate, deliverables, settings);
    var tz = Session.getScriptTimeZone();
    var requestId = nextRequestId_();

    var folderUrl = '';
    var files = [];
    if ((form.files && form.files.length) || plan.designer) {
      var folder = createRequestFolder_(settings, requestId, title);
      folderUrl = folder.getUrl();
      files = saveUploads_(folder, form.files || []);
      shareFolder_(folder, plan.tasks.map(function (t) { return t.assigneeEmail; }).concat(user.email));
    }

    var request = {
      requestId: requestId,
      submittedAt: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'),
      submitterEmail: user.email,
      submitterName: user.name,
      ministry: clean_(form.ministry, 100) || user.ministry,
      title: title,
      eventDate: eventDate,
      eventTime: clean_(form.eventTime, 100),
      location: clean_(form.location, 200),
      audience: clean_(form.audience, 200),
      description: clean_(form.description, 5000),
      keyMessage: clean_(form.keyMessage, 5000),
      callToAction: clean_(form.callToAction, 500),
      link: clean_(form.link, 500),
      contact: clean_(form.contact, 200),
      deliverables: deliverables.join(', '),
      designNotes: clean_(form.designNotes, 5000),
      filesUrl: folderUrl,
      designerEmail: plan.designer ? plan.designer.email : '',
      status: STATUS.NEW,
      rush: plan.timeline.rush ? 'Yes' : ''
    };

    plan.tasks.forEach(function (t, i) {
      t.taskId = requestId + '-' + ('0' + (i + 1)).slice(-2);
      t.requestId = requestId;
      t.requestTitle = title;
    });

    appendRows_(SHEETS.REQUESTS, [request]);
    appendRows_(SHEETS.TASKS, plan.tasks);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // Emails go out after the data is safely saved.
  var warnings = [];
  try { sendSubmitterConfirmation_(request, plan.tasks, settings); } catch (e) { warnings.push('confirmation email: ' + e.message); }
  try { sendAssignmentEmails_(request, plan.tasks, settings); } catch (e) { warnings.push('assignment emails: ' + e.message); }
  if (plan.designer) {
    try { sendDesignerBrief_(request, plan.tasks, files, plan.designer, settings); } catch (e) { warnings.push('designer brief: ' + e.message); }
  }
  if (warnings.length) console.warn('Request ' + request.requestId + ' saved, but: ' + warnings.join('; '));

  return { requestId: request.requestId, rush: request.rush === 'Yes', taskCount: plan.tasks.length, warnings: warnings };
}

function nextRequestId_() {
  var prefix = 'REQ-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMM') + '-';
  var max = 0;
  readTable_(SHEETS.REQUESTS).forEach(function (r) {
    if (String(r.requestId).indexOf(prefix) === 0) max = Math.max(max, Number(r.requestId.slice(prefix.length)) || 0);
  });
  return prefix + ('00' + (max + 1)).slice(-3);
}

function clean_(v, maxLen) {
  return String(v === undefined || v === null ? '' : v).trim().slice(0, maxLen || 1000);
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

function createRequestFolder_(settings, requestId, title) {
  var root;
  try {
    root = DriveApp.getFolderById(settings['Upload Folder ID']);
  } catch (e) {
    root = DriveApp.createFolder((settings['App Name'] || 'Communications Hub') + ' — Request Files');
    setSetting_('Upload Folder ID', root.getId());
  }
  return root.createFolder(requestId + ' — ' + title.slice(0, 80));
}

function saveUploads_(folder, uploads) {
  return uploads.slice(0, 10).map(function (f) {
    var bytes = Utilities.base64Decode(String(f.data || ''));
    if (bytes.length > MAX_FILE_BYTES) throw new Error('"' + f.name + '" is larger than 10 MB. Share a Drive link in the notes instead.');
    var blob = Utilities.newBlob(bytes, f.mimeType || 'application/octet-stream', clean_(f.name, 200) || 'upload');
    var file = folder.createFile(blob);
    return { name: file.getName(), url: file.getUrl() };
  });
}

function shareFolder_(folder, emails) {
  var me = String(Session.getEffectiveUser().getEmail()).toLowerCase();
  var seen = {};
  emails.forEach(function (e) {
    e = String(e || '').toLowerCase();
    if (!e || seen[e] || e === me || e.indexOf('@example.') > 0) return;
    seen[e] = true;
    try { folder.addEditor(e); } catch (err) { console.warn('Could not share folder with ' + e + ': ' + err.message); }
  });
}

/* ------------------------------------------------------------------ */
/* API: reading data                                                   */
/* ------------------------------------------------------------------ */

function apiMyTasks() {
  var user = currentUser_();
  return readTable_(SHEETS.TASKS).filter(function (t) {
    return String(t.assigneeEmail).toLowerCase() === user.email;
  }).map(publicTask_).sort(byDue_);
}

function apiRequests() {
  currentUser_();
  var tasks = readTable_(SHEETS.TASKS);
  var progress = {};
  tasks.forEach(function (t) {
    var p = progress[t.requestId] || (progress[t.requestId] = { done: 0, total: 0, nextDue: '' });
    p.total++;
    if (t.status === STATUS.DONE) p.done++;
    else if (!p.nextDue || t.dueDate < p.nextDue) p.nextDue = t.dueDate;
  });
  return readTable_(SHEETS.REQUESTS).map(function (r) {
    var p = progress[r.requestId] || { done: 0, total: 0, nextDue: '' };
    return {
      requestId: r.requestId, title: r.title, ministry: r.ministry, submitterName: r.submitterName,
      eventDate: r.eventDate, deliverables: r.deliverables, status: r.status, rush: r.rush === 'Yes',
      done: p.done, total: p.total, nextDue: p.nextDue, submittedAt: r.submittedAt
    };
  }).reverse();
}

function apiRequestDetail(requestId) {
  currentUser_();
  var request = readTable_(SHEETS.REQUESTS).filter(function (r) { return r.requestId === requestId; })[0];
  if (!request) throw new Error('Request ' + requestId + ' was not found.');
  delete request._row;
  request.rush = request.rush === 'Yes';
  var tasks = readTable_(SHEETS.TASKS).filter(function (t) { return t.requestId === requestId; })
    .map(publicTask_).sort(byDue_);
  return { request: request, tasks: tasks };
}

/** Every open task across all requests — powers the Team Timeline view. */
function apiTeamTimeline() {
  currentUser_();
  return readTable_(SHEETS.TASKS).filter(function (t) {
    return t.status !== STATUS.DONE && t.status !== STATUS.CANCELLED;
  }).map(publicTask_).sort(byDue_);
}

function publicTask_(t) {
  return {
    taskId: t.taskId, requestId: t.requestId, requestTitle: t.requestTitle, deliverable: t.deliverable,
    task: t.task, notes: t.notes, assigneeEmail: t.assigneeEmail, assigneeName: t.assigneeName,
    assigneeRole: t.assigneeRole, dueDate: t.dueDate, status: t.status, rush: t.rush === 'Yes',
    completedAt: t.completedAt
  };
}

function byDue_(a, b) {
  return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* API: updating tasks                                                 */
/* ------------------------------------------------------------------ */

function apiUpdateTask(taskId, newStatus) {
  if ([STATUS.NOT_STARTED, STATUS.IN_PROGRESS, STATUS.DONE].indexOf(newStatus) < 0) {
    throw new Error('Unknown status "' + newStatus + '".');
  }
  var user = currentUser_();
  var settings = readSettings_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var task, request, tasks;
  try {
    tasks = readTable_(SHEETS.TASKS);
    task = tasks.filter(function (t) { return t.taskId === taskId; })[0];
    if (!task) throw new Error('Task not found.');
    request = readTable_(SHEETS.REQUESTS).filter(function (r) { return r.requestId === task.requestId; })[0];

    var allowed = String(task.assigneeEmail).toLowerCase() === user.email ||
      (request && String(request.submitterEmail).toLowerCase() === user.email) ||
      isAdmin_(user, settings);
    if (!allowed) throw new Error('Only the person assigned, the submitter, or an admin can update this task.');

    var wasDone = task.status === STATUS.DONE;
    task.status = newStatus;
    if (newStatus === STATUS.DONE && !wasDone) {
      task.completedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      task.completedBy = user.email;
    } else if (newStatus !== STATUS.DONE) {
      task.completedAt = '';
      task.completedBy = '';
    }
    updateRow_(SHEETS.TASKS, task);

    if (request) {
      var siblings = tasks.filter(function (t) { return t.requestId === task.requestId; });
      var doneCount = siblings.filter(function (t) { return t.status === STATUS.DONE; }).length;
      var started = siblings.some(function (t) { return t.status !== STATUS.NOT_STARTED; });
      var status = doneCount === siblings.length ? STATUS.COMPLETE : started ? STATUS.IN_PROGRESS : STATUS.NEW;
      if (request.status !== status && request.status !== STATUS.CANCELLED) {
        request.status = status;
        updateRow_(SHEETS.REQUESTS, request);
      }
    }
  } finally {
    lock.releaseLock();
  }

  if (newStatus === STATUS.DONE && !wasDone && request) {
    try { notifyNextStep_(task, tasks, request, settings); } catch (e) { console.warn('Next-step email failed: ' + e.message); }
  }
  return publicTask_(task);
}
