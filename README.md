# Eden's Day

A simple, calm daily schedule for Eden, built for her phone. One day at a time: what's set, what she wants to get done, and how much free time is left.

## Four kinds of things, four soft colors

| Kind | Color | What it's for | Example |
| --- | --- | --- | --- |
| **Routine** | blue | Fixed blocks that repeat on chosen weekdays (or happen just once) | School, band practice |
| **Daily goal** | sage | Time to spend on chosen days, optionally between a start and end date, and optionally at a set time | Reading 30 min, piano 40 min at 4 PM |
| **Assignment** | clay | Flexible work planned for a day, with an estimated time and optional due date. Unfinished ones carry over to today | Science lab write-up, 1h, due Mon |
| **Fun** | rose | Optional plans for a day, at a time or "sometime" | Friend's house, movie night |

The day view is a calendar in **10-minute chunks** showing routines, timed fun and timed goals, with the **free gaps** between them. Tap an empty spot to add something there, or hold and drag a goal or fun plan to move it (routines stay put; a goal moves for that day only). It also shows how much goal and assignment time is left against the free time she has.

The **menu** (☰) moves between **Today**, **Daily goals** (add, change and remove goals) and **My week** (routines and separate wake and sleep times for weekdays and weekends), and has **Appearance** (Auto / Light / Dark) and **Sign out**.

How it all works is in [docs/DESIGN.md](docs/DESIGN.md).

## Run it

```bash
npm install
npm run dev
```

`npm run dev` always runs in **local mode**, which saves to the browser it's open in and needs no sign-in. It never touches the live database. See [Developing safely](#developing-safely) for the other ways to run it.

## Tests

```bash
npm test            # unit + component tests (Vitest, Testing Library)
npm run test:watch  # while developing
npm run test:e2e    # real-browser tests at phone size (Playwright; first run: npx playwright install chromium)
supabase test db    # database security tests (needs Docker; runs in CI)
```

- `src/lib/*.test.ts`: scheduling rules (which routines, goals and assignments show on a day; carry-over; free time; weekend hours)
- `src/components/Planner.test.tsx`: the app as Eden uses it (adding, editing, checking off, the calendar, the menu, Daily goals, My week)
- `e2e/`: the same flows in a real browser at 375px, in light and dark mode
- `supabase/tests/database/`: row-level security (nobody sees anyone else's data; signed-out visitors get nothing) and the invite-only sign-up check

Every pull request runs lint, type checks, unit, component and browser tests, and a build ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). `main` only accepts changes through a pull request with those checks passing.

## On her phone

Open the site in Safari (iPhone) or Chrome (Android) and use **Share → Add to Home Screen**. It opens full-screen with its own icon.

## Deploy

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. **Database:** applies new migrations in [`supabase/migrations`](supabase/migrations) and pushes auth settings from [`supabase/config.toml`](supabase/config.toml).
2. **App:** builds and publishes to GitHub Pages at https://blakewell.github.io/eden-calendar/.

GitHub Pages hosts only the app. The data lives in Supabase.

### Repository settings the workflow uses

| Name | Kind | What |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | variable | Project URL |
| `VITE_SUPABASE_ANON_KEY` | variable | Publishable key (safe to be public) |
| `SUPABASE_PROJECT_REF` | variable | Project ref |
| `SUPABASE_ACCESS_TOKEN` | secret | Personal access token from supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_PASSWORD` | secret | Database password |
| `GOOGLE_CLIENT_ID` | variable | Google OAuth client ID (for Google sign-in) |
| `GOOGLE_CLIENT_SECRET` | secret | Google OAuth client secret |

Without the secrets, the database step is skipped and the app still deploys.

### Changing the database

Add a new file to `supabase/migrations/` (e.g. `supabase migration new add_something`), commit, and push to `main`.

## Developing safely

There is one hosted database, and it's **live**: Eden's real schedule. Development and tests stay off it by default.

| Command | Data goes to | Sign-in | Use it for |
| --- | --- | --- | --- |
| `npm run dev` | This browser only (local mode) | None | Almost everything: UI and logic changes |
| `npm run dev:supabase` | A local Supabase in Docker | Google (setup below) | Changes to sync, sign-in, migrations or access rules |
| `npm run dev:live` | **The live database** | Google | Rarely: checking something against real data. Port 5173 |

None of the tests touch the live database. Unit and component tests use an in-memory store, Playwright runs the app in local mode, and `supabase test db` builds a throwaway database from the migrations.

### Local Supabase (`npm run dev:supabase`)

Needs Docker (Docker Desktop, OrbStack or Colima; all free for personal use). `supabase start` builds the database from `supabase/migrations/`, the same as CI.

```bash
supabase start          # first run downloads the images
npm run dev:supabase    # app at http://localhost:5173
supabase test db        # database security tests
supabase stop           # when done
```

To sign in locally with Google (one-time setup):

1. In Google Cloud Console, under the OAuth client, add `http://127.0.0.1:54321/auth/v1/callback` as an authorized redirect URI.
2. Create `supabase/.env` (git-ignored) with `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=` set to the client's values, then `supabase stop && supabase start`.
3. Allow your account in the local database (the sign-up allowlist starts empty): `supabase db query "insert into private.allowed_emails (email) values ('you@example.com')"`, using your address. This targets the local database because there's no `--linked`.

Local Studio (at http://127.0.0.1:54323) shows the local data.

### Live (`npm run dev:live`)

`.env.local` (git-ignored) holds the live `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; copy `.env.example` to start. Only `npm run dev:live` reads it. Sign-in is Google only (email sign-in is turned off), limited to the test users on the Google OAuth consent screen. Each account only sees its own schedule (row-level security).

## Tech

Vite · React · TypeScript · Supabase · GitHub Pages
