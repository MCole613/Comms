/**
 * Design.gs — files and the design review process.
 *
 * Briefed → (draft uploaded) In Review → Approved → (finals uploaded) Delivered
 *                     ↑            ↓ changes requested
 *                     └─ Revising ←┘   (beyond the included rounds → Feedback Held
 *                                        until the communications team releases it)
 */

/* ---------------- Drive folders ---------------- */

function folderIdFromUrl_(url) {
  var m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(String(url || '')) || /[?&]id=([A-Za-z0-9_-]{10,})/.exec(String(url || ''));
  return m ? m[1] : '';
}

/** Returns the request's Drive folder, creating it (and saving the link) if needed. */
function ensureRequestFolder_(r, settings, people) {
  if (r.designFolder) return DriveApp.getFolderById(folderIdFromUrl_(r.designFolder));
  var parentId = folderIdFromUrl_(settings['Drive parent folder']);
  var parent = parentId ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder();
  var folder = parent.createFolder(r.requestId + ' — ' + String(r.title || '').slice(0, 80));
  try { folder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* not a Workspace account */ }
  emailsWithRole_(ROLES.DESIGNER, people).forEach(function (e) {
    try { folder.addEditor(e); } catch (err) { console.warn('Share with ' + e + ': ' + err.message); }
  });
  withLock_(function () {
    var fresh = findRequest_(r.requestId);
    fresh.designFolder = folder.getUrl();
    saveRequest_(fresh);
  });
  r.designFolder = folder.getUrl();
  return folder;
}

function saveFiles_(folder, files) {
  if (files.length > 15) throw new Error('Please upload 15 files or fewer at a time.');
  return files.map(function (f) {
    var bytes = Utilities.base64Decode(String(f.data || ''));
    if (bytes.length > MAX_FILE_BYTES) throw new Error('"' + f.name + '" is larger than 10 MB. Put it in the Drive folder directly.');
    var file = folder.createFile(Utilities.newBlob(bytes, f.mimeType || 'application/octet-stream', String(f.name || 'upload').slice(0, 200)));
    return { name: file.getName(), url: file.getUrl() };
  });
}

/* ---------------- helpers ---------------- */

function designerFor_(r, settings, people) {
  var byDesigner = splitList_(settings['Designer handles']).map(lc_).indexOf(lc_(r.tier || r.suggestedTier)) >= 0;
  var holder = roleHolder_(byDesigner ? ROLES.DESIGNER : ROLES.ADMIN, people) || roleHolder_(ROLES.ADMIN, people);
  return { email: holder ? holder.email : '', name: holder ? holder.name : '', owner: byDesigner ? 'Designer' : 'Comms' };
}

function canDesign_(user, r, settings, people) {
  return user.isAdmin || user.isDesigner;
}

function tasksFor_(requestId) {
  return readTable_(TABLES.TASKS).filter(function (t) { return t.requestId === requestId; });
}

function addTask_(r, fields) {
  var n = tasksFor_(r.requestId).length + 1;
  var t = {
    taskKey: r.requestId + '-' + (fields.suffix || ('X' + n)),
    requestId: r.requestId, status: TASK.OPEN, notes: '', channel: 'Design'
  };
  Object.keys(fields).forEach(function (k) { if (k !== 'suffix') t[k] = fields[k]; });
  appendRows_(TABLES.TASKS, [t]);
  return t;
}

function setDesignState_(r, state) {
  r.designState = state;
  r.designStateSince = todayIso_();
}

/* ---------------- uploads ---------------- */

/**
 * stage: 'draft' (ready for the requester to review), 'final' (finished files)
 *        or 'file' (just add files to the folder).
 */
