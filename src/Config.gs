/**
 * Config.gs — sheet layout and the default data that setup() seeds.
 *
 * Day-to-day configuration (team members, lead times, who does what) lives in
 * the spreadsheet itself, so staff can change it without touching code.
 */

var SHEETS = {
  SETTINGS: 'Settings',
  TEAM: 'Team',
  TEMPLATES: 'Task Templates',
  REQUESTS: 'Requests',
  TASKS: 'Tasks'
};

/** [key used in code, column header shown in the sheet] */
var COLUMNS = {};
COLUMNS[SHEETS.TEAM] = [
  ['name', 'Name'],
  ['email', 'Email'],
  ['role', 'Role'],
  ['ministry', 'Ministry'],
  ['assistantEmail', 'Assistant Email'],
  ['approverEmail', 'Approver Email'],
  ['active', 'Active']
];
COLUMNS[SHEETS.TEMPLATES] = [
  ['deliverable', 'Deliverable'],
  ['step', 'Step'],
  ['task', 'Task'],
  ['anchor', 'Anchor (Event / Submitted)'],
  ['offset', 'Offset Days'],
  ['assignee', 'Assignee'],
  ['notes', 'Notes / Instructions']
];
COLUMNS[SHEETS.REQUESTS] = [
  ['requestId', 'Request ID'],
  ['submittedAt', 'Submitted'],
  ['submitterEmail', 'Submitter Email'],
  ['submitterName', 'Submitter'],
  ['ministry', 'Ministry'],
  ['title', 'Title'],
  ['eventDate', 'Event / Launch Date'],
  ['eventTime', 'Time'],
  ['location', 'Location'],
  ['audience', 'Audience'],
  ['description', 'Description'],
  ['keyMessage', 'Key Message / Copy'],
  ['callToAction', 'Call to Action'],
  ['link', 'Registration / Link'],
  ['contact', 'Contact'],
  ['deliverables', 'Deliverables'],
  ['designNotes', 'Notes for Designer'],
  ['filesUrl', 'Files Folder'],
  ['designerEmail', 'Designer'],
  ['status', 'Status'],
  ['rush', 'Rush']
];
COLUMNS[SHEETS.TASKS] = [
  ['taskId', 'Task ID'],
  ['requestId', 'Request ID'],
  ['requestTitle', 'Request'],
  ['deliverable', 'Deliverable'],
  ['step', 'Step'],
  ['task', 'Task'],
  ['notes', 'Instructions'],
  ['assigneeEmail', 'Assignee Email'],
  ['assigneeName', 'Assignee'],
  ['assigneeRole', 'Role'],
  ['dueDate', 'Due'],
  ['status', 'Status'],
  ['completedAt', 'Completed'],
  ['completedBy', 'Completed By'],
  ['rush', 'Rush']
];

var STATUS = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  NEW: 'New',
  COMPLETE: 'Complete',
  CANCELLED: 'Cancelled'
};

/** Roles that the app understands. Add more freely in the Team sheet. */
var ROLES = {
  DESIGNER: 'Designer',
  COMMS: 'Communications Director'
};

var DEFAULT_SETTINGS = [
  ['App Name', 'Communications Hub', 'Shown at the top of the app and in emails.'],
  ['Work Days', 'Mon, Tue, Wed, Thu, Fri', 'Due dates never land on other days.'],
  ['Minimum Lead Days', '42', 'Requests with fewer days of notice are flagged RUSH.'],
  ['Fallback Assignee Email', '', 'Gets tasks for roles no one holds yet (usually the Communications Director).'],
  ['Admin Emails', '', 'Comma-separated. Admins can update any task. Communications Directors are always admins.'],
  ['CC On Designer Brief', '', 'Comma-separated emails copied on every designer brief.'],
  ['Upload Folder ID', '', 'Filled in by setup(). Google Drive folder holding request attachments.'],
  ['Send Weekly Digest', 'Yes', 'Monday-morning email to each person listing their tasks for the week.']
];

