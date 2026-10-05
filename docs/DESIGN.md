# Eden's Day: design

How the app works and why. Keep this current: every change that affects what Eden sees, the data, or how things are built updates this file in the same pull request (see `CLAUDE.md`). The README covers setup and deployment.

## Purpose

A calm daily schedule, designed first for Eden (a teen) and used mostly on a phone. Each invited family member has their own schedule. It answers three questions about any day: what's fixed, what she wants to get done, and how much free time is left.

## Principles

- **Simple, calm, clean.** Soft colors, whitespace, gentle copy. Red is only for errors and "overdue".
- **Phone first.** Designed at 375px wide: no sideways scrolling, tap targets at least 40px, text inputs at least 16px. Installable to the home screen, with a clock icon: school at 12, a dumbbell at 3, a music note at 6 and zzz at 9 on soft color triangles (`public/favicon.svg`; `node scripts/make-icons.mjs` renders the PNGs).
- **Four kinds, four colors**, used the same way everywhere.
- **Easy to adjust.** Tap anything to change it; −/+ steppers for lengths.
- Light and dark mode: follows the phone by default and can be set in the menu.

## The four kinds

| Kind | Color | What it is | On the calendar? |
| --- | --- | --- | --- |
| Routine | blue | Set times on chosen weekdays, or just once (school, band) | Always |
| Daily goal | sage | Minutes to spend on chosen days, optionally between two dates; checked off per day | When it has a usual start time ("At a time"), or when an Anytime goal is scheduled for that day |
| Task | clay | Flexible work planned for a day (homework, chores…), with an estimate and optional due date; unfinished ones carry over to today | When scheduled for that day |
| Fun | rose | Optional plans on a day | When timed; otherwise listed under "Maybe today" |

## Time: 10-minute chunks, 5-minute steps

The calendar draws 10-minute chunks (`CHUNK` in `src/lib/plan.ts`), but lengths and times move in 5-minute steps (`STEP`), so things like a 15-minute goal fit:

- Each hour on the day calendar is six chunks, drawn as faint lines with a stronger line on the hour.
- Lengths step by 5 minutes (goals and tasks).
- Time pickers step by 5 minutes. New items default to the next 10-minute mark.
- Tapping an empty chunk on the calendar starts adding something at that 10-minute mark.
- Dragging a block snaps it to 5 minutes (half a chunk).
- One-tap Schedule starts on a 5-minute mark.
- Free gaps shorter than 5 minutes aren't shown.

Times between the lines (such as 2:05 or school at 7:45) are drawn at their exact position.

## Screens and navigation

The layout is a native-app style: a top bar, the page, and tabs along the bottom.

**Top bar**
- **Whose day** (left): "Your day". Once someone has shared their day with you it becomes a picker ("Your day ▾"), listing your day first, then each accepted share ("Sam's day"). On someone else's day it reads "Sam's day ▾" with a *view only* tag. The app always opens on your own day.
- **+** (right): adds something; it asks which kind. It's hidden on someone else's day and on Share my day.
- **☰ menu** (right): a dot shows when an invite is waiting.

**Tabs** (bottom, fixed; the app opens on Calendar)

| Tab | Page |
| --- | --- |
| Calendar | The day: date and summary, what's still to fit in, then the calendar |
| To do | The same date and summary, then the checklists: Daily goals, Tasks, Maybe today. The tab shows how many goals and tasks are left (`todoLeft`). |
| Plans | Everything that repeats or is coming up, one section per kind |

**Menu**

| Item | Page |
| --- | --- |
| Awake hours | When you get up and go to bed, weekdays and weekends (a setting) |
| Share my day | Invite someone to see your day; see who can; days shared with you (signed in only) |
| *Appearance* | Auto / Light / Dark (see below) |
| *Account* | Photo, name, "Signed in as …" and **Sign out** (synced mode); "Saved on this device" (local mode) |

No tab is current on Awake hours or Share my day. Tapping the menu's backdrop or pressing Escape closes it.

**Appearance** is per device and stored in this browser (`src/lib/theme.ts`), not synced. **Auto** follows the phone's setting. Light or Dark sets `data-theme` on `<html>`, which overrides the system color scheme in `index.css`, and updates the browser's theme color. It's applied before the first paint, so the page never flashes the wrong colors.

### Calendar and To do (the day)

