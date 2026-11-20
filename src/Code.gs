/**
 * Code.gs — web app entry point and the read/admin API used by the page.
 */

function doGet() {
  var s = {};
  try { s = readSettings_(); } catch (e) { /* not set up yet: the page shows the error */ }
  var t = HtmlService.createTemplateFromFile('Index');
  t.brand = brandOf_(s);
  return t.evaluate().setTitle(t.brand.headerText).addMetaTag('viewport', 'width=device-width, initial-scale=1')
    // Allows embedding on the church website (e.g. a ChurchCo HTML Embed block).
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

/** The branching logic, injected into the page so the browser and server agree. */
function formLogicSource() { return visibleSections.toString(); }

function brandOf_(s) {
  function font(k, d) { var v = String(s[k] || '').trim(); return /^[A-Za-z0-9 ]{2,40}$/.test(v) ? v : d; }
  return {
    headerText: String(s['Brand header text'] || 'Communications').slice(0, 80),
    headerColor: color_(s['Brand header color'], '#00b5e2'),
    headerTextColor: color_(s['Brand header text color'], '#ffffff'),
    accent: color_(s['Brand accent color'], '#00b5e2'),
    font: font('Brand font', 'Georgia'),
    headerFont: font('Brand header font', 'Montserrat')
  };
}

/* ---------------- shared loading ---------------- */

function load_() {
  var settings = readSettings_();
  var people = readPeople_();
  var user = currentUser_(people);
  var requests = readTable_(TABLES.REQUESTS);
  var tasks = readTable_(TABLES.TASKS).sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0; });
  var byId = {};
  requests.forEach(function (r) { byId[r.requestId] = r; });
  tasks.forEach(function (t) {
    var r = byId[t.requestId] || {};
    t.event = r.title || t.requestId;
    t.tier = r.tier || r.suggestedTier || '';
    t.assigneeName = nameOf_(t.assigneeEmail, people);
    t.done = t.status === TASK.DONE;
    t.cancelled = t.status === TASK.CANCELLED;
    delete t._row;
  });
  return { settings: settings, people: people, user: user, requests: requests, tasks: tasks };
}

function clean_(o) { var c = {}; Object.keys(o).forEach(function (k) { if (k !== '_row') c[k] = o[k]; }); return c; }

function summary_(r, tasks) {
  var mine = tasks.filter(function (t) { return t.requestId === r.requestId && !t.cancelled; });
  var open = mine.filter(function (t) { return !t.done; });
  return {
    requestId: r.requestId, title: r.title, ministry: r.ministry, requester: r.requester, requesterEmail: r.requesterEmail,
    eventDate: r.eventDate, tier: r.tier || r.suggestedTier, tierIsFinal: !!r.tier, mode: r.mode, status: r.status, flags: r.flags,
    requestType: r.requestType, needsDesign: r.needsDesign, designItems: r.designItems, designState: r.designState,
    designRound: r.designRound, seriesWeeks: r.seriesWeeks, requestedNewDate: r.requestedNewDate,
    tasksDone: mine.length - open.length, tasksTotal: mine.length, nextDue: open.length ? open[0].dueDate : ''
  };
}

function isActive_(r) {
  return [STATUS.DONE, STATUS.CANCELLED, STATUS.DECLINED].indexOf(r.status) < 0;
}

/* ---------------- read API ---------------- */

function apiBootstrap() {
  var d = load_();
  var s = d.settings;
  return {
    user: d.user,
    today: todayIso_(),
    tiers: TIERS,
    tierInfo: TIER_INFO,
    designerTiers: splitList_(s['Designer handles']),
    sprintCap: Number(s['Sprint cap per year']) || 0,
    includedRounds: Number(s['Included revision rounds']) || 0,
    designerName: (roleHolder_(ROLES.DESIGNER, d.people) || {}).name || 'Designer',
    ministries: splitList_(s['Ministries']),
    forms: { request: formWithMinistries_(s), feedback: FORMS.feedback, change: FORMS.change },
    people: d.user.isAdmin ? d.people.map(clean_) : [],
    myOpenTasks: d.tasks.filter(function (t) { return t.assigneeEmail === d.user.email && t.status === TASK.OPEN; }).length
  };
}

/** First-time visitors tell us their name (and ministry). */
function apiSetMyProfile(name, ministry) {
  var user = currentUser_();
  name = String(name || '').trim().slice(0, 100);
  if (name.length < 2) throw new Error('Please enter your name.');
  return withLock_(function () {
    var p = readTable_(TABLES.PEOPLE).filter(function (x) { return lc_(x.email) === user.email; })[0];
    if (p) { p.name = name; p.ministry = String(ministry || p.ministry || ''); updateRow_(TABLES.PEOPLE, p); }
    else appendRows_(TABLES.PEOPLE, [{ email: user.email, name: name, role: ROLES.STAFF, ministry: String(ministry || ''), active: 'Yes' }]);
    return currentUser_();
  });
}

