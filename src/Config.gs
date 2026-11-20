/**
 * Config.gs — the app's data layout and default settings.
 *
 * All data lives in one spreadsheet the app creates and protects
 * ("Communications App — Data"). Nobody needs to open it; it's there for
 * backups and exports. Day-to-day settings are edited in the app (Admin).
 */

var TABLES = {
  SETTINGS: 'Settings',
  PEOPLE: 'People',
  REQUESTS: 'Requests',
  TASKS: 'Tasks',
  ACTIVITY: 'Activity',
  SESSIONS: 'Sessions'
};

/** [key, header] — keys are used in code, headers are what the data file shows. */
var COLUMNS = {};
COLUMNS[TABLES.PEOPLE] = [
  ['email', 'Email'], ['name', 'Name'], ['role', 'Role'], ['ministry', 'Ministry'], ['active', 'Active']
];
COLUMNS[TABLES.REQUESTS] = [
  ['requestId', 'Request ID'], ['submitted', 'Submitted'], ['requester', 'Requester'], ['requesterEmail', 'Requester Email'],
  ['ministry', 'Ministry'], ['requestType', 'Request Type'], ['title', 'Event / Initiative'], ['eventDate', 'Event Date'],
  ['suggestedTier', 'Suggested Tier'], ['tier', 'Final Tier'], ['mode', 'Mode'], ['status', 'Status'], ['flags', 'Flags'],
  ['whoFor', 'Who For'], ['reach', 'Reach'], ['bridge', 'Bridge Event'], ['nextStepType', 'Next Step Type'],
  ['story', 'Story'], ['oneNextStep', 'One Next Step'], ['timeLocation', 'Event Time & Location'],
  ['registration', 'PCO Registration'], ['details', 'Details'], ['needsDesign', 'Needs Design'],
  ['designItems', 'Design Items'], ['designSpecs', 'Design Specs'], ['textToInclude', 'Text To Include'],
  ['textFinal', 'Text Final'], ['inspiration', 'Inspiration'], ['anythingElse', 'Anything Else'],
  ['bigIdea', 'Big Idea'], ['scripture', 'Scripture'], ['seriesWeeks', 'Series Weeks'], ['weeklyTitles', 'Weekly Titles'],
  ['visualDirection', 'Visual Direction'], ['designFolder', 'Design Folder'], ['calendarIds', 'Calendar IDs'],
  ['messageToRequester', 'Message to Requester'], ['requestedNewDate', 'Requested New Date'],
  ['designState', 'Design State'], ['designStateSince', 'Design State Since'], ['designRound', 'Design Round'],
  ['heldFeedback', 'Held Feedback'], ['results', 'Results (post-event)'], ['approvedAt', 'Approved'], ['updatedAt', 'Updated']
];
COLUMNS[TABLES.TASKS] = [
  ['taskKey', 'Task Key'], ['requestId', 'Request ID'], ['dueDate', 'Due Date'], ['channel', 'Channel'], ['task', 'Task'],
  ['owner', 'Owner'], ['assigneeEmail', 'Assigned Email'], ['status', 'Status'], ['notes', 'Notes'], ['key', 'Workflow Key'],
  ['completedAt', 'Completed'], ['completedBy', 'Completed By']
];
COLUMNS[TABLES.SESSIONS] = [
  ['tokenHash', 'Token Hash'], ['email', 'Email'], ['created', 'Created'], ['expires', 'Expires'], ['revoked', 'Revoked']
];
COLUMNS[TABLES.ACTIVITY] = [
  ['at', 'When'], ['requestId', 'Request ID'], ['by', 'By'], ['type', 'Type'], ['text', 'Text'], ['link', 'Link']
];

var ROLES = { ADMIN: 'Communications', DESIGNER: 'Designer', PASTOR: 'Pastor', STAFF: 'Staff' };

/** Template owners → the role that fills them ('Leader' = the requester). */
var OWNER_ROLE = { Comms: ROLES.ADMIN, Designer: ROLES.DESIGNER, Pastor: ROLES.PASTOR };

var STATUS = {
  NEEDS_REVIEW: 'Needs Review', NEEDS_INFO: 'Needs Info', PLANNED: 'Planned',
  DECLINED: 'Declined', DONE: 'Done', CANCELLED: 'Cancelled'
};
var TASK = { OPEN: 'Not started', DONE: 'Done', CANCELLED: 'Cancelled' };
var DESIGN = { BRIEFED: 'Briefed', IN_REVIEW: 'In Review', REVISING: 'Revising', HELD: 'Feedback Held', APPROVED: 'Approved', DELIVERED: 'Delivered' };

/** [setting, default, help] — editable in the app under Admin. */
var DEFAULT_SETTINGS = [
  ['Brand header text', 'Calvary Communications', 'Shown at the top of the app and emails.'],
  ['Brand header color', '#00b5e2', ''],
  ['Brand header text color', '#ffffff', ''],
  ['Brand accent color', '#00b5e2', ''],
  ['Brand font', 'Georgia', ''],
  ['Brand header font', 'Montserrat', ''],
  ['Brand footer text', '', 'Footer line on every email.'],
  ['Designer handles', 'Level 1, Series', 'Tiers the staff designer designs; everything else is designed in-house.'],
  ['Sprint cap per year', '6', 'Maximum Level 1 Sprints per year.'],
  ['Included revision rounds', '2', 'Rounds of design changes before feedback is held for approval.'],
  ['Revision turnaround days', '3', 'Days the designer gets for each round of changes.'],
  ['Review window days', '3', 'Days the requester gets to review a draft.'],
  ['Master calendar ID', '', 'Google Calendar ID for the shared Master calendar (…@group.calendar.google.com).'],
  ['Drive parent folder', '', 'Drive folder link where each request gets its own folder.'],
  ['Ministries', 'Guest Services, LifeGroups, Calvary Kids, Calvary Students, Calvary Young Adults, Worship / Production, NextGen Groups, Calvary Cares, Pastoral / Staff, Other', 'Comma-separated; used in the request form.'],
  ['Self sign-up domains', '', 'Anyone with an email at these domains (comma-separated, e.g. calvaryirwin.com) can sign in without being added. Everyone else must be on the People list.'],
  ['Send weekly digest', 'Yes', 'Monday-morning email listing each person\'s tasks for the week.']
];

var MAX_FILE_BYTES = 10 * 1024 * 1024;
