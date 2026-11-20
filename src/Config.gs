/**
 * Config.gs — where the app finds things in your existing Communications Hub.
 *
 * The app only READS the hub spreadsheet. New requests, design feedback and
 * changes are submitted through your existing Google Forms, so all of your
 * current automation (tiers, timelines, Google Tasks, calendar, designer
 * brief emails) keeps running exactly as it does today.
 */

/** The Communications Hub spreadsheet. */
var HUB_SPREADSHEET_ID = '1mc1sJEt76YJsyKz4t92aja0ggfwnc43IS0aheGX20h8';

var TABS = {
  CONFIG: 'Config',
  REQUESTS: 'Requests',
  TIMELINE: 'Timeline'
};

/**
 * Which row on the Config tab holds each form's EDIT link (…/forms/d/<id>/edit).
 * "Form edit link" already exists. Add the other two rows to Config once.
 */
var FORM_CONFIG_KEYS = {
  request: 'Form edit link',
  feedback: 'Design feedback form edit link',
  change: 'Change form edit link'
};

/** Config rows that say who plays each role. */
var ROLE_CONFIG_KEYS = {
  admin: 'Your email',
  designer: 'Designer email',
  pastor: 'Pastor email'
};

/**
 * Timeline "Owner" values that stand for a fixed person (looked up in Config).
 * "Ministry Leader" tasks belong to whoever submitted the request.
 */
var OWNER_TO_ROLE = {
  'michael': 'admin',
  'designer': 'designer',
  'pastor': 'pastor'
};

/** Form questions the app fills in automatically (matched on the question title). */
var PREFILL = [
  { pattern: /^your email$/i, from: 'email', lock: true },
  { pattern: /^your name$/i, from: 'name' },
  { pattern: /^request id$/i, from: 'requestId', lock: true }
];

/** Where the link to uploaded attachments is added (first visible match wins). */
var ATTACHMENT_TARGETS = [/inspiration or reference links/i, /anything else/i];

var DONE_TASK = /^done$/i;
var CLOSED_REQUEST = /^(done|cancelled|declined)$/i;
var MAX_FILE_BYTES = 10 * 1024 * 1024;