function apiHome() {
  var d = load_();
  var today = todayIso_();
  var in7 = addDaysIso(today, 7);
  var year = today.slice(0, 4);
  var open = d.tasks.filter(function (t) { return t.status === TASK.OPEN; });
  return {
    stats: {
      needsReview: d.requests.filter(function (r) { return r.status === STATUS.NEEDS_REVIEW; }).length,
      overdue: open.filter(function (t) { return t.dueDate < today; }).length,
      dueSoon: open.filter(function (t) { return t.dueDate >= today && t.dueDate <= in7; }).length,
      designerOpen: open.filter(function (t) { return t.owner === 'Designer'; }).length,
      sprints: d.requests.filter(function (r) { return r.tier === 'Level 1' && r.eventDate.slice(0, 4) === year && [STATUS.PLANNED, STATUS.DONE].indexOf(r.status) >= 0; }).length,
      sprintCap: Number(d.settings['Sprint cap per year']) || 0
    },
    myTasks: open.filter(function (t) { return t.assigneeEmail === d.user.email; }).slice(0, 8),
    myRequests: d.requests.filter(function (r) { return r.requesterEmail === d.user.email && isActive_(r); }).map(function (r) { return summary_(r, d.tasks); }),
    actionNeeded: d.requests.filter(function (r) {
      if (!isActive_(r)) return false;
      var mine = r.requesterEmail === d.user.email;
      return (mine && (r.designState === DESIGN.IN_REVIEW || r.status === STATUS.NEEDS_INFO)) ||
        (d.user.isAdmin && (r.status === STATUS.NEEDS_REVIEW || !!r.requestedNewDate || r.designState === DESIGN.HELD));
    }).map(function (r) { return summary_(r, d.tasks); })
  };
}

function apiMyTasks() {
  var d = load_();
  return d.tasks.filter(function (t) { return t.assigneeEmail === d.user.email && !t.cancelled; });
}

function apiRequests(scope) {
  var d = load_();
  var list = d.requests;
  if (scope === 'mine') list = list.filter(function (r) { return r.requesterEmail === d.user.email; });
  return list.map(function (r) { return summary_(r, d.tasks); })
    .sort(function (a, b) { return a.eventDate < b.eventDate ? 1 : -1; });
}

function apiRequestDetail(requestId) {
  var d = load_();
  var r = d.requests.filter(function (x) { return x.requestId === requestId; })[0];
  if (!r) throw new Error('Request ' + requestId + ' was not found.');
  var mine = r.requesterEmail === d.user.email;
  var designing = d.user.isAdmin || d.user.isDesigner;
  return {
    request: clean_(r),
    tasks: d.tasks.filter(function (t) { return t.requestId === requestId; }),
    activity: readTable_(TABLES.ACTIVITY).filter(function (a) { return a.requestId === requestId; }).map(function (a) {
      var c = clean_(a); c.byName = a.by ? nameOf_(a.by, d.people) : ''; return c;
    }),
    designerName: designerFor_(r, d.settings, d.people).name,
    can: {
      review: d.user.isAdmin && [STATUS.NEEDS_REVIEW, STATUS.NEEDS_INFO].indexOf(r.status) >= 0,
      admin: d.user.isAdmin,
      decideDesign: (mine || d.user.isAdmin) && r.designState === DESIGN.IN_REVIEW,
      deliver: designing && r.status === STATUS.PLANNED && /^yes/i.test(r.needsDesign),
      addFiles: mine || designing,
      change: (mine || d.user.isAdmin) && isActive_(r),
      results: (mine || d.user.isAdmin) && [STATUS.PLANNED, STATUS.DONE].indexOf(r.status) >= 0,
      releaseHeld: d.user.isAdmin && r.designState === DESIGN.HELD,
      applyDate: d.user.isAdmin && !!r.requestedNewDate,
      editTasks: d.user.isAdmin
    }
  };
}

function apiTeamTimeline() {
  return load_().tasks.filter(function (t) { return t.status === TASK.OPEN; });
}

function apiDesignQueue() {
  var d = load_();
  var designerTiers = splitList_(d.settings['Designer handles']).map(lc_);
  return d.requests.filter(function (r) {
    return isActive_(r) && /^yes/i.test(r.needsDesign) && [DESIGN.APPROVED, DESIGN.DELIVERED].indexOf(r.designState) < 0;
  }).map(function (r) {
    var s = summary_(r, d.tasks);
    s.handledBy = designerTiers.indexOf(lc_(r.tier || r.suggestedTier)) >= 0 ? 'designer' : 'in-house';
    s.designTasks = d.tasks.filter(function (t) { return t.requestId === r.requestId && t.status === TASK.OPEN && t.channel === 'Design'; });
    return s;
  }).sort(function (a, b) { return a.eventDate < b.eventDate ? -1 : 1; });
}

