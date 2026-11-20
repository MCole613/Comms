// Synthetic data shaped exactly like the hub's real tabs (headers copied from the hub).
const REQ_HEADERS = ['Request ID', 'Submitted', 'Requester', 'Requester Email', 'Ministry', 'Event / Initiative', 'Event Date', 'Suggested Tier', 'Final Tier', 'Mode', 'Status', 'Flags', 'Who For', 'Reach', 'Bridge Event', 'Next Step Type', 'Story', 'One Next Step', 'Event Time & Location', 'PCO Registration', 'Details', 'Needs Design', 'Design Items', 'Design Specs', 'Inspiration', 'Anything Else', 'Design Folder', 'Calendar IDs', 'Results (post-event)', 'Request Type', 'Series Weeks', 'Weekly Titles', 'Visual Direction', 'Message to Requester', 'Change Requests', 'Requested New Date', 'Design State', 'Design State Since', 'Design Round', 'Design Feedback Log', 'Held Feedback'];
const TL_HEADERS = ['Task Key', 'Request ID', 'Event', 'Due Date', 'Channel', 'Task', 'Owner', 'Tier', 'Status', 'Google Task ID', 'Notes', 'Assigned To', 'Assigned Email', ''];

function req(o) { return REQ_HEADERS.map(h => (o[h] === undefined ? '' : o[h])); }
function task(key, id, event, due, channel, text, owner, tier, status, assignedTo = '', email = '') {
  return [key, id, event, due, channel, text, owner, tier, status, 'gtask' + key, '', assignedTo, email, ''];
}

function hubTabs(folderUrls = {}) {
  return {
    Config: [
      ['Setting', 'Value', '', 'Ministries (form dropdown)'],
      ['Your email', 'admin@example.org'],
      ['Designer name', 'Dana Designer'],
      ['Designer email', 'designer@example.org'],
      ['Sprint cap per year', '6'],
      ['Form edit link', 'https://docs.google.com/forms/d/FORM_REQUEST_ID_0000000000/edit'],
      ['Design feedback form edit link', 'https://docs.google.com/forms/d/FORM_FEEDBACK_ID_0000000000/edit'],
      ['Change form edit link', 'https://docs.google.com/forms/d/FORM_CHANGE_ID_0000000000/edit'],
      ['Drive Parent Folder', folderUrls.parent || ''],
      ['Pastor name', 'Pat Pastor'],
      ['Pastor email', 'pastor@example.org'],
      ['Included revision rounds', '2'],
      ['Brand header text', 'Calvary Communications'],
      ['Brand header color', '#00b5e2'],
      ['Brand font', 'Georgia'],
      ['Brand header font', 'Montserrat'],
      ['Designer handles', 'Level 1, Series']
    ],
    Requests: [REQ_HEADERS,
      req({ 'Request ID': 'REQ-2026-002', 'Submitted': new Date(2026, 9, 15, 19, 10), 'Requester': 'Pat Pastor', 'Requester Email': 'pastor@example.org', 'Ministry': 'Sermon Series', 'Event / Initiative': 'A New Thing', 'Event Date': new Date(2027, 0, 3), 'Suggested Tier': 'Series', 'Final Tier': 'Series', 'Mode': 'Series (multi-week)', 'Status': 'Planned', 'Flags': 'COMPRESSED: 60 days of runway, Series needs 63', 'Needs Design': 'Yes', 'Design Items': 'Series key art / main graphic', 'Design Folder': folderUrls.series || '', 'Request Type': 'Sermon Series', 'Series Weeks': '5', 'Design State': 'Approved', 'Design Round': '1', 'Design Feedback Log': 'Nov 16 | Round 1 from Pat Pastor: drop the pink\nNov 16 | APPROVED' }),
      req({ 'Request ID': 'REQ-2026-006', 'Submitted': new Date(2026, 10, 3, 11, 37), 'Requester': 'Kara Kids', 'Requester Email': 'kids@example.org', 'Ministry': 'Calvary Kids', 'Event / Initiative': 'CK Movie Night graphic', 'Event Date': new Date(2026, 10, 25), 'Suggested Tier': 'Design', 'Final Tier': 'Design', 'Mode': 'Design only', 'Status': 'Planned', 'Needs Design': 'Yes', 'Design Items': 'Social graphic, Slide / screen graphic', 'Design Folder': folderUrls.kids || '', 'Request Type': 'Design Only', 'Design State': 'In Review', 'Design Round': '2', 'Message to Requester': 'Round 2 is ready for your review.' }),
      req({ 'Request ID': 'REQ-2026-008', 'Submitted': new Date(2026, 10, 4, 14, 58), 'Requester': 'Alex Admin', 'Requester Email': 'admin@example.org', 'Ministry': 'Pastoral / Staff', 'Event / Initiative': 'Christmas at Calvary', 'Event Date': new Date(2026, 11, 23), 'Suggested Tier': 'Level 1', 'Final Tier': 'Level 1', 'Mode': 'Sprint', 'Status': 'Planned', 'Needs Design': 'Yes', 'Design Items': 'Main graphic / key art', 'Design Folder': folderUrls.xmas || '', 'Request Type': 'Promotion', 'Design State': 'In Review', 'Design Round': '0' }),
      req({ 'Request ID': 'REQ-2026-010', 'Submitted': new Date(2026, 10, 18, 9, 0), 'Requester': 'Kara Kids', 'Requester Email': 'kids@example.org', 'Ministry': 'Calvary Kids', 'Event / Initiative': 'Easter Egg Hunt', 'Event Date': '3/27/2027', 'Suggested Tier': 'Level 2', 'Status': 'Needs Review', 'Needs Design': 'No', 'Request Type': 'Promotion' })
    ],
    Timeline: [TL_HEADERS,
      task('REQ-2026-002-07', 'REQ-2026-002', 'A New Thing', 'Sun, Nov 29, 2026', 'Design', 'FINAL assets delivered to request folder', 'Designer', 'Series', 'Not started'),
      task('REQ-2026-002-11', 'REQ-2026-002', 'A New Thing', 'Sun, Dec 20, 2026', 'Stage', 'Pastor announces the series from stage', 'Pastor', 'Series', 'Not started', 'Pat Pastor', 'pastor@example.org'),
      task('REQ-2026-006-V2', 'REQ-2026-006', 'CK Movie Night graphic', 'Fri, Nov 20, 2026', 'Design', 'Review the Round 2 update: approve or request changes', 'Ministry Leader', 'Design', 'Not started', 'Kara Kids', 'kids@example.org'),
      task('REQ-2026-006-03', 'REQ-2026-006', 'CK Movie Night graphic', 'Sun, Nov 8, 2026', 'Design', 'FINAL design files in the request folder', 'Michael', 'Design', 'Done'),
      task('REQ-2026-008-16', 'REQ-2026-008', 'Christmas at Calvary', 'Wed, Nov 18, 2026', 'Stage', 'Stage announcement + bulletin listing begin', 'Michael', 'Level 1', 'Not started'),
      task('REQ-2026-008-16', 'REQ-2026-008', 'Christmas at Calvary', 'Wed, Nov 18, 2026', 'Stage', 'Stage announcement + bulletin listing begin', 'Michael', 'Level 1', 'Not started'),
      task('REQ-2026-008-17', 'REQ-2026-008', 'Christmas at Calvary', 'Wed, Dec 2, 2026', 'Social', 'Ramp social; distribute invite cards', 'Michael', 'Level 1', 'Not started')
    ]
  };
}

module.exports = { hubTabs };
