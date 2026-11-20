# Calvary Communications App

One app for all staff communications. It replaces the Google Form, the Communications Hub spreadsheet and Google Tasks. Leaders submit requests, the communications team reviews them and assigns a tier, the app builds the timeline and assigns every task, the designer gets the brief, and design review rounds happen inside the app.

It runs as a web app in the church's Google account. It's free, staff sign in with their church Google login, emails go out through Gmail, and approved requests sync to the shared Master calendar.

## How a request flows

1. **Submit** (*New Request*). The same questions and branching as the old Google Form: event promotion, sermon series, or design only. A notice check shows how many weeks of runway the requester is giving, and attachments go into the request's Drive folder. The requester and the communications team get an email.
2. **Review** (communications team). The app suggests a tier from the audience answers (Level 1–4, Series, Design). You confirm or change it, see the runway against that tier's requirement, and choose **Approve & build plan**, **Ask for more info** or **Decline**. The Level 1 Sprint cap is enforced, with an override.
3. **Plan.** On approval, the timeline is built from the tier's template. These are the same steps and lead times the hub used (Level 1: 25 steps from 84 days out, Series: weekly posts for each week, and so on). Steps that are already late are moved to today and marked *Compressed*. Every step is assigned to a person:
   - **Comms** steps go to the communications director.
   - **Designer** steps go to the staff designer, for the tiers listed in *Designer handles*.
   - **Pastor** steps go to the pastor.
   - **Leader** steps go to whoever submitted the request.
4. **Brief.** For Level 1 and Series, the designer gets a full design brief by email. Other tiers are designed in-house.
5. **Design rounds.** The designer (or comms) uploads a draft, and the requester is asked to review it. The requester either **approves** it or **requests changes** in one message, which counts as one round. After the included rounds (default 2), further feedback is held until the communications team allows or declines another round. Approval leads to the final files, then *Delivered*.
6. **Changes.** *Something changed* covers a new date (the communications team applies it, and open tasks shift by the same number of days), design or communications changes, and cancellations (open tasks close and the calendar events are removed).
7. **Done.** When every task is checked off, the request becomes Done. Results can be logged after the event.

Everyone also gets **My Tasks** (check-off list), **My Requests**, **Calendar** (month view by tier, including Level 1 Sprint windows), **All Requests**, and **Timeline** (the team's open work by week). The designer and admins get the **Design Queue**. Admins get **Admin**, where people, roles and settings are edited. A **weekly digest** email goes out Monday mornings.

## Setup (about 15 minutes)

Use the Google account that should own the system and send its emails (yours, or a comms@ account).

1. Go to [script.google.com](https://script.google.com), choose **New project**, and name it *Communications App*.
2. Copy in the **3 files from the `dist/` folder**:
   - **`Code.gs`**: replace everything in the editor's existing `Code.gs` with this file.
   - **`Index.html`**: click **+ → HTML**, name it `Index` (the editor adds `.html`), and paste in this file.
   - **`appsscript.json`**: open ⚙ *Project Settings*, turn on **Show "appsscript.json" manifest file in editor**, go back to the editor, open `appsscript.json`, and replace its contents with this file.

   Click 💾 **Save**.
3. Choose **`setup`** in the function dropdown, click **Run**, and approve the permissions. This creates the locked data file, makes you an admin, and schedules the Monday digest.
4. Choose **`importFromHub`** and click **Run**. This brings over everything from the old hub: settings (brand, sprint cap, rounds, calendar, Drive folder, ministries), people and roles, all requests, timeline tasks and design feedback history. It can safely be re-run.
5. Choose **Deploy → New deployment → Web app**, set *Execute as* to **Me** and *Who has access* to **Anyone within Calvary**, then share the link.
6. Open **Admin** in the app and check *People* and *Settings*. Staff who aren't listed are added automatically the first time they open the app.

When the app is live, turn off the old form (*Responses → Accepting responses*) and the hub's triggers, so requests only come in one way.

## Customizing

- **Settings** (in the app): brand colors and fonts, which tiers the designer handles, sprint cap, revision rounds, turnaround and review days, calendar, Drive folder, ministries, digest.
- **Timeline templates**: `src/Plan.gs` (`TEMPLATES`). Each step is days from the event, a channel, the task, and an owner (`Comms`, `Designer`, `Pastor` or `Leader`). Level 2 had no examples in the hub, so its template is a first draft to adjust.
- **Tier suggestions**: `suggestTier()` in `src/Plan.gs`. **Runway** requirements: `TIER_INFO` in the same file.
- **Form questions**: `src/FormDefs.gs`.

After changing anything in `src/`, run `npm run bundle` and paste the updated `dist/` files into Apps Script. Then choose **Deploy → Manage deployments → Edit → New version**, which keeps the same link.

## Development

```bash
npm run bundle    # rebuild dist/ (the 3 files to paste) after editing src/
npm test          # rebuilds dist/, then runs the tests: timeline templates checked against the hub's real schedules,
                  # plus end-to-end workflow tests against mocked Google services
npm run preview   # renders the real UI with sample data → ./preview/*.png
```