/** Requests touching a month (YYYY-MM), including Level 1 sprint windows. */
function apiCalendar(month) {
  var d = load_();
  if (!/^\d{4}-\d{2}$/.test(String(month))) month = todayIso_().slice(0, 7);
  return d.requests.filter(function (r) {
    return r.eventDate && [STATUS.CANCELLED, STATUS.DECLINED].indexOf(r.status) < 0;
  }).map(function (r) {
    var tier = r.tier || r.suggestedTier;
    var end = tier === 'Series' ? addDaysIso(r.eventDate, 7 * ((parseInt(r.seriesWeeks, 10) || 1) - 1)) : r.eventDate;
    return {
      requestId: r.requestId, title: r.title, tier: tier, status: r.status, start: r.eventDate, end: end,
      sprintStart: tier === 'Level 1' ? addDaysIso(r.eventDate, -14) : '', pending: !r.tier
    };
  }).filter(function (e) {
    return (e.sprintStart || e.start).slice(0, 7) <= month && e.end.slice(0, 7) >= month;
  });
}

/* ---------------- admin ---------------- */

function apiAdminData() {
  var user = currentUser_();
  assertAdmin_(user);
  var values = sheet_(TABLES.SETTINGS).getDataRange().getValues().slice(1).map(function (r) {
    return { key: String(r[0]), value: String(r[1]), help: String(r[2] || '') };
  }).filter(function (x) { return x.key; });
  return {
    settings: values,
    people: readTable_(TABLES.PEOPLE).map(clean_),
    roles: [ROLES.ADMIN, ROLES.DESIGNER, ROLES.PASTOR, ROLES.STAFF],
    dataUrl: db_().getUrl()
  };
}

function apiSaveSettings(changes) {
  var user = currentUser_();
  assertAdmin_(user);
  var allowed = {};
  sheet_(TABLES.SETTINGS).getDataRange().getValues().slice(1).forEach(function (r) { allowed[String(r[0])] = true; });
  var c = {};
  Object.keys(changes || {}).forEach(function (k) { if (allowed[k]) c[k] = String(changes[k]).slice(0, 2000); });
  withLock_(function () { writeSettings_(c); });
  return { ok: true };
}

function apiSavePerson(p) {
  var user = currentUser_();
  assertAdmin_(user);
  var email = lc_(p && p.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email address.');
  if ([ROLES.ADMIN, ROLES.DESIGNER, ROLES.PASTOR, ROLES.STAFF].indexOf(p.role) < 0) throw new Error('Choose a role.');
  if (email === user.email && p.role !== ROLES.ADMIN) throw new Error('You cannot remove your own admin role.');
  return withLock_(function () {
    var existing = readTable_(TABLES.PEOPLE).filter(function (x) { return lc_(x.email) === email; })[0];
    var rec = existing || { email: email };
    rec.name = String(p.name || '').trim().slice(0, 100) || email.split('@')[0];
    rec.role = p.role;
    rec.ministry = String(p.ministry || '').slice(0, 100);
    rec.active = p.active === 'No' ? 'No' : 'Yes';
    if (existing) updateRow_(TABLES.PEOPLE, rec); else appendRows_(TABLES.PEOPLE, [rec]);
    return { ok: true };
  });
}

/* ---------------- what the page may call (through call()) ---------------- */

/** Built on demand: files load in order, so a top-level map could miss later files. */
function apiMap_() {
  return {
    apiBootstrap: apiBootstrap, apiSetMyProfile: apiSetMyProfile, apiHome: apiHome, apiMyTasks: apiMyTasks,
    apiRequests: apiRequests, apiRequestDetail: apiRequestDetail, apiTeamTimeline: apiTeamTimeline,
    apiDesignQueue: apiDesignQueue, apiCalendar: apiCalendar, apiAdminData: apiAdminData,
    apiSaveSettings: apiSaveSettings, apiSavePerson: apiSavePerson,
    apiSubmitRequest: apiSubmitRequest, apiReview: apiReview, apiRequestChange: apiRequestChange,
    apiApplyNewDate: apiApplyNewDate, apiSaveResults: apiSaveResults, apiSetStatus: apiSetStatus,
    apiSetTaskDone: apiSetTaskDone, apiReassignTask: apiReassignTask,
    apiUploadFiles: apiUploadFiles, apiApproveDesign: apiApproveDesign, apiDesignFeedback: apiDesignFeedback,
    apiReleaseHeldFeedback: apiReleaseHeldFeedback, apiSignOut: apiSignOut
  };
}
