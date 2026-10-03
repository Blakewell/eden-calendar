# Eden's Day: project instructions

A daily schedule web app for Eden, a teen, used mainly **on her phone**. Built by her dad (Blake). The README covers features and setup, `docs/DESIGN.md` covers how the app works, and this file is the working agreement for changes.

## Product principles

- **Simple, calm, clean.** Soft colors, lots of whitespace, gentle copy ("A clear day.", "Maybe move something?"). No alarms, red badges, or busy UI. Red (`--danger`) is only for errors and "overdue".
- **Phone first.** Design and verify at 375px wide before desktop. No horizontal scroll, tap targets ≥ 40px, text inputs ≥ 16px (stops iOS zooming in). It's installable to the home screen (manifest + apple-touch-icon); keep that working.
- **Four kinds, four colors.** Keep them distinct and consistent everywhere (cards, legend, editor, summary bar), via the `.kind-*` classes and `--routine|goal|task|fun` tokens:
  - **Routine** (blue): fixed blocks repeating on chosen weekdays, or "just once" (school, band).
  - **Daily goal** (sage): minutes on chosen days, optional start/end dates and an optional start time (then it takes a slot on the calendar); checked off per day.
  - **Assignment** (clay): flexible work planned for a specific day, with an estimate and optional due date; unfinished ones carry over to *today*.
  - **Fun** (rose): optional plans on a day, timed (on the timeline) or "sometime" ("Maybe today"); never counted as work to fit in.
- **Weekdays differ from weekends** (separate awake hours; Weekdays / Weekends / Every day presets).
- **Easy to adjust:** tap anything to edit; −/+ steppers for durations.
- **10-minute chunks:** the day calendar splits each hour into six 10-minute chunks; steppers and time pickers move in 10s (`CHUNK` in `src/lib/plan.ts`).
- **Menu** (☰, top right) for Today / Daily goals / My week, Appearance (Auto / Light / Dark, per device) and Sign out.
- **Drag to move:** timed goals and fun can be dragged on the calendar (hold first on touch). Routines are fixed. A goal moves for that day only.
- Light and dark mode both supported; define colors as CSS tokens in `src/index.css` and check both. Dark tokens live in two places (the `prefers-color-scheme` block and `:root[data-theme='dark']`); keep them identical.

## Architecture

- Vite + React + TypeScript, no router, no UI library. Plain CSS in `src/index.css`.
- Data is a flat list of records (`src/lib/types.ts`: routine, goal, task, fun, check, settings) behind a `Store` interface (`src/lib/store.ts`): `localStore` when Supabase env vars are absent, `supabaseStore` otherwise. All day logic is pure functions in `src/lib/plan.ts`; keep UI components thin.
- Supabase: a single `public.records` table (`user_id`, `id`, `kind`, `data jsonb`) with row-level security. New fields go in `data`; no new tables for new kinds unless there's a strong reason.
- Dates are local `YYYY-MM-DD` strings and times are `HH:MM`; use the helpers in `src/lib/dates.ts` and don't pass `Date` objects around.

## Security and access

- **Google sign-in only.** Email sign-in is turned off (`[auth.email] enable_signup = false`). Don't add other providers without asking. Apple needs a paid developer account.
- **Invite-only:** only `blakewell@gmail.com` and `eden.g.blackwell@gmail.com`.
  - Gate 1: the Google OAuth app stays in **Testing** mode with those two as test users.
  - Gate 2: the `before_user_created` auth hook checks `private.allowed_emails`.
- **Never commit emails, keys, tokens or passwords** to this public repo. Allowlist entries are added directly in the database (`supabase db query --linked`). The Supabase publishable key and Google client ID are public by design and live in GitHub repo **variables**. Secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `GOOGLE_CLIENT_SECRET`) live in repo **secrets**, and the user sets them with `gh secret set`, never through chat.
- Every table gets RLS and explicit grants (this project doesn't auto-grant to `authenticated`). Signed-out (`anon`) gets no table access.

## Cost: keep it at $0 (hard ceiling $5/month)

- GitHub Pages + Actions (free for a public repo) and Supabase **Free plan**. Never upgrade plans, add paid add-ons, or introduce services that bill without asking first.
- Free projects pause after 7 days idle; that's acceptable.

## Environments

- **There is one hosted database and it's live (Eden's real data).** `npm run dev` always runs in local mode (browser storage) and is the default for development and verification. Use `npm run dev:supabase` (local Supabase in Docker) for sync, auth or migration work. Use `npm run dev:live` only when the user asks; it reads and writes real data.
- Tests never touch the live database: unit and component tests use an in-memory store, Playwright uses local mode, and pgTAP uses a throwaway database.

## Workflow

- **Keep `docs/DESIGN.md` up to date.** Any change to what Eden sees, the data, or the architecture updates the design doc (and its change log) in the same pull request.

- **`main` is protected:** changes go through a pull request, and the `App (lint, types, tests, build)` and `Database (migrations, security tests)` checks must pass. Work on a branch and open a PR.
- **Merging to `main` deploys everything** (`.github/workflows/deploy.yml`): `supabase db push` (migrations), `supabase config push` (auth settings from `supabase/config.toml`), then the GitHub Pages build.
- **Database changes** are new files in `supabase/migrations/` only; never edit an applied migration. Add or extend pgTAP tests in `supabase/tests/database/` for anything touching access.
- **Before changing `supabase/config.toml`**, preview with `supabase config push` and answer `n`. The CLI's starter defaults differ from the live project (email confirmations, OTP length, MFA), so keep local values matched to remote except for intended changes.
- **Tests are required** with every change:
  - logic in `src/lib/*.test.ts`
  - user-facing behavior in `src/components/*.test.tsx` (Testing Library + user-event, by role/label)
  - real-browser flows at phone size, light and dark, in `e2e/*.spec.ts` (Playwright, local mode)
  - access rules in pgTAP
  
  Run `npm test`, `npm run test:e2e`, `npx oxlint --deny-warnings` and `npm run typecheck` before pushing. CI runs all of them (plus pgTAP) on every pull request. Tests freeze time to Sat Oct 3 2026 (`src/test/fixtures.ts`).
- Formatting: Prettier with `--single-quote --no-semi --print-width 120`.
- Verify UI changes in a browser at phone width (light and dark) before calling them done.

## Links

- App: https://blakewell.github.io/eden-calendar/
- Repo: https://github.com/Blakewell/eden-calendar
- Supabase project ref: `jhwqsgmcyjjhntksplep` (us-east-2)
