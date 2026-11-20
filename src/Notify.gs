/**
 * Notify.gs — every email the hub sends.
 */

function esc_(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escMultiline_(s) {
  return esc_(s).replace(/\n/g, '<br>');
}

function appUrl_(requestId) {
  var url = ScriptApp.getService().getUrl() || '';
  return url && requestId ? url + '?request=' + encodeURIComponent(requestId) : url;
}

function prettyDate_(iso) {
  if (!iso) return '';
  try { return Utilities.formatDate(parseIsoDate(iso), Session.getScriptTimeZone(), 'EEE, MMM d'); }
  catch (e) { return iso; }
}

function isPlaceholder_(email) {
  return !email || /@example\./i.test(email);
}

function send_(opts, settings) {
  var to = splitEmails_(opts.to).filter(function (e) { return !isPlaceholder_(e); });
  if (!to.length) return;
  var cc = splitEmails_(opts.cc).filter(function (e) { return !isPlaceholder_(e) && to.indexOf(e) < 0; });
  var message = {
    to: to.join(','),
    subject: opts.subject,
    htmlBody: wrapEmail_(opts.html, settings),
    name: settings['App Name'] || 'Communications Hub'
  };
  if (cc.length) message.cc = cc.join(',');
  if (opts.replyTo && !isPlaceholder_(opts.replyTo)) message.replyTo = opts.replyTo;
  MailApp.sendEmail(message);
}

function wrapEmail_(inner, settings) {
  return '<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#1d2733;max-width:640px">' +
    '<div style="background:#1f3b57;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-weight:bold">' +
    esc_(settings['App Name'] || 'Communications Hub') + '</div>' +
    '<div style="border:1px solid #dde3ea;border-top:0;padding:18px;border-radius:0 0 8px 8px">' + inner + '</div></div>';
}

function button_(href, label) {
  if (!href) return '';
  return '<p style="margin:18px 0"><a href="' + esc_(href) + '" style="background:#2f6fde;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">' + esc_(label) + '</a></p>';
}

function taskTable_(tasks, showAssignee) {
  var rows = tasks.map(function (t) {
    return '<tr>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eef1f4;white-space:nowrap">' + esc_(prettyDate_(t.dueDate)) +
      (t.rush === 'Yes' || t.rush === true ? ' <span style="color:#c0392b;font-weight:bold">RUSH</span>' : '') + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #eef1f4"><b>' + esc_(t.task) + '</b><br><span style="color:#6b7785;font-size:12px">' +
      esc_(t.deliverable) + (t.requestTitle ? ' · ' + esc_(t.requestTitle) : '') + '</span>' +
      (t.notes ? '<br><span style="font-size:12px">' + esc_(t.notes) + '</span>' : '') + '</td>' +
      (showAssignee ? '<td style="padding:6px 8px;border-bottom:1px solid #eef1f4">' + esc_(t.assigneeName) + '</td>' : '') +
      '</tr>';
  }).join('');
  return '<table style="border-collapse:collapse;width:100%;font-size:13px">' +
    '<tr style="text-align:left;color:#6b7785"><th style="padding:6px 8px">Due</th><th style="padding:6px 8px">Task</th>' +
    (showAssignee ? '<th style="padding:6px 8px">Owner</th>' : '') + '</tr>' + rows + '</table>';
}

function detailRows_(pairs) {
  return '<table style="border-collapse:collapse;font-size:13px;width:100%">' + pairs.filter(function (p) { return p[1]; }).map(function (p) {
    return '<tr><td style="padding:5px 8px;color:#6b7785;vertical-align:top;white-space:nowrap">' + esc_(p[0]) +
      '</td><td style="padding:5px 8px">' + (p[2] ? p[1] : escMultiline_(p[1])) + '</td></tr>';
  }).join('') + '</table>';
}

function rushBanner_(request) {
  return request.rush === 'Yes'
    ? '<p style="background:#fdecea;color:#8e2a20;padding:10px 12px;border-radius:6px"><b>Rush request.</b> This came in with less notice than our standard timeline, so some deadlines were compressed.</p>'
    : '';
}

/** To the person who filled out the form: the whole timeline. */
function sendSubmitterConfirmation_(request, tasks, settings) {
  send_({
    to: request.submitterEmail,
    subject: 'Request received: ' + request.title + ' (' + request.requestId + ')',
    html: '<p>Thanks, ' + esc_(request.submitterName) + '! Your request is in and the timeline below has been built for you.</p>' +
      rushBanner_(request) +
      '<p><b>' + esc_(request.title) + '</b> — ' + esc_(prettyDate_(request.eventDate)) + '</p>' +
      taskTable_(tasks, true) +
      button_(appUrl_(request.requestId), 'View request'),
  }, settings);
}

/** One email per person (other than the submitter) listing just their tasks. */
function sendAssignmentEmails_(request, tasks, settings) {
  var byPerson = {};
  tasks.forEach(function (t) {
    var e = String(t.assigneeEmail).toLowerCase();
    if (e === String(request.submitterEmail).toLowerCase()) return;
    if (e === String(request.designerEmail).toLowerCase()) return; // designer gets the full brief instead
    (byPerson[e] = byPerson[e] || []).push(t);
  });
  Object.keys(byPerson).forEach(function (email) {
    var mine = byPerson[email];
    send_({
      to: email,
      replyTo: request.submitterEmail,
      subject: 'New task' + (mine.length > 1 ? 's' : '') + ': ' + request.title,
      html: '<p>Hi ' + esc_(mine[0].assigneeName) + ', you have ' + mine.length + ' new task' + (mine.length > 1 ? 's' : '') +
        ' for <b>' + esc_(request.title) + '</b> (submitted by ' + esc_(request.submitterName) + ', ' + esc_(request.ministry) + ').</p>' +
        rushBanner_(request) + taskTable_(mine, false) +
        detailRows_([['Event date', prettyDate_(request.eventDate)], ['Deliverables', request.deliverables], ['Description', request.description]]) +
        button_(appUrl_(request.requestId), 'Open in the hub')
    }, settings);
  });
}

/** The creative brief: everything the designer needs in one place. */
function sendDesignerBrief_(request, tasks, files, designer, settings) {
  var designerTasks = tasks.filter(function (t) { return String(t.assigneeEmail).toLowerCase() === String(designer.email).toLowerCase(); });
  var fileLinks = files.length
    ? files.map(function (f) { return '<a href="' + esc_(f.url) + '">' + esc_(f.name) + '</a>'; }).join('<br>')
    : '';
  var folderLink = request.filesUrl ? '<a href="' + esc_(request.filesUrl) + '">Open request folder</a> (upload finals here)' : '';

  send_({
    to: designer.email,
    cc: settings['CC On Designer Brief'],
    replyTo: request.submitterEmail,
    subject: (request.rush === 'Yes' ? '[RUSH] ' : '') + 'Design brief: ' + request.title + ' — due ' + prettyDate_(designerTasks.length ? designerTasks[0].dueDate : request.eventDate),
    html: '<p>Hi ' + esc_(designer.name) + ', here is a new design brief. Reply to this email to reach ' + esc_(request.submitterName) + ' directly.</p>' +
      rushBanner_(request) +
      '<h3 style="margin:16px 0 6px">Your deadlines</h3>' + taskTable_(designerTasks, false) +
      '<h3 style="margin:20px 0 6px">The brief</h3>' +
      detailRows_([
        ['Request', request.title + ' (' + request.requestId + ')'],
        ['Ministry', request.ministry],
        ['Requested by', request.submitterName + ' <' + request.submitterEmail + '>'],
        ['Event date', prettyDate_(request.eventDate) + (request.eventTime ? ' · ' + request.eventTime : '')],
        ['Location', request.location],
        ['Audience', request.audience],
        ['Needed for', request.deliverables],
        ['Description', request.description],
        ['Key message / copy', request.keyMessage],
        ['Call to action', request.callToAction],
        ['Link', request.link],
        ['Contact', request.contact],
        ['Design notes', request.designNotes],
        ['Attachments', fileLinks, true],
        ['Files', folderLink, true]
      ]) +
      '<h3 style="margin:20px 0 6px">Full timeline</h3>' + taskTable_(tasks, true) +
      button_(appUrl_(request.requestId), 'Open in the hub')
  }, settings);
}

/** When a task is marked done, tell the owner of the next step in that deliverable. */
function notifyNextStep_(task, allTasks, request, settings) {
  var open = allTasks.filter(function (t) {
    return t.requestId === task.requestId && t.deliverable === task.deliverable &&
      t.taskId !== task.taskId && t.status !== STATUS.DONE && Number(t.step) > Number(task.step);
  }).sort(function (a, b) { return Number(a.step) - Number(b.step); });
  var next = open[0];
  if (!next || String(next.assigneeEmail).toLowerCase() === String(task.completedBy).toLowerCase()) return;

  send_({
    to: next.assigneeEmail,
    subject: "You're up: " + next.task + ' — ' + request.title,
    html: '<p>Hi ' + esc_(next.assigneeName) + ', <b>' + esc_(task.task) + '</b> was just completed by ' + esc_(task.assigneeName) +
      '. Your next step is ready:</p>' + taskTable_([next], false) +
      (request.filesUrl ? '<p><a href="' + esc_(request.filesUrl) + '">Open request files</a></p>' : '') +
      button_(appUrl_(request.requestId), 'Open in the hub')
  }, settings);
}

/** Time-driven (Mondays 7am): each person's overdue + this-week tasks. */
function sendWeeklyDigest() {
  var settings = readSettings_();
  if (/^(no|false|n)$/i.test(settings['Send Weekly Digest'] || '')) return;

  var tz = Session.getScriptTimeZone();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var weekEnd = toIsoDate(addDays(parseIsoDate(today), 6));

  var byPerson = {};
  readTable_(SHEETS.TASKS).forEach(function (t) {
    if (t.status === STATUS.DONE || t.status === STATUS.CANCELLED || t.dueDate > weekEnd) return;
    var e = String(t.assigneeEmail).toLowerCase();
    (byPerson[e] = byPerson[e] || []).push(t);
  });

  Object.keys(byPerson).forEach(function (email) {
    var list = byPerson[email].sort(byDue_);
    var overdue = list.filter(function (t) { return t.dueDate < today; });
    var thisWeek = list.filter(function (t) { return t.dueDate >= today; });
    send_({
      to: email,
      subject: 'Your comms tasks this week' + (overdue.length ? ' (' + overdue.length + ' overdue)' : ''),
      html: '<p>Good morning ' + esc_(list[0].assigneeName) + '! Here is what is on your plate.</p>' +
        (overdue.length ? '<h3 style="color:#c0392b;margin:16px 0 6px">Overdue</h3>' + taskTable_(overdue, false) : '') +
        (thisWeek.length ? '<h3 style="margin:16px 0 6px">Due this week</h3>' + taskTable_(thisWeek, false) : '') +
        button_(appUrl_(), 'Open my tasks')
    }, settings);
  });
}
