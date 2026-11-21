/**
 * Plan.gs — tiers, runway and timeline templates (pure logic, unit tested).
 *
 * The templates reproduce the original Communications Hub exactly: each step
 * is a number of days from the event / launch date (negative = before).
 * Owners: 'Comms' (communications director), 'Designer', 'Pastor',
 *         'Leader' (whoever submitted the request).
 */

var TIERS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Series', 'Design'];

var TIER_INFO = {
  'Level 1': { mode: 'Sprint', label: 'Level 1 (Sprint)', runway: 84 },
  'Level 2': { mode: 'Core Next Steps', label: 'Level 2 (Core Next Steps)', runway: 42 },
  'Level 3': { mode: 'Sprinkle (NextGen channels)', label: 'Level 3 (NextGen)', runway: 35 },
  'Level 4': { mode: 'Snuggle', label: 'Level 4 (Individual)', runway: 21 },
  'Series': { mode: 'Series (multi-week)', label: 'Sermon Series', runway: 63 },
  'Design': { mode: 'Design only', label: 'Graphic design only', runway: 21 }
};

/*
 * Step fields: o = offset days, ch = channel, t = task, who = owner,
 *   when = condition: 'design' (needs design), 'designer' (tier handled by the
 *   staff designer), 'inhouse' (design done by comms), 'pco' (registration
 *   isn't "No"), key = workflow hook used by the design process.
 */
