/**
 * Requests.gs — submitting, reviewing, changing and closing requests.
 */

var KIND_TO_TYPE = [
  [/^promoting/i, 'Promotion', 'promo'],
  [/^sermon series/i, 'Series', 'series'],
  [/^graphic design only/i, 'Design', 'design']
];

/* ---------------- validation (shared by every form) ---------------- */

function validateAnswers_(def, answers) {
  var path = visibleSections(def.sections, answers);
  if (!path.complete) throw new Error('Please answer every question that decides what comes next.');
  var clean = {};
  var missing = [];
  path.indexes.forEach(function (i) {
    def.sections[i].items.forEach(function (it) {
      var v = answers[it.id];
      if (Array.isArray(v)) v = v.map(String).filter(String);
      else if (v !== undefined && v !== null) v = String(v).trim();
      var empty = v === undefined || v === null || (Array.isArray(v) ? !v.length : v === '');
      if (empty) { if (it.required) missing.push(it.title); return; }
      if (it.choices) {
        (Array.isArray(v) ? v : [v]).forEach(function (x) {
          var ok = it.choices.some(function (c) { return c.value === x; });
          if (!ok) throw new Error('"' + x + '" is not an option for "' + it.title + '".');
        });
      }
      if (it.kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('"' + it.title + '" needs a date.');
      clean[it.id] = Array.isArray(v) ? v : String(v).slice(0, it.kind === 'paragraph' ? 20000 : 500);
    });
  });
  if (missing.length) throw new Error('Please fill in: ' + missing.join('; '));
  return clean;
}

function formWithMinistries_(settings) {
  var def = JSON.parse(JSON.stringify(FORMS.request));
  var ministries = splitList_(settings['Ministries']);
  if (ministries.length) {
    def.sections[0].items.forEach(function (it) { if (it.id === 'ministry') it.choices = ministries.map(function (m) { return { value: m }; }); });
  }
  return def;
}

/* ---------------- submit ---------------- */

function apiSubmitRequest(answers, files) {
  var settings = readSettings_();
  var people = readPeople_();
  var user = currentUser_(people);
  if (!user.known) throw new Error('Please tell us your name first (shown at the top of the New Request page).');
  var clean = validateAnswers_(formWithMinistries_(settings), answers || {});

  var kind = KIND_TO_TYPE.filter(function (k) { return k[0].test(clean.kind); })[0];
  if (!kind) throw new Error('Choose what you need.');
  var req = { requestType: kind[1] };
  Object.keys(clean).forEach(function (id) {
    var parts = id.split('.');
    if (parts.length === 2 && parts[0] !== kind[2]) return;
    var v = clean[id];
    req[parts[parts.length - 1]] = Array.isArray(v) ? v.join(', ') : v;
  });
  if (req.requestType !== 'Promotion') req.needsDesign = 'Yes';
  if (req.requestType === 'Series') {
    var w = parseInt(req.seriesWeeks, 10);
    if (!(w >= 1 && w <= 52)) throw new Error('"Number of weeks" should be a number between 1 and 52.');
    req.seriesWeeks = String(w);
    req.ministry = req.ministry || 'Sermon Series';
  }
  if (req.requestType === 'Design') req.whoFor = req.whoFor || '';

  var today = todayIso_();
  if (req.eventDate < today) throw new Error('That date has already passed.');

  var saved = withLock_(function () {
    var all = readTable_(TABLES.REQUESTS);
    req.requestId = nextRequestId_(all, today);
    req.submitted = nowText_();
    req.requester = user.name;
    req.requesterEmail = user.email;
    req.suggestedTier = suggestTier(req);
    req.tier = '';
    req.mode = modeFor(req.suggestedTier);
    req.status = STATUS.NEEDS_REVIEW;
    req.flags = runwayFlag(req.suggestedTier, today, req.eventDate);
    req.designRound = '0';
    req.updatedAt = req.submitted;
    appendRows_(TABLES.REQUESTS, [req]);
    logActivity_(req.requestId, user.email, 'Submitted', req.requestType + ' request submitted.');
    return req;
  });

  var warnings = [];
  try {
    var folder = ensureRequestFolder_(saved, settings, people);
    if (folder) {
      saved = findRequest_(saved.requestId);
      if (files && files.length) {
        saveFiles_(folder, files);
        logActivity_(saved.requestId, user.email, 'Files', files.length + ' file(s) attached.', folder.getUrl());
      }
    }
  } catch (e) { warnings.push('Files: ' + e.message); }
  try { notifySubmitted_(saved, settings, people); } catch (e) { warnings.push('Email: ' + e.message); }
  return { requestId: saved.requestId, warnings: warnings };
}

function nextRequestId_(all, today) {
  var prefix = 'REQ-' + today.slice(0, 4) + '-';
  var max = 0;
  all.forEach(function (r) { if (r.requestId.indexOf(prefix) === 0) max = Math.max(max, parseInt(r.requestId.slice(prefix.length), 10) || 0); });
  return prefix + ('00' + (max + 1)).slice(-3);
}

function findRequest_(requestId) {
  var r = readTable_(TABLES.REQUESTS).filter(function (x) { return x.requestId === requestId; })[0];
  if (!r) throw new Error('Request ' + requestId + ' was not found.');
  return r;
}

function saveRequest_(r) {
  r.updatedAt = nowText_();
  updateRow_(TABLES.REQUESTS, r);
}

function assertAdmin_(user) {
  if (!user.isAdmin) throw new Error('Only the communications team can do that.');
}

function assertOwnerOrAdmin_(user, r) {
  if (!user.isAdmin && lc_(r.requesterEmail) !== user.email) {
    throw new Error('Only the person who submitted this request (or the communications team) can do that.');
  }
}

/* ---------------- review (admin) ---------------- */

/**
 * decision: { action: 'approve' | 'needsInfo' | 'decline', tier, message, overrideCap }
 */
function apiReview(requestId, decision) {
  var settings = readSettings_();
  var people = readPeople_();
  var user = currentUser_(people);
  assertAdmin_(user);
  decision = decision || {};
  var message = String(decision.message || '').trim().slice(0, 5000);

  var r = withLock_(function () {
    var r = findRequest_(requestId);
    if (r.status === STATUS.PLANNED || r.status === STATUS.DONE) throw new Error('This request has already been approved.');
    if (decision.action === 'needsInfo') {
      if (!message) throw new Error('Tell the requester what information you need.');
      r.status = STATUS.NEEDS_INFO;
    } else if (decision.action === 'decline') {
      r.status = STATUS.DECLINED;
    } else if (decision.action === 'approve') {
      var tier = TIERS.indexOf(decision.tier) >= 0 ? decision.tier : r.suggestedTier;
      if (tier === 'Level 1' && !decision.overrideCap) {
        var cap = Number(settings['Sprint cap per year']) || 0;
        var used = readTable_(TABLES.REQUESTS).filter(function (x) {
          return x.tier === 'Level 1' && x.eventDate.slice(0, 4) === r.eventDate.slice(0, 4) &&
            [STATUS.PLANNED, STATUS.DONE].indexOf(x.status) >= 0 && x.requestId !== r.requestId;
        }).length;
        if (cap && used >= cap) {
          throw new Error('CAP: ' + used + ' of ' + cap + ' Level 1 Sprints are already planned for ' + r.eventDate.slice(0, 4) + '. Approve anyway?');
        }
      }
      approve_(r, tier, settings, people, user);
    } else {
      throw new Error('Unknown review action.');
    }
    r.messageToRequester = message || r.messageToRequester;
    saveRequest_(r);
    logActivity_(r.requestId, user.email, 'Review', r.status + (r.tier ? ' as ' + r.tier : '') + (message ? ': ' + message : ''));
    return r;
  });

  try {
    if (r.status === STATUS.PLANNED) {
      syncCalendar_(r, settings);
      saveRequest_(r);
    } else if (r.status === STATUS.DECLINED) {
      removeCalendar_(r, settings);
    }
  } catch (e) { console.warn('Calendar: ' + e.message); }
  try { notifyReviewed_(r, settings, people); } catch (e) { console.warn('Email: ' + e.message); }
  return { status: r.status };
}

function approve_(r, tier, settings, people, user) {
  var today = todayIso_();
  r.tier = tier;
  r.mode = modeFor(tier);
  r.flags = runwayFlag(tier, today, r.eventDate);
  r.status = STATUS.PLANNED;
  r.approvedAt = nowText_();

  var designerTiers = splitList_(settings['Designer handles']);
  var plan = buildPlan(r, { today: today, designerTiers: designerTiers });
  var existing = readTable_(TABLES.TASKS).filter(function (t) { return t.requestId === r.requestId; }).length;
  var tasks = plan.map(function (p, i) {
    return {
      taskKey: r.requestId + '-' + ('0' + (existing + i + 1)).slice(-2),
      requestId: r.requestId, dueDate: p.dueDate, channel: p.channel, task: p.task, owner: p.owner,
      assigneeEmail: ownerEmail_(p.owner, r, people), status: TASK.OPEN, notes: p.notes, key: p.key
    };
  });
  // The brief is emailed automatically on approval, so that step is already done.
  tasks.forEach(function (t) {
    if (t.key === 'brief') { t.status = TASK.DONE; t.completedAt = nowText_(); t.completedBy = 'app'; }
  });
  appendRows_(TABLES.TASKS, tasks);

  if (/^yes/i.test(r.needsDesign)) {
    r.designState = DESIGN.BRIEFED;
    r.designStateSince = today;
    r.designRound = r.designRound || '0';
  }
}

/* ---------------- changes from the requester ---------------- */

function apiRequestChange(requestId, answers) {
  var settings = readSettings_();
  var people = readPeople_();
  var user = currentUser_(people);
  var clean = validateAnswers_(FORMS.change, answers || {});
  var changes = [].concat(clean.changes || []);
  var cancel = changes.some(function (c) { return /^cancel/i.test(c); });
  var dateChange = changes.some(function (c) { return /date/i.test(c); });
  if (dateChange && !clean.newDate) throw new Error('Choose the new date.');

  var result = withLock_(function () {
    var r = findRequest_(requestId);
    assertOwnerOrAdmin_(user, r);
    if ([STATUS.CANCELLED, STATUS.DECLINED, STATUS.DONE].indexOf(r.status) >= 0) throw new Error('This request is closed.');
    var text = changes.join(', ') + (clean.newDate ? ' → ' + clean.newDate : '') + ': ' + clean.details;
    logActivity_(r.requestId, user.email, 'Change', text);

    var applied = false;
    if (cancel) {
      r.status = STATUS.CANCELLED;
      closeOpenTasks_(r.requestId, TASK.CANCELLED);
    } else if (dateChange) {
      if (r.status === STATUS.PLANNED) {
        r.requestedNewDate = clean.newDate; // the communications team applies it
      } else {
        r.eventDate = clean.newDate;
        r.flags = runwayFlag(r.suggestedTier, todayIso_(), r.eventDate);
        applied = true;
      }
    }
    saveRequest_(r);
    return { r: r, text: text, applied: applied };
  });

  try { if (cancel) removeCalendar_(result.r, settings); } catch (e) { console.warn(e.message); }
  try { notifyChange_(result.r, result.text, cancel, settings, people, user); } catch (e) { console.warn(e.message); }
  return { status: result.r.status, pendingDate: result.r.requestedNewDate || '' };
}

/** Admin applies a requested date change: open tasks shift by the same number of days. */
function apiApplyNewDate(requestId) {
  var settings = readSettings_();
  var people = readPeople_();
  var user = currentUser_(people);
  assertAdmin_(user);
  var r = withLock_(function () {
    var r = findRequest_(requestId);
    if (!r.requestedNewDate) throw new Error('No date change is waiting.');
    var delta = daysBetweenIso(r.eventDate, r.requestedNewDate);
    var today = todayIso_();
    readTable_(TABLES.TASKS).forEach(function (t) {
      if (t.requestId !== requestId || t.status !== TASK.OPEN) return;
      var d = addDaysIso(t.dueDate, delta);
      t.dueDate = d < today ? today : d;
      updateRow_(TABLES.TASKS, t);
    });
    logActivity_(requestId, user.email, 'Change', 'Date moved from ' + prettyIso(r.eventDate) + ' to ' + prettyIso(r.requestedNewDate) + '; open tasks shifted ' + delta + ' days.');
    r.eventDate = r.requestedNewDate;
    r.requestedNewDate = '';
    r.flags = runwayFlag(r.tier || r.suggestedTier, today, r.eventDate);
    saveRequest_(r);
    return r;
  });
  try { syncCalendar_(r, settings); saveRequest_(r); } catch (e) { console.warn(e.message); }
  try { notifyDateApplied_(r, settings, people); } catch (e) { console.warn(e.message); }
  return { eventDate: r.eventDate };
}

function closeOpenTasks_(requestId, status) {
  readTable_(TABLES.TASKS).forEach(function (t) {
    if (t.requestId === requestId && t.status === TASK.OPEN) {
      t.status = status;
      updateRow_(TABLES.TASKS, t);
    }
  });
}

/* ---------------- results & status ---------------- */

function apiSaveResults(requestId, text) {
  var user = currentUser_();
  return withLock_(function () {
    var r = findRequest_(requestId);
    assertOwnerOrAdmin_(user, r);
    r.results = String(text || '').trim().slice(0, 10000);
    saveRequest_(r);
    logActivity_(requestId, user.email, 'Results', r.results);
    readTable_(TABLES.TASKS).forEach(function (t) {
      if (t.requestId === requestId && t.key === 'results' && t.status === TASK.OPEN && r.results) completeTask_(t, user.email);
    });
    refreshRequestStatus_(requestId);
    return { ok: true };
  });
}

function apiSetStatus(requestId, status) {
  var settings = readSettings_();
  var user = currentUser_();
  assertAdmin_(user);
  if ([STATUS.DONE, STATUS.CANCELLED, STATUS.PLANNED].indexOf(status) < 0) throw new Error('Unknown status.');
  var r = withLock_(function () {
    var r = findRequest_(requestId);
    r.status = status;
    if (status === STATUS.CANCELLED) closeOpenTasks_(requestId, TASK.CANCELLED);
    saveRequest_(r);
    logActivity_(requestId, user.email, 'Status', 'Marked ' + status);
    return r;
  });
  if (status === STATUS.CANCELLED) { try { removeCalendar_(r, settings); saveRequest_(r); } catch (e) { console.warn(e.message); } }
  return { status: r.status };
}

/** A planned request whose every task is finished becomes Done. */
function refreshRequestStatus_(requestId) {
  var tasks = readTable_(TABLES.TASKS).filter(function (t) { return t.requestId === requestId; });
  if (!tasks.length) return;
  var open = tasks.some(function (t) { return t.status === TASK.OPEN; });
  var r = findRequest_(requestId);
  if (!open && r.status === STATUS.PLANNED) { r.status = STATUS.DONE; saveRequest_(r); }
  else if (open && r.status === STATUS.DONE) { r.status = STATUS.PLANNED; saveRequest_(r); }
}

/* ---------------- tasks ---------------- */

function completeTask_(t, by) {
  t.status = TASK.DONE;
  t.completedAt = nowText_();
  t.completedBy = by;
  updateRow_(TABLES.TASKS, t);
}

function apiSetTaskDone(taskKey, done) {
  var user = currentUser_();
  return withLock_(function () {
    var t = readTable_(TABLES.TASKS).filter(function (x) { return x.taskKey === taskKey; })[0];
    if (!t) throw new Error('Task not found.');
    var r = findRequest_(t.requestId);
    var allowed = user.isAdmin || lc_(t.assigneeEmail) === user.email ||
      (t.owner === 'Leader' && lc_(r.requesterEmail) === user.email);
    if (!allowed) throw new Error('Only the person assigned (or the communications team) can update this task.');
    if (t.key === 'review' && done) throw new Error('Use Approve design or Request changes on the request page.');
    if (t.status === TASK.CANCELLED) throw new Error('This task was cancelled.');
    if (done) completeTask_(t, user.email);
    else { t.status = TASK.OPEN; t.completedAt = ''; t.completedBy = ''; updateRow_(TABLES.TASKS, t); }
    refreshRequestStatus_(t.requestId);
    return { status: t.status };
  });
}

/** Admin can hand a task to someone else. */
function apiReassignTask(taskKey, email) {
  var people = readPeople_();
  var user = currentUser_(people);
  assertAdmin_(user);
  if (!personByEmail_(email, people)) throw new Error('Choose someone from the People list.');
  return withLock_(function () {
    var t = readTable_(TABLES.TASKS).filter(function (x) { return x.taskKey === taskKey; })[0];
    if (!t) throw new Error('Task not found.');
    t.assigneeEmail = lc_(email);
    updateRow_(TABLES.TASKS, t);
    return { ok: true };
  });
}
