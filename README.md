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

## On her phone

Open the site in Safari (iPhone) or Chrome (Android) and use **Share → Add to Home Screen**. It opens full-screen with its own icon.

## Deploy

Every push to `main` builds and deploys to GitHub Pages ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

GitHub Pages only hosts the app's files, not the data. For data that syncs across devices, use Supabase below.

## Turn on sync (Supabase, free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
3. In **Authentication → URL Configuration**, add the site URLs (the GitHub Pages URL, and `http://localhost:5173` for development) to the redirect URLs.
4. From **Project Settings → API**, copy the project URL and anon key:
   - Locally: copy `.env.example` to `.env.local` and fill them in.
   - For the deployed site: add them as repository **variables** (Settings → Secrets and variables → Actions → Variables) named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then re-run the deploy.
5. Sign in with an email magic link, using the same email on every device.

Row-level security makes sure each account only sees its own schedule. The anon key is meant to be public.

## Tech

Vite · React · TypeScript · Supabase · GitHub Pages