/** Replace these with your real staff (or edit the Team sheet after setup). */
var DEFAULT_TEAM = [
  ['Communications Director', 'comms@example.org', 'Communications Director', 'Communications', '', '', 'Yes'],
  ['Graphic Designer', 'design@example.org', 'Designer', 'Communications', '', '', 'Yes'],
  ['Social Media Coordinator', 'social@example.org', 'Social Media', 'Communications', '', '', 'Yes'],
  ['Web Coordinator', 'web@example.org', 'Web', 'Communications', '', '', 'Yes'],
  ['Video Producer', 'video@example.org', 'Video', 'Communications', '', '', 'Yes'],
  ['Student Pastor', 'students@example.org', 'Leadership', 'Students', 'students.assistant@example.org', 'xp@example.org', 'Yes'],
  ['Executive Pastor', 'xp@example.org', 'Leadership', 'Executive', '', '', 'Yes']
];

/**
 * Default production schedule. "Offset Days" is relative to the Anchor:
 *   Event      → negative = days before the event/launch date
 *   Submitted  → working days after the form was submitted
 */
var DEFAULT_TEMPLATES = [
  ['Every Request', 1, 'Review & approve request', 'Submitted', 2, 'Communications Director', 'Confirm scope, channels and priority. Reach out to the submitter with questions.'],
  ['Every Request', 2, 'Supervisor sign-off', 'Submitted', 2, "Submitter's Approver", 'Approve that this ministry should promote this event. Skipped automatically when the submitter has no approver.'],
  ['Every Request', 3, 'Add to church calendar', 'Submitted', 3, 'Communications Director', ''],
  ['Every Request', 9, 'Send photos & attendance recap', 'Event', 3, "Submitter's Assistant", 'Share photos and a short win story for future promotion.'],

  ['Graphic Design', 1, 'Create first draft (slides / screens / social sizes)', 'Event', -35, 'Designer', 'See the brief emailed to you for copy, sizes and assets.'],
  ['Graphic Design', 2, 'Review draft & send feedback', 'Event', -32, 'Submitter', 'One consolidated round of feedback, please.'],
  ['Graphic Design', 3, 'Final revisions & deliver files', 'Event', -28, 'Designer', 'Upload finals to the request folder.'],

  ['Print (Posters / Flyers / Cards)', 1, 'Design print piece', 'Event', -42, 'Designer', ''],
  ['Print (Posters / Flyers / Cards)', 2, 'Approve print proof', 'Event', -38, 'Submitter', 'Check dates, times and spelling carefully — print is permanent.'],
  ['Print (Posters / Flyers / Cards)', 3, 'Send to printer', 'Event', -35, 'Communications Director', ''],
  ['Print (Posters / Flyers / Cards)', 4, 'Distribute printed pieces', 'Event', -28, "Submitter's Assistant", ''],

  ['Social Media', 1, 'Write captions & post plan', 'Event', -24, 'Social Media', ''],
  ['Social Media', 2, 'Schedule posts', 'Event', -21, 'Social Media', ''],

  ['Website / Registration', 1, 'Build event page & registration form', 'Event', -30, 'Web', ''],
  ['Website / Registration', 2, 'Test registration & confirm details', 'Event', -27, 'Submitter', ''],

  ['Email Newsletter', 1, 'Feature in newsletter (first mention)', 'Event', -21, 'Communications Director', ''],
  ['Email Newsletter', 2, 'Feature in newsletter (reminder)', 'Event', -7, 'Communications Director', ''],

  ['Bulletin / Program', 1, 'Place in bulletin', 'Event', -14, 'Communications Director', ''],

  ['Stage Announcement', 1, 'Write announcement script', 'Event', -12, 'Submitter', 'Keep it under 60 seconds.'],
  ['Stage Announcement', 2, 'Schedule in service order', 'Event', -9, 'Communications Director', ''],

  ['Video', 1, 'Script & shot list', 'Event', -42, 'Submitter', ''],
  ['Video', 2, 'Film', 'Event', -35, 'Video', ''],
  ['Video', 3, 'Edit first cut', 'Event', -24, 'Video', ''],
  ['Video', 4, 'Review cut & send feedback', 'Event', -21, 'Submitter', ''],
  ['Video', 5, 'Deliver final video', 'Event', -14, 'Video', '']
];
