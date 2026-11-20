# Calvary Communications App

One place where staff submit communications requests, track them, and give design feedback, and where the designer works from a queue.

**This app is a front end for the existing Communications Hub (the Google Sheet and its Apps Script automation). It does not replace it.**

- **New requests are submitted through the real Google Form.** The hub's existing automation runs exactly as before: tiers, runway checks, timelines, Google Tasks, the master calendar, Drive folders and the designer brief.
- **The app never edits the hub spreadsheet.** It requests read-only access to Sheets.
- **The form screens are built live from the Google Forms.** Questions, required fields, sections and branching all come from the forms, so editing a form updates the app automatically.

## What people see

| Screen | Who | What it does |
|---|---|---|
| **Home** | Everyone | Dashboard numbers (overdue, due this week, waiting for review, designer load, Level 1 Sprints used vs. cap), *my next tasks*, *my open requests*. Admins also see requests waiting for review. |
| **New Request** | Everyone | The request form with its branching (event promotion / sermon series / design only), runway guidance, a "weeks of notice" check, and file attachments. The email is filled in from the person's Google sign-in. |
| **My Tasks** | Everyone | Timeline tasks for the signed-in person: tasks assigned to them by name, plus tasks whose Owner is *Michael*, *Designer*, *Pastor*, or *Ministry Leader* (that request's submitter). |
| **My Requests** | Everyone | Everything they've submitted, with tier, status, design state and progress. |
| **Request page** | Everyone | All details, flags (e.g. COMPRESSED), the message to the requester, the feedback log, tasks and a visual timeline. Actions: **Request design changes** (feedback form), **Something changed** (change form), **Open Drive folder**, **Upload files** (straight into the request's Design Folder). |
| **Design Queue** | Designer and admin | Open design work sorted by date, filtered to the designer or in-house (based on *Designer handles*), with rounds and the next deadline. |
| **All Requests / Timeline** | Everyone | Searchable list of requests, and every open task grouped by week with a filter by person. |

The app also works on phones.

## Setup (about 10 minutes)

1. **Add two rows to the hub's Config tab** (column A = setting, column B = value):
   - `Design feedback form edit link`: the edit URL of the *Calvary Design Feedback* form
   - `Change form edit link`: the edit URL of the *Change Request* form

   (`Form edit link` is already there.) An edit URL looks like `https://docs.google.com/forms/d/…/edit`. Open the form and copy the address bar.
2. **Create the app.** Go to [script.google.com](https://script.google.com), choose **New project**, and name it *Communications App*. Signed in as the account that owns the hub, create these files with the same names and paste in the contents of `src/`:
   - Script files: `Code`, `Config`, `Data`, `FormLogic`, `Forms`
   - HTML files: `Index`, `App`, `Styles`
   - `appsscript.json`: turn on *Project Settings → Show "appsscript.json"* first

   (Or use [clasp](https://github.com/google/clasp): copy `.clasp.json.example` to `.clasp.json`, add the Script ID, then run `clasp push`.)
3. **Deploy it.** Choose **Deploy → New deployment → Web app**, set *Execute as* to **Me** and *Who has access* to **Anyone within Calvary**, then approve the permissions.
4. **Run one test request.** Submit a request in the app, then check that the hub behaves as it does for a normal form submission (new row, timeline, emails). Cancel the test request afterwards.
5. Share the web app link with staff.

`HUB_SPREADSHEET_ID` in `src/Config.gs` points at the hub. Every other setting is read from the hub's Config tab, including brand colors and fonts, designer and pastor emails, the sprint cap, revision rounds and the Drive parent folder.

## Development

```bash
npm test          # tests run the real server code against mocked Google services
                  # (forms in tests/fixtures/forms.json mirror the live forms)
npm run preview   # renders the real UI in headless Chromium → ./preview/*.png
```

The tests also check that the app never writes to the spreadsheet: the mock throws on any write.
