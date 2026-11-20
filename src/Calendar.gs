/**
 * Calendar.gs — keeps the shared Master calendar in step with approved requests.
 * One all-day event per request (a span for sermon series), plus the 14-day
 * Sprint window for Level 1.
 */

var TIER_SHORT = { 'Level 1': 'L1', 'Level 2': 'L2', 'Level 3': 'L3', 'Level 4': 'L4', 'Series': 'Series', 'Design': 'Design' };

function masterCalendar_(settings) {
  var id = calendarIdFrom_(settings['Master calendar ID']);
  if (!id) return null;
  var cal = CalendarApp.getCalendarById(id);
  if (!cal) throw new Error('Could not open the Master calendar (' + id + '). Is it shared with the app owner?');
  return cal;
}

/** Accepts a plain calendar ID or a calendar link containing ?cid=… */
function calendarIdFrom_(s) {
  s = String(s || '').trim();
  var m = /[?&]cid=([^&]+)/.exec(s);
  if (m) s = decodeURIComponent(m[1]);
  return /@/.test(s) ? s : '';
}

function removeCalendar_(r, settings) {
  var cal = masterCalendar_(settings);
  if (!cal || !r.calendarIds) return;
  splitList_(r.calendarIds).forEach(function (id) {
    try { var ev = cal.getEventById(id); if (ev) ev.deleteEvent(); } catch (e) { console.warn('Remove event ' + id + ': ' + e.message); }
  });
  r.calendarIds = '';
}

/** Replaces this request's events. Caller saves the request (calendarIds changes). */
function syncCalendar_(r, settings) {
  var cal = masterCalendar_(settings);
  if (!cal) return;
  removeCalendar_(r, settings);
  if ([STATUS.PLANNED, STATUS.DONE].indexOf(r.status) < 0) return;
  var tier = r.tier || r.suggestedTier;
  var title = '[' + (TIER_SHORT[tier] || tier) + '] ' + r.title;
  var desc = [r.requestId, r.ministry, r.requester, r.timeLocation, r.oneNextStep].filter(String).join('\n') +
    (ScriptApp.getService().getUrl() ? '\n\n' + ScriptApp.getService().getUrl() + '?request=' + encodeURIComponent(r.requestId) : '');
  var ids = [];
  var start = parseIsoDate(r.eventDate);
  if (tier === 'Series') {
    var weeks = Math.max(1, parseInt(r.seriesWeeks, 10) || 1);
    var end = parseIsoDate(addDaysIso(r.eventDate, 7 * (weeks - 1) + 1));
    ids.push(cal.createAllDayEvent(title, start, end, { description: desc }).getId());
  } else {
    ids.push(cal.createAllDayEvent(title, start, { description: desc }).getId());
  }
  if (tier === 'Level 1') {
    ids.push(cal.createAllDayEvent('[L1 Sprint] ' + r.title, parseIsoDate(addDaysIso(r.eventDate, -14)), start, { description: 'Sprint window\n' + desc }).getId());
  }
  r.calendarIds = ids.join(',');
}
