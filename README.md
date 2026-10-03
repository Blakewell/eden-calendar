# Eden's Day

A simple, calm daily schedule for Eden. One day at a time: what's on, what's happening now, and what's done.

## Features

- Today view with a gentle greeting and quick prev / next / today navigation
- Time blocks with an optional end time and notes
- Tap the circle to check things off; the current block is softly highlighted
- Light and dark themes that follow the device
- Works on phones, tablets and laptops
- Syncs across devices with Supabase, or runs fully on one device with no setup

## Run it

```bash
npm install
npm run dev
```

With no configuration the app runs in **local mode**, which saves to the browser it's open in.

## Turn on sync (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
3. In **Authentication → URL Configuration**, add your site URL (e.g. `http://localhost:5173` for development) to the redirect URLs.
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon key from **Project Settings → API**.
5. Restart `npm run dev`. Sign in with an email magic link; use the same email on every device.

Row-level security makes sure each account only sees its own schedule.

## Tech

Vite · React · TypeScript · Supabase