1. Greeting (today only), weekday and date, ←/Today/→ to change day.
2. **Summary:** a progress bar that fills as the day's goals and tasks are checked off, in their colors ("3 of 7 done"; no bar when there's nothing to check off). Then free time (on today, only from now until bedtime, `freeFrom`; other days count the whole awake day) against time still to fit in (anytime goals not yet done plus open tasks), with a gentle note when it doesn't fit. Goals with a start time already have a slot, so they aren't counted again. On today it also shows how long is left until bedtime ("9h 15m until bedtime (10:30 PM)", `untilBedtime`).
3. **Still to fit in** (Calendar tab only): a chip for each goal and task that isn't done and has no time yet (`toFitIn`), in its kind's color with its length, so what's left is visible without leaving the calendar. Tapping a chip schedules it like the **Schedule** button. Hidden when there's nothing left, and on a day that's gone. View only on someone else's day.
4. **Schedule:** the day calendar. Hours run down the left, from awake time to bedtime (stretched to whole hours, and further if something falls outside). Routines, timed fun and timed goals are placed at their real times and heights. Overlapping blocks sit side by side. Free gaps of 30 minutes or more are labelled. A line marks the current time, and the block happening now is tinted with a "now" tag. Timed goals that are checked off look done.

   **Moving things:** timed goals and timed fun can be dragged to a new time. Routines are fixed. On a touch screen, hold a block briefly (300ms) and then drag; a quick swipe still scrolls the page. With a mouse, just drag. A tap still opens the editor. Fun keeps its length. **A daily goal moves for that day only**: it saves a one-day exception, and its usual time (set in the editor) is unchanged. Dragging it back to its usual time clears the exception. A short hint under Schedule explains this when something on the day can move.
