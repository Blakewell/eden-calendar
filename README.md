# Eden's Day

A simple, calm daily schedule for Eden, built for her phone. One day at a time: what's set, what she wants to get done, and how much free time is left.

## Four kinds of things, four soft colors

| Kind | Color | What it's for | Example |
| --- | --- | --- | --- |
| **Routine** | blue | Fixed blocks that repeat on chosen weekdays (or happen just once) | School, band practice |
| **Daily goal** | sage | Time to spend on chosen days, optionally between a start and end date | Reading 30 min, clarinet 20 min until Dec 18 |
| **Assignment** | clay | Flexible work planned for a day, with an estimated time and optional due date. Unfinished ones carry over to today | Science lab write-up, 1h, due Mon |
| **Fun** | rose | Optional plans for a day, at a time or "sometime" | Friend's house, movie night |

The day view shows routine and timed fun blocks with the **free gaps** between them. It also shows how much goal and assignment time is left against the free time she has.

**My week** holds everything that repeats, plus separate wake and sleep times for weekdays and weekends.

## Run it

```bash
npm install
npm run dev
```

With no configuration the app runs in **local mode**, which saves to the browser it's open in.

## Tests

```bash
npm test            # unit + component tests (Vitest, Testing Library)
npm run test:watch  # while developing
supabase test db    # database security tests (needs Docker; runs in CI)
```

- `src/lib/*.test.ts`: scheduling rules (which routines, goals and assignments show on a day; carry-over; free time; weekend hours)
- `src/components/Planner.test.tsx`: the app as Eden uses it (adding, editing, checking off, My week)
- `supabase/tests/database/`: row-level security (nobody sees anyone else's data; signed-out visitors get nothing) and the invite-only sign-up check

Every pull request runs lint, type checks, all tests and a build ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). `main` only accepts changes through a pull request with those checks passing.

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

## Local development with sync

`.env.local` (git-ignored) holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; copy `.env.example` to start. Sign-in is Google only (email sign-in is turned off), limited to the test users on the Google OAuth consent screen. Each account only sees its own schedule (row-level security).

## Tech

Vite · React · TypeScript · Supabase · GitHub Pages
