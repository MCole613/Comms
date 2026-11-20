/**
 * Timeline.gs — pure scheduling + assignment logic.
 *
 * Nothing in this file touches Apps Script services (SpreadsheetApp, MailApp…),
 * so it can be unit tested in Node (see tests/timeline.test.js).
 */

var DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Deliverable name used for tasks that apply to every request. */
var EVERY_REQUEST = 'Every Request';

/** Special assignee keywords usable in the Task Templates sheet. */
var ASSIGNEE = {
  SUBMITTER: 'submitter',
  ASSISTANT: "submitter's assistant",
  APPROVER: "submitter's approver"
};

/** 'YYYY-MM-DD' -> local Date at midnight. */
function parseIsoDate(s) {
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || '').trim());
  if (!m) throw new Error('Invalid date "' + s + '" (expected YYYY-MM-DD)');
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Date -> 'YYYY-MM-DD' (local). */
function toIsoDate(d) {
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * "Mon, Tue, Wed, Thu" -> boolean[7] indexed by getDay().
 * Falls back to Mon–Fri when the setting is blank or unreadable.
 */
function parseWorkDays(str) {
  var flags = [false, false, false, false, false, false, false];
  String(str || '').toLowerCase().split(/[\s,;]+/).forEach(function (part) {
    var idx = DAY_NAMES.indexOf(part.slice(0, 3));
    if (idx >= 0) flags[idx] = true;
  });
  if (flags.indexOf(true) === -1) flags = [false, true, true, true, true, true, false];
  return flags;
}

function previousWorkDay(d, workDays) {
  var r = startOfDay(d);
  while (!workDays[r.getDay()]) r = addDays(r, -1);
  return r;
}

function nextWorkDay(d, workDays) {
  var r = startOfDay(d);
  while (!workDays[r.getDay()]) r = addDays(r, 1);
  return r;
}

/** Move forward n working days (n >= 0). */
function addWorkDays(d, n, workDays) {
  var r = startOfDay(d);
  var remaining = n;
  while (remaining > 0) {
    r = addDays(r, 1);
    if (workDays[r.getDay()]) remaining--;
  }
  return nextWorkDay(r, workDays);
}

/**
 * Works out the due date for every task needed by a request.
 *
 * opts = {
 *   eventDate:     'YYYY-MM-DD'  – the date everything is scheduled back from
 *   submittedDate: 'YYYY-MM-DD'  – today, when the form was submitted
 *   deliverables:  ['Graphic Design', 'Social Media', …]
 *   templates:     rows from the Task Templates sheet
 *                  {deliverable, step, task, anchor, offset, assignee, notes}
 *   workDays:      boolean[7] from parseWorkDays()
 *   minLeadDays:   number – requests with less notice than this are "rush"
 * }
 *
 * Returns { rush: bool, leadDays: n, items: [{deliverable, step, task,
 *   assignee, notes, dueDate, idealDueDate, rush}] } sorted by due date.
 */
function buildTimeline(opts) {
  var event = parseIsoDate(opts.eventDate);
  var submitted = parseIsoDate(opts.submittedDate);
  var workDays = opts.workDays || parseWorkDays('');
  var earliest = nextWorkDay(addDays(submitted, 1), workDays); // nobody gets a task due today
  var leadDays = daysBetween(submitted, event);

  var wanted = {};
  wanted[EVERY_REQUEST.toLowerCase()] = true;
  (opts.deliverables || []).forEach(function (d) { wanted[String(d).trim().toLowerCase()] = true; });

  function isFromSubmit(t) {
    return String(t.anchor || '').trim().toLowerCase().indexOf('submit') === 0;
  }
  var chosen = (opts.templates || []).filter(function (t) {
    return wanted[String(t.deliverable || '').trim().toLowerCase()];
  });

  // Short notice: squeeze the pre-event schedule proportionally into the days
  // we actually have, so steps keep their order and spacing.
  var longest = 0;
  chosen.forEach(function (t) {
    var off = Number(t.offset) || 0;
    if (!isFromSubmit(t) && off < 0) longest = Math.max(longest, -off);
  });
  var available = Math.max(daysBetween(earliest, event), 0);
  var scale = longest > available ? available / longest : 1;

  var items = [];
  chosen.forEach(function (t, order) {
    var offset = Number(t.offset) || 0;
    var ideal, due;
    if (isFromSubmit(t)) {
      ideal = due = addWorkDays(submitted, Math.max(offset, 1), workDays);
    } else if (offset > 0) {
      ideal = due = nextWorkDay(addDays(event, offset), workDays);
    } else {
      ideal = previousWorkDay(addDays(event, offset), workDays);
      due = scale < 1 ? previousWorkDay(addDays(event, -Math.round(-offset * scale)), workDays) : ideal;
    }
    if (due < earliest) due = earliest;
    var tooLate = toIsoDate(due) !== toIsoDate(ideal);
    items.push({
      deliverable: String(t.deliverable).trim(),
      step: Number(t.step) || 0,
      task: String(t.task || '').trim(),
      assignee: String(t.assignee || '').trim(),
      notes: String(t.notes || '').trim(),
      idealDueDate: toIsoDate(ideal),
      dueDate: toIsoDate(due),
      rush: tooLate,
      _order: order
    });
  });

  // When compressed, keep at least one work day between consecutive steps of a
  // deliverable (e.g. the leader can't review a draft the day it's started).
  if (scale < 1) {
    var lastBeforeEvent = toIsoDate(previousWorkDay(addDays(event, -1), workDays));
    var byDeliverable = {};
    items.forEach(function (i) {
      if (i.deliverable.toLowerCase() !== EVERY_REQUEST.toLowerCase()) {
        (byDeliverable[i.deliverable] = byDeliverable[i.deliverable] || []).push(i);
      }
    });
    Object.keys(byDeliverable).forEach(function (k) {
      var steps = byDeliverable[k].sort(function (a, b) { return a.step - b.step; });
      for (var s = 1; s < steps.length; s++) {
        if (steps[s].dueDate > lastBeforeEvent || steps[s].dueDate > steps[s - 1].dueDate) continue;
        var bumped = toIsoDate(nextWorkDay(addDays(parseIsoDate(steps[s - 1].dueDate), 1), workDays));
        if (bumped <= lastBeforeEvent) {
          steps[s].dueDate = bumped;
          steps[s].rush = true;
        }
      }
    });
  }

  items.sort(function (a, b) {
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    return a._order - b._order;
  });
  items.forEach(function (i) { delete i._order; });

  var anyLate = items.some(function (i) { return i.rush; });
  return {
    rush: anyLate || leadDays < (Number(opts.minLeadDays) || 0),
    leadDays: leadDays,
    items: items
  };
}

/**
 * Decides who owns a task.
 *
 *   key        – the Assignee column from the template ("Submitter", "Designer", …)
 *   submitter  – team record of the person who filled out the form
 *                {email, name, assistantEmail, approverEmail} (may be partial)
 *   team       – all active team records {email, name, role}
 *   openCounts – {email: number of open tasks} for load balancing
 *   fallback   – {email, name} used when nobody holds a role
 *   cache      – per-request object so every "Designer" task on one request
 *                lands with the same designer
 *
 * Returns {email, name, role} or null when the task should be skipped
 * (e.g. approval step for someone with no approver).
 */
function resolveAssignee(key, submitter, team, openCounts, fallback, cache) {
  var k = String(key || '').trim().toLowerCase();
  cache = cache || {};
  if (cache[k]) return cache[k];

  function byEmail(email) {
    var e = String(email || '').trim().toLowerCase();
    if (!e) return null;
    for (var i = 0; i < team.length; i++) {
      if (String(team[i].email).toLowerCase() === e) return team[i];
    }
    return { email: e, name: e };
  }

  var result = null;
  if (k === ASSIGNEE.SUBMITTER || k === '') {
    result = { email: submitter.email, name: submitter.name || submitter.email, role: 'Submitter' };
  } else if (k === ASSIGNEE.ASSISTANT) {
    var a = byEmail(submitter.assistantEmail);
    result = a ? { email: a.email, name: a.name, role: "Submitter's Assistant" }
               : { email: submitter.email, name: submitter.name || submitter.email, role: 'Submitter' };
  } else if (k === ASSIGNEE.APPROVER) {
    var ap = byEmail(submitter.approverEmail);
    if (!ap || String(ap.email).toLowerCase() === String(submitter.email).toLowerCase()) return null;
    result = { email: ap.email, name: ap.name, role: "Submitter's Approver" };
  } else {
    var holders = team.filter(function (p) { return String(p.role || '').trim().toLowerCase() === k; });
    if (holders.length) {
      var counts = openCounts || {};
      holders.sort(function (x, y) {
        return (counts[String(x.email).toLowerCase()] || 0) - (counts[String(y.email).toLowerCase()] || 0);
      });
      result = { email: holders[0].email, name: holders[0].name, role: holders[0].role };
    } else if (fallback && fallback.email) {
      result = { email: fallback.email, name: fallback.name || fallback.email, role: String(key).trim() + ' (unfilled)' };
    } else {
      result = { email: submitter.email, name: submitter.name || submitter.email, role: String(key).trim() + ' (unfilled)' };
    }
  }
  cache[k] = result;
  return result;
}

// Allow Node tests to require this file; Apps Script ignores it.
if (typeof module !== 'undefined') {
  module.exports = {
    parseIsoDate: parseIsoDate, toIsoDate: toIsoDate, parseWorkDays: parseWorkDays,
    addWorkDays: addWorkDays, buildTimeline: buildTimeline, resolveAssignee: resolveAssignee,
    EVERY_REQUEST: EVERY_REQUEST
  };
}