function apiUploadFiles(requestId, files, stage) {
  var settings = readSettings_();
  var people = readPeople_();
  var user = currentUser_(people);
  var r = findRequest_(requestId);
  var designing = canDesign_(user, r, settings, people);
  var owns = lc_(r.requesterEmail) === user.email;
  if (!designing && !owns) throw new Error('Only the requester, the designer or the communications team can add files.');
  if ((stage === 'draft' || stage === 'final') && !designing) throw new Error('Only the designer or the communications team can deliver designs.');
  if (!files || !files.length) throw new Error('Choose at least one file.');

  var folder = ensureRequestFolder_(r, settings, people);
  var saved = saveFiles_(folder, files);
  var names = saved.map(function (f) { return f.name; }).join(', ');
  var today = todayIso_();
  var reviewDays = Number(settings['Review window days']) || 3;

  var out = withLock_(function () {
    var r = findRequest_(requestId);
    var tasks = tasksFor_(requestId);
    var round = Number(r.designRound) || 0;
    var review = null;

    if (stage === 'draft') {
      // Close the step that produced this draft.
      tasks.forEach(function (t) {
        if (t.status !== TASK.OPEN) return;
        if ((round === 0 && t.key === 'draft') || (round > 0 && t.key === 'revision')) completeTask_(t, user.email);
      });
      // Open (or re-date) the requester's review step.
      if (round === 0) {
        review = tasks.filter(function (t) { return t.key === 'review' && t.status === TASK.OPEN; })[0];
      }
      if (review) {
        review.dueDate = addDaysIso(today, reviewDays);
        updateRow_(TABLES.TASKS, review);
      } else {
        review = addTask_(r, {
          suffix: 'V' + round, dueDate: addDaysIso(today, reviewDays), owner: 'Leader', key: 'review',
          assigneeEmail: lc_(r.requesterEmail),
          task: round === 0 ? 'Review the first draft: approve or request changes' : 'Review the Round ' + round + ' update: approve or request changes'
        });
      }
      setDesignState_(r, DESIGN.IN_REVIEW);
    } else if (stage === 'final') {
      tasks.forEach(function (t) { if (t.status === TASK.OPEN && t.key === 'final') completeTask_(t, user.email); });
      setDesignState_(r, DESIGN.DELIVERED);
    }
    saveRequest_(r);
    logActivity_(requestId, user.email, stage === 'draft' ? 'Draft' : stage === 'final' ? 'Final files' : 'Files',
      (stage === 'draft' ? (round ? 'Round ' + round + ' update' : 'First draft') + ' uploaded: ' : stage === 'final' ? 'Final files delivered: ' : 'Added: ') + names,
      folder.getUrl());
    refreshRequestStatus_(requestId);
    return { r: r, review: review };
  });

  try {
    if (stage === 'draft') notifyDraftReady_(out.r, out.review, settings, people);
    if (stage === 'final') notifyFinalDelivered_(out.r, settings, people);
  } catch (e) { console.warn('Email: ' + e.message); }
  return { count: saved.length, designState: out.r.designState };
}

/* ---------------- requester decisions ---------------- */

function apiApproveDesign(requestId) {
  var settings = readSettings_();
  var people = readPeople_();
  var user = currentUser_(people);
  var r = withLock_(function () {
    var r = findRequest_(requestId);
    assertOwnerOrAdmin_(user, r);
    if (r.designState !== DESIGN.IN_REVIEW) throw new Error('There is no draft waiting for review.');
    tasksFor_(requestId).forEach(function (t) {
      if (t.status === TASK.OPEN && (t.key === 'review' || t.key === 'checkin')) completeTask_(t, user.email);
    });
    setDesignState_(r, DESIGN.APPROVED);
    saveRequest_(r);
    logActivity_(requestId, user.email, 'Approved', 'Design approved' + ((Number(r.designRound) || 0) ? ' after Round ' + r.designRound : '') + '.');
    refreshRequestStatus_(requestId);
    return r;
  });
  try { notifyDesignApproved_(r, settings, people, user); } catch (e) { console.warn('Email: ' + e.message); }
  return { designState: r.designState };
}

