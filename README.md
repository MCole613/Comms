# Communications Hub

An internal communications app for church staff. A ministry leader fills out **one form**, and the hub:

1. **Builds a timeline** by working back from the event date. Each deliverable they pick (graphics, social, print, video and so on) adds its own production steps. Due dates skip non-work days, and short-notice requests are **compressed proportionally and flagged RUSH**.
2. **Assigns every task based on who submitted it.** Review steps go to the submitter, follow-ups go to *their* assistant, sign-off goes to *their* supervisor (skipped if they don't have one), and production work goes to whoever holds the role. If two designers share the work, new requests go to the less-busy one.
3. **Sends the designer a complete creative brief.** It includes the copy, design notes, deadlines, attachments and a shared Drive folder for final files. *Reply* reaches the submitter directly.
4. **Keeps work moving.** Everyone gets an email with their tasks. When someone marks a step done, the owner of the next step gets a "You're up" email. Every Monday at 7am, each person gets a digest of overdue tasks and tasks due that week.

Staff use four views: **New Request** (with a live preview of the timeline as they fill it out), **My Tasks**, **All Requests** and **Team Timeline** (everyone's open work, week by week, filterable by person).

It runs entirely inside your Google Workspace: a Google Sheet is the database, and Apps Script serves the app. There is nothing to host or pay for, and staff sign in with their church Google accounts.

---

## One-time setup (about 15 minutes)

### 1. Create the spreadsheet and script
1. Create a new Google Sheet named **Communications Hub**. Use the account that should own the system and send its emails, such as a comms@ account.
2. Open **Extensions → Apps Script**.
3. Recreate each file in `src/` in the editor, with the same name, and paste in its contents:
   - Script files (`+` → *Script*): `Code`, `Config`, `Db`, `Notify`, `Setup`, `Timeline`. The editor adds the `.gs` extension itself.
   - HTML files (`+` → *HTML*): `Index`, `App`, `Styles`.
   - `appsscript.json`: first turn on ⚙ *Project Settings → Show "appsscript.json" manifest file*, then paste it in. Change `timeZone` if you are not in US Eastern time.

   *Prefer the command line?* Install [clasp](https://github.com/google/clasp), copy `.clasp.json.example` to `.clasp.json`, add your Script ID, and run `clasp push`.

### 2. Run setup
In the Apps Script editor, choose the **`setup`** function in the toolbar and click **Run**, then approve the permissions. Setup creates these tabs:

| Tab | What it's for |
|---|---|
| **Settings** | App name, work days, minimum notice (default 42 days), fallback person, admins, digest on/off |
| **Team** | Everyone who uses the hub, plus their role, ministry, assistant and approver |
| **Task Templates** | Your production playbook: each deliverable's steps, lead times and owners |
| **Requests** / **Tasks** | Filled in by the app. You can view and filter them, but avoid editing the ID columns. |

It also creates a Drive folder for attachments and schedules the Monday digest.

### 3. Add your real staff on the **Team** tab
Replace the `@example.org` sample rows. The hub never emails `@example.org` addresses, so testing is safe.

| Column | Notes |
|---|---|
| Role | Must match the template **Assignee** names: `Designer`, `Communications Director`, `Social Media`, `Web`, `Video`. Leaders can be `Leadership` or anything else. |
| Assistant Email | Gets that leader's "assistant" tasks, such as distributing flyers and sending the recap. If blank, the task goes to the leader. |
| Approver Email | Gets the "Supervisor sign-off" task on that leader's requests. **Leave this blank for senior leaders who don't need approval.** |
| Active | Set to `No` when someone leaves. |

Communications Directors are automatically admins. Put anyone else who should be able to update any task in **Settings → Admin Emails**.

### 4. Deploy the app
**Deploy → New deployment → ⚙ Web app**
- *Execute as:* **Me**
- *Who has access:* **Anyone within [your organization]**

Copy the web app URL and share it with staff (it's also under the **Comms Hub → Open the app** menu in the sheet). After changing code later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

---

## Customizing the workflow (no code needed)

Edit the **Task Templates** tab:

- **Deliverable**: the checkbox name on the form. Add a new deliverable name and it appears on the form automatically. `Every Request` rows are added to all requests.
- **Step**: the order within a deliverable. When step 1 is completed, the owner of step 2 gets an email.
- **Anchor / Offset Days**:
  - `Event` with `-35` means 35 days before the event (moved to the previous work day).
  - `Event` with `3` means 3 days after the event.
  - `Submitted` with `2` means 2 work days after the form was submitted.
- **Assignee**: `Submitter`, `Submitter's Assistant`, `Submitter's Approver`, or any **Role** from the Team tab. If nobody holds a role, the task goes to **Settings → Fallback Assignee Email**, or to the Communications Director if that is blank.

Other settings: **Work Days** (for example `Tue, Wed, Thu, Fri` if Monday is your day off) and **Minimum Lead Days**.

---

## For developers

```
src/          Apps Script source (what gets deployed)
  Timeline.gs   pure scheduling + assignment logic (unit tested)
  Code.gs       web app entry + API used by the front end
  Notify.gs     all emails (submit confirmation, assignments, designer brief, next step, weekly digest)
  Db.gs         sheet-as-table helpers
  Config.gs     sheet schemas + default seed data
  Setup.gs      setup(), triggers, spreadsheet menu
  Index/App/Styles.html   front end (vanilla JS, no build step)
tests/        Node tests, run against mocked Google services
```

```bash
npm test          # unit + end-to-end tests (mocked SpreadsheetApp, MailApp, DriveApp…)
npm run preview   # renders the real UI in headless Chromium → ./preview/*.png
```
