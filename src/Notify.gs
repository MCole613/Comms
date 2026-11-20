/**
 * Notify.gs — every email the app sends, in your brand colors.
 */

function esc_(s) {
  return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escBr_(s) { return esc_(s).replace(/\n/g, '<br>'); }

function appLink_(requestId) {
  var url = ScriptApp.getService().getUrl() || '';
  return url && requestId ? url + '?request=' + encodeURIComponent(requestId) : url;
}

function isRealEmail_(e) { return /@/.test(e || '') && !/@example\./i.test(e); }

function send_(settings, opts) {
  var to = [].concat(opts.to || []).map(lc_).filter(isRealEmail_);
  to = to.filter(function (e, i) { return to.indexOf(e) === i; });
  if (!to.length) return;
  var cc = [].concat(opts.cc || []).map(lc_).filter(function (e) { return isRealEmail_(e) && to.indexOf(e) < 0; });
  var msg = {
    to: to.join(','), subject: opts.subject, name: settings['Brand header text'] || 'Communications',
    htmlBody: wrapEmail_(opts.html, settings)
  };
  if (cc.length) msg.cc = cc.join(',');
  if (opts.replyTo && isRealEmail_(opts.replyTo)) msg.replyTo = opts.replyTo;
  MailApp.sendEmail(msg);
}

function color_(v, fallback) { return /^#[0-9a-f]{3,8}$/i.test(String(v || '').trim()) ? String(v).trim() : fallback; }

function wrapEmail_(inner, s) {
  var head = color_(s['Brand header color'], '#00b5e2');
  var headInk = color_(s['Brand header text color'], '#ffffff');
  return '<div style="font-family:Georgia,serif;font-size:15px;color:#1d2733;max-width:640px">' +
    '<div style="background:' + head + ';color:' + headInk + ';padding:16px 20px;border-radius:8px 8px 0 0;font:700 17px Helvetica,Arial,sans-serif">' +
    esc_(s['Brand header text'] || 'Communications') + '</div>' +
    '<div style="border:1px solid #dfe4ea;border-top:0;padding:20px;border-radius:0 0 8px 8px">' + inner + '</div>' +
    (s['Brand footer text'] ? '<p style="font-size:12px;color:#66727f;text-align:center">' + esc_(s['Brand footer text']) + '</p>' : '') + '</div>';
}

function button_(href, label, s) {
  if (!href) return '';
  return '<p style="margin:20px 0"><a href="' + esc_(href) + '" style="background:' + color_(s['Brand accent color'], '#00b5e2') +
    ';color:#fff;padding:11px 18px;border-radius:6px;text-decoration:none;display:inline-block;font:600 14px Helvetica,Arial,sans-serif">' + esc_(label) + '</a></p>';
}

function rows_(pairs) {
  return '<table style="border-collapse:collapse;font-size:14px;width:100%">' + pairs.filter(function (p) { return p[1]; }).map(function (p) {
    return '<tr><td style="padding:5px 10px 5px 0;color:#66727f;vertical-align:top;white-space:nowrap">' + esc_(p[0]) + '</td><td style="padding:5px 0">' + escBr_(p[1]) + '</td></tr>';
  }).join('') + '</table>';
}

function taskTable_(tasks, people) {
  if (!tasks.length) return '';
  return '<table style="border-collapse:collapse;font-size:13px;width:100%">' + tasks.map(function (t) {
    return '<tr><td style="padding:6px 10px 6px 0;border-bottom:1px solid #eef1f4;white-space:nowrap;vertical-align:top">' + esc_(prettyIso(t.dueDate)) + '</td>' +
      '<td style="padding:6px 0;border-bottom:1px solid #eef1f4">' + esc_(t.task) +
      (people ? '<br><span style="color:#66727f;font-size:12px">' + esc_(t.channel) + ' · ' + esc_(nameOf_(t.assigneeEmail, people)) + '</span>' : '') + '</td></tr>';
  }).join('') + '</table>';
}

function adminEmails_(people) { return emailsWithRole_(ROLES.ADMIN, people); }

/* ---------------- request lifecycle ---------------- */

function notifySubmitted_(r, s, people) {
  send_(s, {
    to: r.requesterEmail,
    subject: 'Request received: ' + r.title + ' (' + r.requestId + ')',
    html: '<p>Thanks, ' + esc_(String(r.requester).split(' ')[0]) + '! We received your request. The communications team will review it, set the tier and build your plan.</p>' +
      (r.flags ? '<p style="background:#fff3dd;color:#9a5b00;padding:10px 12px;border-radius:6px">' + esc_(r.flags) + '. We will do our best; rushed requests may get a lighter plan.</p>' : '') +
      rows_([['Request', r.requestId], ['Type', r.requestType], ['Date', prettyIso(r.eventDate)], ['Suggested tier', r.suggestedTier]]) +
      button_(appLink_(r.requestId), 'View your request', s)
  });
  send_(s, {
    to: adminEmails_(people), replyTo: r.requesterEmail,
    subject: 'New request to review: ' + r.title + ' (' + r.suggestedTier + ')',
    html: '<p>' + esc_(r.requester) + ' submitted a new request.</p>' +
      rows_([['Request', r.requestId], ['Ministry', r.ministry], ['Type', r.requestType], ['Date', prettyIso(r.eventDate)], ['Suggested tier', r.suggestedTier], ['Flags', r.flags]]) +
      button_(appLink_(r.requestId), 'Review it', s)
  });
}

function notifyReviewed_(r, s, people) {
  var tasks = readTable_(TABLES.TASKS).filter(function (t) { return t.requestId === r.requestId && t.status === TASK.OPEN; });
  if (r.status === STATUS.PLANNED) {
    var mine = tasks.filter(function (t) { return lc_(t.assigneeEmail) === lc_(r.requesterEmail); });
    send_(s, {
      to: r.requesterEmail,
      subject: 'Approved: ' + r.title + ' — ' + r.tier,
      html: '<p>Your request is approved as <b>' + esc_(r.tier) + '</b> (' + esc_(r.mode) + ').</p>' +
        (r.messageToRequester ? '<p>' + escBr_(r.messageToRequester) + '</p>' : '') +
        (mine.length ? '<h3 style="font:600 15px Helvetica,Arial">Your part</h3>' + taskTable_(mine) : '') +
        button_(appLink_(r.requestId), 'See the full plan', s)
    });
    if (/^yes/i.test(r.needsDesign)) sendBrief_(r, tasks, s, people);
    // Pastor and others with tasks hear about theirs.
    var others = {};
    tasks.forEach(function (t) {
      var e = lc_(t.assigneeEmail);
      if (e && e !== lc_(r.requesterEmail) && adminEmails_(people).indexOf(e) < 0 && emailsWithRole_(ROLES.DESIGNER, people).indexOf(e) < 0) (others[e] = others[e] || []).push(t);
    });
    Object.keys(others).forEach(function (e) {
      send_(s, { to: e, subject: 'New tasks: ' + r.title, html: '<p>You have tasks for <b>' + esc_(r.title) + '</b>.</p>' + taskTable_(others[e]) + button_(appLink_(r.requestId), 'Open in the app', s) });
    });
  } else {
    send_(s, {
      to: r.requesterEmail,
      subject: (r.status === STATUS.NEEDS_INFO ? 'More info needed: ' : 'Update on your request: ') + r.title,
      html: '<p>' + (r.status === STATUS.NEEDS_INFO ? 'We need a little more information before we can plan <b>' + esc_(r.title) + '</b>.' : 'We are not able to take on <b>' + esc_(r.title) + '</b> as requested.') + '</p>' +
        (r.messageToRequester ? '<p style="background:#e6f7fc;padding:12px;border-radius:6px">' + escBr_(r.messageToRequester) + '</p>' : '') +
        button_(appLink_(r.requestId), 'Open your request', s)
    });
  }
}

/** The design brief: everything the designer needs in one email. */
function sendBrief_(r, tasks, s, people) {
  var d = designerFor_(r, s, people);
  if (d.owner !== 'Designer') return; // in-house design: the communications team already has it
  var mine = tasks.filter(function (t) { return lc_(t.assigneeEmail) === lc_(d.email); });
  send_(s, {
    to: d.email, cc: adminEmails_(people), replyTo: r.requesterEmail,
    subject: 'Design brief: ' + r.title + ' (' + r.tier + ')' + (mine.length ? ' — first draft ' + prettyIso(mine[0].dueDate) : ''),
    html: '<p>Hi ' + esc_(String(d.name).split(' ')[0]) + ', here is a new design brief. Reply to reach ' + esc_(r.requester) + ' directly.</p>' +
      (r.flags ? '<p style="background:#fff3dd;color:#9a5b00;padding:10px 12px;border-radius:6px">' + esc_(r.flags) + '</p>' : '') +
      '<h3 style="font:600 15px Helvetica,Arial">Your deadlines</h3>' + taskTable_(mine) +
      '<h3 style="font:600 15px Helvetica,Arial">The brief</h3>' +
      rows_([['Request', r.title + ' (' + r.requestId + ')'], ['Requested by', r.requester], ['Ministry', r.ministry], ['Tier', r.tier + ' · ' + r.mode],
        ['Date', prettyIso(r.eventDate)], ['Who for', r.whoFor], ['Big idea', r.bigIdea], ['Scripture', r.scripture],
        ['Weeks', r.seriesWeeks], ['Weekly titles', r.weeklyTitles], ['Story', r.story],
        ['One next step', [r.nextStepType, r.oneNextStep].filter(String).join(' — ')], ['Time & location', r.timeLocation],
        ['Details', r.details], ['Design items', r.designItems], ['Specs', r.designSpecs], ['Text to include', r.textToInclude],
        ['Text final?', r.textFinal], ['Visual direction', r.visualDirection], ['Inspiration', r.inspiration], ['Anything else', r.anythingElse],
        ['Files', r.designFolder]]) +
      button_(appLink_(r.requestId), 'Open in the app', s)
  });
}

function notifyChange_(r, text, cancel, s, people, user) {
  var to = adminEmails_(people);
  if (cancel && /^yes/i.test(r.needsDesign)) to = to.concat(emailsWithRole_(ROLES.DESIGNER, people));
  send_(s, {
    to: to, replyTo: user.email,
    subject: (cancel ? 'Cancelled: ' : 'Change request: ') + r.title,
    html: '<p>' + esc_(nameOf_(user.email, people)) + (cancel ? ' cancelled ' : ' sent a change for ') + '<b>' + esc_(r.title) + '</b>.</p>' +
      '<p style="background:#f7f9fa;padding:12px;border-radius:6px">' + escBr_(text) + '</p>' +
      (r.requestedNewDate ? '<p>The new date is waiting for you to apply it in the app.</p>' : '') +
      button_(appLink_(r.requestId), 'Open request', s)
  });
}

function notifyDateApplied_(r, s, people) {
  send_(s, { to: r.requesterEmail, subject: 'New date confirmed: ' + r.title,
    html: '<p>Your plan for <b>' + esc_(r.title) + '</b> now builds toward <b>' + esc_(prettyIso(r.eventDate)) + '</b>. Task dates were updated.</p>' + button_(appLink_(r.requestId), 'See the plan', s) });
}

function notifyMessage_(r, s, people) {
  send_(s, { to: r.requesterEmail, subject: 'About your design: ' + r.title,
    html: '<p>' + escBr_(r.messageToRequester) + '</p>' + button_(appLink_(r.requestId), 'Open your request', s) });
}

/* ---------------- design ---------------- */

function notifyDraftReady_(r, review, s, people) {
  var round = Number(r.designRound) || 0;
  send_(s, {
    to: r.requesterEmail, cc: adminEmails_(people),
    subject: (round ? 'Round ' + round + ' update' : 'First draft') + ' ready for review: ' + r.title,
    html: '<p>' + (round ? 'The Round ' + round + ' update' : 'The first draft') + ' for <b>' + esc_(r.title) + '</b> is ready.</p>' +
      '<p>Please review it by <b>' + esc_(prettyIso(review ? review.dueDate : '')) + '</b>, then either <b>approve</b> it or <b>request changes</b> in one message (all your changes together count as one round).</p>' +
      (r.designFolder ? '<p><a href="' + esc_(r.designFolder) + '">Open the files</a></p>' : '') +
      button_(appLink_(r.requestId), 'Approve or request changes', s)
  });
}

function notifyFeedback_(r, text, held, s, people, user) {
  var d = designerFor_(r, s, people);
  if (held) {
    send_(s, { to: adminEmails_(people), subject: 'Extra design round requested: ' + r.title,
      html: '<p>' + esc_(nameOf_(user.email, people)) + ' asked for changes beyond the included rounds. The feedback is held until you decide.</p>' +
        '<p style="background:#f7f9fa;padding:12px;border-radius:6px">' + escBr_(text) + '</p>' + button_(appLink_(r.requestId), 'Decide in the app', s) });
    send_(s, { to: r.requesterEmail, subject: 'Your feedback is with the communications team: ' + r.title,
      html: '<p>This request has used its included design rounds, so the communications team will review your feedback before it goes to the designer.</p>' });
    return;
  }
  send_(s, {
    to: d.email, cc: adminEmails_(people), replyTo: r.requesterEmail,
    subject: 'Round ' + r.designRound + ' changes: ' + r.title,
    html: '<p>' + esc_(nameOf_(user.email, people)) + ' requested changes (Round ' + esc_(r.designRound) + ').</p>' +
      '<p style="background:#f7f9fa;padding:12px;border-radius:6px">' + escBr_(text) + '</p>' +
      '<p>Due: <b>' + esc_(prettyIso(addDaysIso(todayIso_(), Number(s['Revision turnaround days']) || 3))) + '</b>. Upload the update in the app when it is ready.</p>' +
      button_(appLink_(r.requestId), 'Open in the app', s)
  });
}

function notifyDesignApproved_(r, s, people, user) {
  var d = designerFor_(r, s, people);
  send_(s, {
    to: d.email, cc: adminEmails_(people),
    subject: 'Design approved: ' + r.title,
    html: '<p>' + esc_(nameOf_(user.email, people)) + ' approved the design for <b>' + esc_(r.title) + '</b>. Please deliver the final files in the app.</p>' + button_(appLink_(r.requestId), 'Open in the app', s)
  });
}

function notifyFinalDelivered_(r, s, people) {
  send_(s, {
    to: r.requesterEmail, cc: adminEmails_(people),
    subject: 'Final files ready: ' + r.title,
    html: '<p>The final design files for <b>' + esc_(r.title) + '</b> are ready.</p>' +
      (r.designFolder ? button_(r.designFolder, 'Open the files', s) : '') + button_(appLink_(r.requestId), 'Open in the app', s)
  });
}

/* ---------------- weekly digest (time-driven) ---------------- */

function sendWeeklyDigest() {
  var s = readSettings_();
  if (/^(no|false|n)$/i.test(s['Send weekly digest'] || '')) return;
  var people = readPeople_();
  var today = todayIso_();
  var weekEnd = addDaysIso(today, 6);
  var open = {};
  var titles = {};
  readTable_(TABLES.REQUESTS).forEach(function (r) { titles[r.requestId] = r.title; });
  readTable_(TABLES.TASKS).forEach(function (t) {
    if (t.status !== TASK.OPEN || !t.assigneeEmail || t.dueDate > weekEnd) return;
    t.task = t.task + ' — ' + (titles[t.requestId] || t.requestId);
    (open[lc_(t.assigneeEmail)] = open[lc_(t.assigneeEmail)] || []).push(t);
  });
  Object.keys(open).forEach(function (email) {
    var list = open[email].sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; });
    var overdue = list.filter(function (t) { return t.dueDate < today; });
    var week = list.filter(function (t) { return t.dueDate >= today; });
    send_(s, {
      to: email,
      subject: 'Your communications tasks this week' + (overdue.length ? ' (' + overdue.length + ' overdue)' : ''),
      html: '<p>Good morning ' + esc_(String(nameOf_(email, people)).split(' ')[0]) + '!</p>' +
        (overdue.length ? '<h3 style="font:600 15px Helvetica,Arial;color:#c0392b">Overdue</h3>' + taskTable_(overdue) : '') +
        (week.length ? '<h3 style="font:600 15px Helvetica,Arial">Due this week</h3>' + taskTable_(week) : '') +
        button_(appLink_() + '?view=tasks', 'Open my tasks', s)
    });
  });
}