function apiDesignFeedback(requestId, answers, files) {
  var settings = readSettings_();
  var people = readPeople_();
  var user = currentUser_(people);
  var clean = validateAnswers_(FORMS.feedback, answers || {});
  var r0 = findRequest_(requestId);
  assertOwnerOrAdmin_(user, r0);
  if (r0.designState !== DESIGN.IN_REVIEW) throw new Error('Feedback can be sent when a draft is waiting for your review.');

  var link = '';
  if (files && files.length) {
    var folder = ensureRequestFolder_(r0, settings, people);
    saveFiles_(folder, files);
    link = folder.getUrl();
  }
  var text = '[' + clean.kind + '] ' + clean.text + (link ? '\nFiles: ' + link : '');
  var included = Number(settings['Included revision rounds']) || 0;

  var out = withLock_(function () {
    var r = findRequest_(requestId);
    tasksFor_(requestId).forEach(function (t) { if (t.status === TASK.OPEN && t.key === 'review') completeTask_(t, user.email); });
    var next = (Number(r.designRound) || 0) + 1;
    var held = included && next > included;
    logActivity_(requestId, user.email, 'Feedback', 'Round ' + next + (held ? ' (held — over ' + included + ' included rounds)' : '') + ': ' + text, link);
    var task = null;
    if (held) {
      r.heldFeedback = text;
      setDesignState_(r, DESIGN.HELD);
    } else {
      task = startRound_(r, next, text, settings, people);
    }
    saveRequest_(r);
    return { r: r, held: held, task: task, text: text };
  });

  try { notifyFeedback_(out.r, out.text, out.held, settings, people, user); } catch (e) { console.warn('Email: ' + e.message); }
  return { held: out.held, designState: out.r.designState, round: out.r.designRound };
}

function startRound_(r, round, text, settings, people) {
  var d = designerFor_(r, settings, people);
  var turnaround = Number(settings['Revision turnaround days']) || 3;
  r.designRound = String(round);
  r.heldFeedback = '';
  setDesignState_(r, DESIGN.REVISING);
  return addTask_(r, {
    suffix: 'R' + round, dueDate: addDaysIso(todayIso_(), turnaround), owner: d.owner, key: 'revision',
    assigneeEmail: d.email, task: 'Round ' + round + ' revisions: ' + String(text).replace(/^\[[^\]]*\]\s*/, '').slice(0, 80)
  });
}

/** Admin decides on feedback beyond the included rounds. */
function apiReleaseHeldFeedback(requestId, allow, note) {
  var settings = readSettings_();
  var people = readPeople_();
  var user = currentUser_(people);
  assertAdmin_(user);
  var out = withLock_(function () {
    var r = findRequest_(requestId);
    if (r.designState !== DESIGN.HELD) throw new Error('No feedback is being held.');
    var text = r.heldFeedback;
    if (allow) {
      startRound_(r, (Number(r.designRound) || 0) + 1, text, settings, people);
    } else {
      r.heldFeedback = '';
      setDesignState_(r, DESIGN.IN_REVIEW);
      r.messageToRequester = String(note || 'We have used the included design rounds for this request. Please approve the current version or talk with the communications team.');
      addTask_(r, { suffix: 'V' + r.designRound + 'b', dueDate: addDaysIso(todayIso_(), 3), owner: 'Leader', key: 'review',
        assigneeEmail: lc_(r.requesterEmail), task: 'Approve the current design (extra rounds were not approved)' });
    }
    saveRequest_(r);
    logActivity_(requestId, user.email, 'Feedback', allow ? 'Extra round approved.' : 'Extra round declined. ' + (note || ''));
    return { r: r, text: text };
  });
  try {
    if (allow) notifyFeedback_(out.r, out.text, false, settings, people, user);
    else notifyMessage_(out.r, settings, people);
  } catch (e) { console.warn('Email: ' + e.message); }
  return { designState: out.r.designState };
}