5. **Scheduling goals and tasks** (all for that day only):
   - **One tap:** each Anytime goal and unscheduled task on the To do tab has a **Schedule** button, and tapping it switches to Calendar. It goes into the first free gap long enough for it, starting on a 5-minute mark and, on today, no earlier than now (`findSlot`). A status line says where it went ("Reading is on at 6:00 PM. Drag it to move it."), or gently says nothing fits.
   - **Tap an empty spot:** the picker first offers the day's unscheduled goals and tasks ("Fit something in at 3:00 PM"), unless that spot has already passed, then "Or add something new" with the four kinds.
   - Once on the calendar it can be dragged like anything else, is checked off as usual, and no longer counts in "to fit in".
   - **No scheduling into the past:** a goal or task that isn't done can't be put into time that has already passed (`earliestStart`): today it goes from now on, and on a day that's gone it can't be scheduled at all (no Schedule buttons, not offered when tapping a spot, can't be dragged). Dragging it earlier stops at now. Once it's checked off it can be moved anywhere, to show when it really happened. Routines and fun aren't affected, and anything already on the calendar stays where it is.
   - Its editor offers **Take it off the calendar for this day** (Anytime goals and tasks go back to the checklist) or **Back to its usual time** (timed goals).
6. **Daily goals** checklist (all goals for the day, showing time when set), **Tasks** checklist, and **Maybe today** (untimed fun). Each checklist shows how many are left beside its heading ("2 left", or "All done"), lists what's left first, and folds finished ones under a closed **Done (n)** that opens to uncheck them. When everything is checked off, a line says so ("All done for today. Nice work."). Right after checking something off, a bar just above the tabs offers **Undo** for 5 seconds ("Reading done."); unchecking needs no undo.
7. The **+** in the top bar asks which kind, then opens the editor.

### Plans

Everything that repeats or is coming up, one section per kind in the legend's order, each with its color dot and its own **+ Add** (which opens the editor on that kind). Tap anything to change it.

- **Routines:** weekly ones, then **Just once, coming up** (one-offs from today on).
- **Daily goals:** goals going now; **Starting later** (start date in the future) and **Finished** (end date passed; dimmed) are folded away with a count.
- **Tasks:** every open task on any day, overdue first, then by the day it's planned for (`openTasks`). Carried-over ones read "from Fri, Oct 2". Tasks done in the last two weeks are folded under **Done lately** (`recentlyDone`).
- **Fun:** today through the next two weeks (`funAhead`, `PLANS_DAYS`), timed or "sometime".

Each section has a short empty line when there's nothing in it. On someone else's day it's view only, with no add buttons.

### Awake hours

In the menu, as a setting: up and bed times for weekdays and weekends separately. An empty bedtime means midnight.

### Sharing a day

One person invites another by email to see their day: **view only**, **one-way**, and **everything** (routines, goals, tasks, fun). Only people on the allowlist can sign in, so only they can ever see or accept an invite. An invite to any other address does nothing, and the sender isn't told either way.

- **Share my day** page: an email field and **Send invite** (catches typos, inviting yourself, and inviting someone twice). **Who can see your day** lists each invite as *Invite sent*, *Can see your day* or *Said no thanks*, with **Cancel** / **Stop sharing**. **Shared with you** lists days you can view (**View**, **Remove**) and invites waiting for an answer.
- **Notifications:** a new invite shows as a calm alert at the top of your own pages ("Sam wants to share their day with you." with **Accept** / **No thanks**), and the menu button gets a dot (its label says how many). Invites refresh when the app opens, when it comes back into view, and every minute while it's open. They're in-app only: no email or push.
- **Viewing:** pick "Sam's day" in the top-left picker. It reads "Sam's day ▾" with a *view only* tag, and the greeting reads "Sam's day". Pick "Your day" to go back. All pages show their data with nothing to add, edit, drag, schedule or check off. If they stop sharing while you're looking, it goes back to your own day at the next refresh.
- Either side can end it at any time: the owner with **Stop sharing**, the viewer with **Remove**.

### Editor

One dialog for all four kinds, used to add, change and remove. Goals have: what, how long (stepper), when (Anytime or At a time with a start), which days (with Weekdays / Weekends / Every day presets), and optional start and end dates. Removing a goal also removes its check-offs.

## Data

A flat list of records (`src/lib/types.ts`), stored either in the browser (local mode) or in Supabase's `public.records` table as `(user_id, id, kind, data jsonb)`.

| Kind | Fields |
| --- | --- |
| `routine` | title, start, end, days, date (one-off) |
| `goal` | title, minutes, start (usual time, HH:MM, or null for Anytime), moved (date → HH:MM: where it goes that day, from a drag or Schedule), days, from, until |
| `task` | title, minutes, date, due, doneOn, at (`{date, start}` when scheduled on the calendar for one day) |
| `fun` | title, date, start, end |
| `check` | goal id + date (a goal done on a day) |
| `settings` | awake hours for weekdays and weekends |

New fields go in `data` and must be optional for records saved earlier. Example: goals saved before `start` and `moved` existed are read as Anytime with no moves, and tasks without `at` as unscheduled (`split` in `plan.ts`). A task's `at` is kept when it's edited, unless its planned day changes. When a goal is moved, `moved` entries for past days are dropped. Changing a goal's usual time in the editor clears its `moved` entries.

Dates are local `YYYY-MM-DD` strings and times are `HH:MM`.

## Architecture

- Vite, React and TypeScript, with no router or UI library. Plain CSS in `src/index.css`, with colors as tokens for light and dark.
- `src/lib/plan.ts` holds all the day logic as pure functions: what applies on a date, the calendar's blocks, free time, side-by-side layout, the calendar range and moves (`moveTo`, `goalStartOn`). Components stay thin.
- `DayCalendar` handles dragging with pointer events. A non-passive `touchmove` listener on the grid stops the page from scrolling only while a drag is active.
- `Planner` owns the current page, the selected date, the open editor and the menu. Pages are `DayView` (with `DayCalendar`), `Plans` and `AwakeHours`. `Menu` handles navigation and sign-out.
- `Store` interface: `localStore` (browser) or `supabaseStore` (synced), chosen by whether the Supabase env vars are set.

## Environments

| Environment | Database | How |
| --- | --- | --- |
| Live | Supabase project `jhwqsgmcyjjhntksplep` (Free plan) | GitHub Pages; deployed on merge to `main` |
| Local mode | None (browser storage) | `npm run dev`; also used by Playwright |
| Local Supabase | Docker, built from `supabase/migrations/` | `supabase start` then `npm run dev:supabase` |
| CI database | Throwaway Docker Postgres | `supabase db start` and `supabase test db` on every pull request |
| Live from a laptop | Live | `npm run dev:live` (on purpose only) |

There's deliberately no second hosted project. Local Supabase gives a dev database for $0 without keeping two projects' migrations and auth settings in step. `npm run dev` ignores `.env.local`, so day-to-day development can't change Eden's real data by accident.

## Access

**Sharing** (`supabase/migrations/20261004000000_shares.sql`) uses a `public.shares` table (owner, owner email and name, invitee email, invitee id, status). It's its own table rather than a record kind because two different people read it. Its rules:
- The owner sees invites they sent; the invitee sees invites addressed to their sign-in email. Nobody else sees any.
- Inserting names only the invitee's email. A trigger sets the owner (from the sign-in token), their name and email, and `pending`. You can't invite yourself, and each person can be invited once.
- There is no update. Accepting or declining goes through `respond_to_share()`, which only touches an invite addressed to the caller's email.
- Either side can delete.
- `records` gains a read-only policy: you can read someone's records if they shared with you and you accepted (`sharing.can_view_day_of`). Writes stay owner-only.
- The helper functions live in a `sharing` schema that the API doesn't expose, separate from `private`, which holds the allowlist the app must never read.
- The app always loads one person's records (`user_id = …`), so shared rows never mix into your own day.

Each person signs in with Google. Their name and photo come from their Google profile (`src/lib/profile.ts` reads Supabase's `user_metadata`, refreshed at every sign-in). The day view greets them by first name, and the menu shows their photo (or their initial), name and email. Local mode has no profile, so the greeting has no name.

Google sign-in only, invite-only (Google OAuth Testing mode plus a database allowlist hook). Row-level security means each account sees only its own records. Sign out is in the menu.

## Testing

| Layer | Tool | Where |
| --- | --- | --- |
| Logic | Vitest | `src/lib/*.test.ts` |
| Sharing against a real database | Ad hoc: the app's sharing code run against `supabase start` with local test users | Not in CI (needs the full local stack) |
| Components, as Eden uses them | Testing Library + user-event (jsdom) | `src/components/*.test.tsx` |
| Real browser at phone size, light and dark | Playwright (Chromium, 375×812) | `e2e/*.spec.ts` |
| Database access rules | pgTAP | `supabase/tests/database/` |

All of these run on every pull request in CI. Unit and component tests freeze time to Saturday Oct 3 2026, 1:15 PM. Playwright tests run the app in local mode, so they need no sign-in.

## Change log

- **2026-10-05:** Free time on today counts only from now until bedtime, so at 7 PM it's never more than the time left before bed.

- **2026-10-05:** Usability pass on what's left. To do lists what's left first, with a count beside each heading, and folds finished goals and tasks under **Done**. The Calendar tab shows **Still to fit in**: one chip per unscheduled goal or task, tapped to schedule it. The summary bar now shows progress (how many goals and tasks are checked off) instead of time to fit in against free time, and checking something off offers **Undo** for a few seconds.

- **2026-10-04:** New home-screen icon, chosen by Eden: a clock with a school at 12, a dumbbell at 3, a music note at 6 and zzz at 9, on soft color triangles. The browser-tab icon matches.

- **2026-10-04:** A **Plans** tab replaces Goals: routines, daily goals, tasks (all open ones, on any day) and fun for the next two weeks, each with its own add button. My week is gone; its awake hours are now **Awake hours** in the menu. Assignments are renamed **Tasks** (the stored kind was already `task`). Unfinished goals and tasks can't be scheduled into time that has already passed.

- **2026-10-04:** Lengths, time pickers, dragging and one-tap Schedule move in 5-minute steps (the calendar still draws 10-minute chunks). The summary shows time left until bedtime today; no bedtime means midnight.

- **2026-10-04:** Bottom tabs (Calendar / To do / Goals) replace scrolling from the calendar down to the checklists. A top-left picker switches between your day and days shared with you (always opening on yours). **+** moves to the top bar, and the color legend moves under Schedule. The menu keeps My week, Share my day, Appearance and account. One-tap Schedule on To do switches to Calendar to show where it went.

- **2026-10-04:** Share your day by invite: view only, one-way, allowlisted people only. In-app invite alerts, a Share my day page, and viewing a shared day from the menu.

- **2026-10-03:** Greet whoever is signed in by their Google first name (was always "Eden"); their photo and name are in the menu. More family members can be invited (allowlist plus Google test users).

- **2026-10-03:** Schedule Anytime goals and assignments onto the calendar for a day: one-tap **Schedule** (next free gap), or tap an empty spot and pick one. Unschedule from the editor.

- **2026-10-03:** Safe development: `npm run dev` is always local mode; `dev:supabase` (local Docker Supabase) and `dev:live` (explicit) added.

- **2026-10-03:** Drag timed goals and fun to move them (a goal moves for that day only). Appearance setting (Auto / Light / Dark) in the menu.

- **2026-10-03:** Menu (Today / Daily goals / My week / Sign out). Daily goals page for adding, changing and removing goals. Goals can have a start time and appear on the calendar. The day view's schedule became a calendar in 10-minute chunks, with tap-to-add and side-by-side overlaps. Steppers and time pickers move in 10-minute steps. Added Playwright browser tests to CI.