var TEMPLATES = {
  'Level 1': [
    { o: -84, ch: 'Strategy', t: 'Lock concept, story & creative direction (One Story + One Next Step)', who: 'Comms' },
    { o: -77, ch: 'Design', t: 'Design brief sent to designer', who: 'Comms', when: 'designer', key: 'brief' },
    { o: -77, ch: 'Content', t: 'Send final copy, story and photos for this request', who: 'Leader' },
    { o: -70, ch: 'Design', t: 'First draft due from designer: {designItems}', who: 'Designer', when: 'designer', key: 'draft' },
    { o: -69, ch: 'Design', t: 'Review the first draft and reply with approval or requested changes', who: 'Leader', when: 'design', key: 'review' },
    { o: -68, ch: 'Design', t: 'Design check-in: confirm the leader reviewed the draft (closes itself when they approve)', who: 'Comms', when: 'designer', key: 'checkin' },
    { o: -63, ch: 'Design', t: 'FINAL assets delivered to request folder', who: 'Designer', when: 'designer', key: 'final' },
    { o: -56, ch: 'Strategy', t: 'Marketing assets approved & finalized', who: 'Comms' },
    { o: -56, ch: 'Social', t: 'Create Facebook event; start paid social flight (if applicable)', who: 'Comms' },
    { o: -49, ch: 'Social', t: 'Start social teaser campaign', who: 'Comms' },
    { o: -49, ch: 'PCO', t: 'PCO registration goes live', who: 'Comms', when: 'pco' },
    { o: -49, ch: 'Print', t: 'Order invite cards / print materials', who: 'Comms' },
    { o: -35, ch: 'Email', t: 'Flowforth "Save the Date" to full list', who: 'Comms' },
    { o: -35, ch: 'Signage', t: 'Digital sign / lobby screens go live', who: 'Comms' },
    { o: -35, ch: 'Partners', t: 'Activate community partnerships / outside promotion', who: 'Comms' },
    { o: -28, ch: 'Stage', t: 'Stage announcement + bulletin listing begin', who: 'Comms' },
    { o: -21, ch: 'Social', t: 'Ramp social; distribute invite cards / shareable graphics', who: 'Comms' },
    { o: -14, ch: 'Email', t: 'Second Flowforth push', who: 'Comms' },
    { o: -14, ch: 'Social', t: 'Paid social to full intensity', who: 'Comms' },
    { o: -7, ch: 'Email', t: 'Final Flowforth push', who: 'Comms' },
    { o: -7, ch: 'Stage', t: 'Stage announcement', who: 'Comms' },
    { o: -3, ch: 'Social', t: 'Week-of: daily social + text/email/Church Center push', who: 'Comms' },
    { o: 2, ch: 'Follow-up', t: 'Thank-you recap email + social recap', who: 'Comms' },
    { o: 2, ch: 'Follow-up', t: 'Start first-time guest follow-up sequence', who: 'Comms' },
    { o: 7, ch: 'Review', t: 'Post-event review: log results', who: 'Comms', key: 'results' }
  ],

  // No Level 2 requests existed in the hub yet; this is a starting point to adjust.
  'Level 2': [
    { o: -42, ch: 'Content', t: 'Send final copy, story and photos for this request', who: 'Leader' },
    { o: -35, ch: 'Design', t: 'Create the design in-house: {designItems}', who: 'Comms', when: 'inhouse', key: 'draft' },
    { o: -34, ch: 'Design', t: 'Review the first draft and reply with approval or requested changes', who: 'Leader', when: 'design', key: 'review' },
    { o: -28, ch: 'Design', t: 'FINAL design files in the request folder', who: 'Comms', when: 'inhouse', key: 'final' },
    { o: -28, ch: 'PCO', t: 'PCO registration goes live', who: 'Comms', when: 'pco' },
    { o: -21, ch: 'Email', t: 'Flowforth email to full list', who: 'Comms' },
    { o: -21, ch: 'Signage', t: 'Digital sign / lobby screens go live', who: 'Comms' },
    { o: -14, ch: 'Stage', t: 'Stage announcement + bulletin listing begin', who: 'Comms' },
    { o: -14, ch: 'Social', t: 'Social posts on main channels', who: 'Comms' },
    { o: -7, ch: 'Church Center', t: 'Church Center push + reminder email', who: 'Comms' },
    { o: -2, ch: 'Social', t: 'Reminder post', who: 'Comms' },
    { o: 2, ch: 'Email', t: 'Thank-you/recap email (include next-step CTA)', who: 'Comms' },
    { o: 7, ch: 'Review', t: 'Log results', who: 'Comms', key: 'results' }
  ],

  'Level 3': [
    { o: -35, ch: 'Content', t: 'Send final copy, story and photos for this request', who: 'Leader' },
    { o: -28, ch: 'Design', t: 'Create the design in-house: {designItems}', who: 'Comms', when: 'inhouse', key: 'draft' },
    { o: -27, ch: 'Design', t: 'Review the first draft and reply with approval or requested changes', who: 'Leader', when: 'design', key: 'review' },
    { o: -21, ch: 'Email', t: 'Targeted Flowforth email to NextGen parents', who: 'Comms' },
    { o: -21, ch: 'PCO', t: 'PCO registration goes live', who: 'Comms', when: 'pco' },
    { o: -21, ch: 'Design', t: 'FINAL design files in the request folder', who: 'Comms', when: 'inhouse', key: 'final' },
    { o: -14, ch: 'Social', t: 'NextGen social channels begin promotion (not main)', who: 'Comms' },
    { o: -7, ch: 'Bulletin', t: 'Bulletin listing', who: 'Comms' },
    { o: -7, ch: 'Church Center', t: 'Church Center push; Snuggle mention on stage ONLY if it clears the 50% Rule', who: 'Leader' },
    { o: -2, ch: 'Email', t: 'Reminder email/text/Church Center push to targeted audience', who: 'Leader' },
    { o: 2, ch: 'Email', t: 'Thank-you/recap Flowforth to targeted list (include next-step CTA)', who: 'Leader' },
    { o: 7, ch: 'Review', t: 'Log results', who: 'Comms', key: 'results' }
  ],

  'Level 4': [
    { o: -24, ch: 'Content', t: 'Send final copy, story and photos for this request', who: 'Leader' },
    { o: -17, ch: 'Design', t: 'Create the design in-house: {designItems}', who: 'Comms', when: 'inhouse', key: 'draft' },
    { o: -16, ch: 'Design', t: 'Review the first draft and reply with approval or requested changes', who: 'Leader', when: 'design', key: 'review' },
    { o: -14, ch: 'Bulletin', t: 'Bulletin listing; digital sign (if applicable)', who: 'Comms' },
    { o: -14, ch: 'PCO', t: 'PCO registration goes live', who: 'Comms', when: 'pco' },
    { o: -14, ch: 'Design', t: 'FINAL design files in the request folder', who: 'Comms', when: 'inhouse', key: 'final' },
    { o: -7, ch: 'Social', t: 'One social post + ministry-owned account post', who: 'Comms' },
    { o: -2, ch: 'Social', t: 'Reminder post; bulletin listing', who: 'Comms' },
    { o: 2, ch: 'Email', t: 'Thank-you Flowforth (if applicable)', who: 'Comms' }
  ],

  'Series': [
    { o: -70, ch: 'Strategy', t: 'Series title, big idea & scriptures locked with pastor', who: 'Pastor' },
    { o: -63, ch: 'Design', t: 'Design brief sent to designer', who: 'Comms', when: 'designer', key: 'brief' },
    { o: -49, ch: 'Design', t: 'First draft due from designer: {designItems}', who: 'Designer', when: 'designer', key: 'draft' },
    { o: -48, ch: 'Design', t: 'Review the first draft and reply with approval or requested changes', who: 'Leader', when: 'design', key: 'review' },
    { o: -47, ch: 'Design', t: 'Design check-in: confirm the leader reviewed the draft (closes itself when they approve)', who: 'Comms', when: 'designer', key: 'checkin' },
    { o: -35, ch: 'Strategy', t: 'Series art approved & finalized', who: 'Comms' },
    { o: -35, ch: 'Design', t: 'FINAL assets delivered to request folder', who: 'Designer', when: 'designer', key: 'final' },
    { o: -28, ch: 'Signage', t: 'Lobby screens / digital sign teaser', who: 'Comms' },
    { o: -28, ch: 'Social', t: 'Series teaser campaign begins', who: 'Comms' },
    { o: -21, ch: 'Email', t: 'Flowforth series preview email', who: 'Comms' },
    { o: -14, ch: 'Stage', t: 'Pastor announces the series from stage', who: 'Pastor' },
    { o: -14, ch: 'Bulletin', t: 'Series graphic in bulletin', who: 'Comms' },
    { o: -7, ch: 'Production', t: 'Series slides, bumpers & lower thirds loaded for all weeks', who: 'Designer' },
    { o: -7, ch: 'Social', t: 'Launch-week social posts scheduled', who: 'Comms' },
    { o: -7, ch: 'Email', t: 'Flowforth "starts this Sunday" email', who: 'Comms' },
    { o: 2, ch: 'Follow-up', t: 'Week-1 follow-up: invite-a-friend / next-step push', who: 'Comms' },
    { weekly: true, o: -4, ch: 'Social', t: 'Week {n}: sermon graphic + social post out', who: 'Comms' },
    { afterSeries: 7, ch: 'Review', t: 'Series wrap-up: log results, archive art & files', who: 'Comms', key: 'results' }
  ],

  'Design': [
    { o: -21, ch: 'Design', t: 'Create the design in-house: {designItems}', who: 'Comms', when: 'inhouse', key: 'draft' },
    { o: -21, ch: 'Design', t: 'First draft due from designer: {designItems}', who: 'Designer', when: 'designer', key: 'draft' },
    { o: -18, ch: 'Design', t: 'Review the first draft and reply with approval or requested changes', who: 'Leader', key: 'review' },
    { o: -7, ch: 'Design', t: 'FINAL design files in the request folder', who: 'Comms', when: 'inhouse', key: 'final' },
    { o: -7, ch: 'Design', t: 'FINAL assets delivered to request folder', who: 'Designer', when: 'designer', key: 'final' }
  ]
};

