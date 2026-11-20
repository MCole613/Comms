/**
 * Code.gs — web app entry point and the API the page calls via google.script.run.
 */

function doGet() {
  var config = readConfig_();
  var t = HtmlService.createTemplateFromFile('Index');
  t.brand = brandOf_(config);
  return t.evaluate()
    .setTitle(t.brand.headerText)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Source of the branching logic, injected into the page so client and server agree. */
function formLogicSource() {
  return visibleSections.toString();
}

function brandOf_(config) {
  function color(key, fallback) {
    var v = String(config[key] || '').trim();
    return /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback;
  }
  function font(key, fallback) {
    var v = String(config[key] || '').trim();
    return /^[A-Za-z0-9 ]{2,40}$/.test(v) ? v : fallback;
  }
  return {
    headerText: String(config['Brand header text'] || 'Communications Hub').slice(0, 80),
    headerColor: color('Brand header color', '#00b5e2'),
    headerTextColor: color('Brand header text color', '#ffffff'),
    accent: color('Brand accent color', '#00b5e2'),
    font: font('Brand font', 'Georgia'),
    headerFont: font('Brand header font', 'Montserrat')
  };
}

/** Loads everything most calls need in one pass. */
function context_() {
  var config = readConfig_();
  var requests = readRequests_();
  var tasks = readTasks_(config, requests);
  var user = currentUser_(config, requests);
  return { config: config, requests: requests, tasks: tasks, user: user };
}

/** Open = not closed in the hub, and not every task in its plan is done. */
function isOpen_(r, tasks) {
  if (CLOSED_REQUEST.test(r.status)) return false;
  var mine = tasks.filter(function (t) { return t.requestId === r.requestId; });
  return !mine.length || mine.some(function (t) { return !t.done; });
}

function findRequest_(ctx, requestId) {
  var r = ctx.requests.filter(function (x) { return x.requestId === requestId; })[0];
  if (!r) throw new Error('Request ' + requestId + ' was not found.');
  return r;
}

function designerHandles_(config) {
  return String(config['Designer handles'] || '').split(',').map(lc_).filter(String);
}

/* ------------------------------------------------------------------ */
/* Read APIs                                                           */
/* ------------------------------------------------------------------ */

function apiBootstrap() {
  var ctx = context_();
  var c = ctx.config;
  return {
    user: ctx.user,
    today: todayIso_(),
    designerName: c['Designer name'] || 'Designer',
    designerHandles: designerHandles_(c),
    sprintCap: Number(c['Sprint cap per year']) || 0,
    includedRounds: Number(c['Included revision rounds']) || 0,
    links: {
      calendar: safeUrl_(c['Master calendar link']),
      hubSheet: ctx.user.isAdmin ? 'https://docs.google.com/spreadsheets/d/' + HUB_SPREADSHEET_ID + '/edit' : ''
    },
    forms: {
      feedback: !!formIdFromUrl_(c[FORM_CONFIG_KEYS.feedback]),
      change: !!formIdFromUrl_(c[FORM_CONFIG_KEYS.change])
    },
    myOpenTasks: myTasks_(ctx).filter(function (t) { return !t.done; }).length
  };
}

function apiHome() {
  var ctx = context_();
  var today = todayIso_();
  var in7 = addDaysIso_(today, 7);
  var year = today.slice(0, 4);
  var open = ctx.tasks.filter(function (t) { return !t.done; });
  var sprints = ctx.requests.filter(function (r) {
    return /level 1/i.test(r.tier) && r.eventDate.slice(0, 4) === year && !/^(cancelled|declined)$/i.test(r.status);
  }).length;
  var mine = myTasks_(ctx).filter(function (t) { return !t.done; });
  var myRequests = ctx.requests.filter(function (r) { return r.requesterEmail === ctx.user.email && isOpen_(r, ctx.tasks); });

  return {
    stats: {
      needsReview: ctx.requests.filter(function (r) { return /needs review/i.test(r.status); }).length,
      overdue: open.filter(function (t) { return t.dueDate && t.dueDate < today; }).length,
      dueSoon: open.filter(function (t) { return t.dueDate >= today && t.dueDate <= in7; }).length,
      designerOpen: open.filter(function (t) { return /designer/i.test(t.owner); }).length,
      sprints: sprints,
      sprintCap: Number(ctx.config['Sprint cap per year']) || 0
    },
    myTasks: mine.slice(0, 8),
    myRequests: myRequests.map(function (r) { return requestSummary_(r, ctx.tasks); }),
    reviewQueue: ctx.user.isAdmin
      ? ctx.requests.filter(function (r) { return /needs (review|info)/i.test(r.status); }).map(function (r) { return requestSummary_(r, ctx.tasks); })
      : []
  };
}

function myTasks_(ctx) {
  return ctx.tasks.filter(function (t) { return t.assigneeEmail && t.assigneeEmail === ctx.user.email; });
}

function apiMyTasks() {
  return myTasks_(context_());
}

function apiRequests(scope) {
  var ctx = context_();
  var list = ctx.requests;
  if (scope === 'mine') list = list.filter(function (r) { return r.requesterEmail === ctx.user.email; });
  return list.map(function (r) { return requestSummary_(r, ctx.tasks); })
    .sort(function (a, b) { return a.eventDate < b.eventDate ? 1 : a.eventDate > b.eventDate ? -1 : 0; });
}

function apiRequestDetail(requestId) {
  var ctx = context_();
  var r = findRequest_(ctx, requestId);
  var isMine = r.requesterEmail === ctx.user.email;
  return {
    request: r,
    tasks: ctx.tasks.filter(function (t) { return t.requestId === requestId; }),
    can: {
      feedback: isMine || ctx.user.isAdmin,
      change: isMine || ctx.user.isAdmin,
      upload: isMine || ctx.user.isAdmin || ctx.user.isDesigner
    }
  };
}

function apiTeamTimeline() {
  var ctx = context_();
  return ctx.tasks.filter(function (t) { return !t.done; });
}

function apiDesignQueue() {
  var ctx = context_();
  var handles = designerHandles_(ctx.config);
  var designerTasks = ctx.tasks.filter(function (t) { return /designer/i.test(t.owner) && !t.done; });
  var items = ctx.requests.filter(function (r) {
    return /^yes$/i.test(r.needsDesign) && isOpen_(r, ctx.tasks) && !/^approved$/i.test(r.designState);
  }).map(function (r) {
    var s = requestSummary_(r, ctx.tasks);
    s.handledBy = handles.indexOf(lc_(r.tier)) >= 0 ? 'designer' : 'in-house';
    s.designerTasks = designerTasks.filter(function (t) { return t.requestId === r.requestId; });
    return s;
  }).sort(function (a, b) { return a.eventDate < b.eventDate ? -1 : 1; });
  return { items: items, designerTasks: designerTasks };
}

function addDaysIso_(iso, n) {
  var p = iso.split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n);
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

function apiForm(kind, requestId) {
  if (!FORM_CONFIG_KEYS[kind]) throw new Error('Unknown form.');
  var ctx = context_();
  if (kind !== 'request') assertCanAct_(ctx, findRequest_(ctx, requestId), 'change');
  var desc = describeForm_(openForm_(kind, ctx.config));
  desc.prefill = prefillFor_(desc, { email: ctx.user.email, name: ctx.user.name, requestId: requestId || '' });
  return desc;
}

function assertCanAct_(ctx, request, what) {
  var ok = request.requesterEmail === ctx.user.email || ctx.user.isAdmin || (what === 'upload' && ctx.user.isDesigner);
  if (!ok) throw new Error('Only the person who submitted this request (or the communications team) can do that.');
}

/**
 * Submits one of the hub's forms on the signed-in person's behalf.
 * kind: 'request' | 'feedback' | 'change'
 */
function apiSubmit(kind, answers, files, requestId) {
  if (!FORM_CONFIG_KEYS[kind]) throw new Error('Unknown form.');
  answers = answers || {};
  var ctx = context_();
  var request = kind === 'request' ? null : findRequest_(ctx, requestId);
  if (request) assertCanAct_(ctx, request, 'change');

  var form = openForm_(kind, ctx.config);
  var desc = describeForm_(form);

  // Locked fields (email, request ID) always come from the server, never the browser.
  var prefill = prefillFor_(desc, { email: ctx.user.email, name: ctx.user.name, requestId: requestId || '' });
  Object.keys(prefill).forEach(function (id) { if (prefill[id].lock) answers[id] = prefill[id].value; });

  if (files && files.length) {
    var folder = request && request.designFolder
      ? folderFromUrl_(request.designFolder)
      : newUploadFolder_(ctx.config, answers, desc);
    saveFiles_(folder, files);
    attachLink_(desc, answers, folder.getUrl());
  }

  var before = {};
  ctx.requests.forEach(function (r) { before[r.requestId] = true; });

  submitForm_(form, answers);

  var result = { ok: true, requestId: requestId || '' };
  if (kind === 'request') result.requestId = waitForNewRequest_(ctx.user.email, before);
  return result;
}

/** The hub's automation runs right after submit; give it a moment to assign an ID. */
function waitForNewRequest_(email, before) {
  for (var i = 0; i < 8; i++) {
    Utilities.sleep(2500);
    var found = readRequests_().filter(function (r) { return !before[r.requestId] && r.requesterEmail === email; });
    if (found.length) return found[found.length - 1].requestId;
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

function folderIdFromUrl_(url) {
  var m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(String(url || '')) || /[?&]id=([A-Za-z0-9_-]{10,})/.exec(String(url || ''));
  return m ? m[1] : '';
}

function folderFromUrl_(url) {
  var id = folderIdFromUrl_(url);
  if (!id) throw new Error('This request does not have a Drive folder yet.');
  return DriveApp.getFolderById(id);
}

function newUploadFolder_(config, answers, desc) {
  var parentId = folderIdFromUrl_(config['Drive Parent Folder']);
  var parent = parentId ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder();
  var it = parent.getFoldersByName('App uploads');
  var uploads = it.hasNext() ? it.next() : parent.createFolder('App uploads');
  var title = '';
  desc.sections.forEach(function (s) {
    s.items.forEach(function (i) {
      if (!title && /name|title|what are we making/i.test(i.title) && !/your name/i.test(i.title) && answers[i.id]) title = String(answers[i.id]);
    });
  });
  var folder = uploads.createFolder(todayIso_() + ' — ' + (title || 'Request').slice(0, 80));
  try { folder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* consumer accounts */ }
  return folder;
}

function saveFiles_(folder, files) {
  if (files.length > 10) throw new Error('Please attach 10 files or fewer.');
  files.forEach(function (f) {
    var bytes = Utilities.base64Decode(String(f.data || ''));
    if (bytes.length > MAX_FILE_BYTES) throw new Error('"' + f.name + '" is larger than 10 MB.');
    folder.createFile(Utilities.newBlob(bytes, f.mimeType || 'application/octet-stream', String(f.name || 'upload').slice(0, 200)));
  });
}

/** Adds "Attachments: <link>" to the first visible notes-style question. */
function attachLink_(desc, answers, url) {
  var path = visibleSections(desc.sections, answers);
  var items = [];
  path.indexes.forEach(function (i) { items = items.concat(desc.sections[i].items); });
  for (var p = 0; p < ATTACHMENT_TARGETS.length; p++) {
    for (var k = 0; k < items.length; k++) {
      if (items[k].kind === 'paragraph' && ATTACHMENT_TARGETS[p].test(items[k].title)) {
        var cur = String(answers[items[k].id] || '').trim();
        answers[items[k].id] = (cur ? cur + '\n\n' : '') + 'Attachments: ' + url;
        return;
      }
    }
  }
}

/** Designer (or requester/admin) uploads straight into the request's Design Folder. */
function apiUploadFiles(requestId, files) {
  var ctx = context_();
  var request = findRequest_(ctx, requestId);
  assertCanAct_(ctx, request, 'upload');
  if (!files || !files.length) throw new Error('Choose at least one file.');
  saveFiles_(folderFromUrl_(request.designFolder), files);
  return { ok: true, count: files.length };
}