/* ---------------- dates ---------------- */

function parseIsoDate(s) {
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || '').trim());
  if (!m) throw new Error('Invalid date "' + s + '"');
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function toIsoDate(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function addDaysIso(iso, n) {
  var d = parseIsoDate(iso);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}
function daysBetweenIso(a, b) {
  return Math.round((parseIsoDate(b) - parseIsoDate(a)) / 86400000);
}
var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The app's one date format: "Friday November-20-2026". */
function prettyIso(iso) {
  if (!iso) return '';
  var d = parseIsoDate(iso);
  return WEEKDAYS[d.getDay()] + ' ' + MONTHS[d.getMonth()] + '-' + d.getDate() + '-' + d.getFullYear();
}

/** Bolds weekday names in the text parts of an HTML string (not inside tags). */
function boldWeekdays(html) {
  var re = /\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/g;
  return String(html).replace(/(^|>)([^<]+)/g, function (m, gt, text) { return gt + text.replace(re, '<b>$1</b>'); });
}

/* ---------------- tiers ---------------- */

/**
 * Suggests a tier from the request answers (the communications director sets
 * the final tier when reviewing).
 */
function suggestTier(req) {
  if (req.requestType === 'Series') return 'Series';
  if (req.requestType === 'Design') return 'Design';
  var who = String(req.whoFor || '').toLowerCase();
  var reach = String(req.reach || '');
  var big = /50-79|80/.test(reach);
  if (who.indexOf('whole church') === 0) return big || /^yes/i.test(req.bridge) ? 'Level 1' : 'Level 2';
  if (who.indexOf('a specific next step') === 0) return 'Level 2';
  if (who.indexOf('a specific age group') === 0) return big ? 'Level 2' : 'Level 3';
  return big ? 'Level 2' : 'Level 4';
}

function modeFor(tier) {
  return (TIER_INFO[tier] || {}).mode || '';
}

/**
 * Runway check. Returns '' when there's enough notice, otherwise the flag the
 * hub used, e.g. "COMPRESSED: 49 days of runway, Level 1 needs 84".
 */
function runwayFlag(tier, todayIso, eventIso, runwayOverrides) {
  var need = (runwayOverrides && runwayOverrides[tier]) || (TIER_INFO[tier] || {}).runway || 0;
  var have = daysBetweenIso(todayIso, eventIso);
  return have < need ? 'COMPRESSED: ' + have + ' days of runway, ' + tier + ' needs ' + need : '';
}

/* ---------------- plan ---------------- */

/**
 * Builds the task list for an approved request.
 *
 * req: { tier, eventDate, needsDesign ('Yes'/'No'), registration, designItems, seriesWeeks }
 * opts: { today: 'YYYY-MM-DD', designerTiers: ['Level 1', 'Series'] }
 *
 * Steps that would be due before today are moved to today and noted as
 * "Compressed: original date …", exactly like the hub did.
 */
function buildPlan(req, opts) {
  var tmpl = TEMPLATES[req.tier];
  if (!tmpl) throw new Error('No timeline template for tier "' + req.tier + '".');
  var today = opts.today;
  var designerTiers = (opts.designerTiers || []).map(function (t) { return String(t).trim().toLowerCase(); });
  var byDesigner = designerTiers.indexOf(String(req.tier).toLowerCase()) >= 0;
  var needsDesign = req.tier === 'Design' || /^yes/i.test(req.needsDesign);
  var pco = !/^no$/i.test(String(req.registration || '').trim());
  var weeks = Math.max(1, Math.min(52, parseInt(req.seriesWeeks, 10) || 1));
  var items = String(req.designItems || 'design items');

  function include(step) {
    switch (step.when) {
      case 'design': return needsDesign;
      case 'designer': return needsDesign && byDesigner;
      case 'inhouse': return needsDesign && !byDesigner;
      case 'pco': return pco;
      default: return true;
    }
  }

  var out = [];
  function push(step, offset, text) {
    var ideal = addDaysIso(req.eventDate, offset);
    var compressed = ideal < today;
    out.push({
      offset: offset,
      dueDate: compressed ? today : ideal,
      channel: step.ch,
      task: text,
      owner: step.who,
      key: step.key || '',
      notes: compressed ? 'Compressed: original date ' + prettyIso(ideal) : ''
    });
  }

  tmpl.forEach(function (step) {
    if (!include(step)) return;
    if (step.weekly) {
      for (var n = 1; n <= weeks; n++) push(step, step.o + 7 * (n - 1), step.t.replace('{n}', n));
    } else if (step.afterSeries !== undefined) {
      push(step, 7 * (weeks - 1) + step.afterSeries, step.t);
    } else {
      push(step, step.o, step.t.replace('{designItems}', items));
    }
  });

  out.sort(function (a, b) { return a.offset - b.offset; });
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { TIERS: TIERS, TIER_INFO: TIER_INFO, TEMPLATES: TEMPLATES, buildPlan: buildPlan, suggestTier: suggestTier,
    runwayFlag: runwayFlag, addDaysIso: addDaysIso, daysBetweenIso: daysBetweenIso, prettyIso: prettyIso, modeFor: modeFor };
}
