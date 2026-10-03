-- Run this once in Supabase → SQL Editor.

create table if not exists public.schedule_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  start_time  time not null,
  end_time    time,
  title       text not null,
  notes       text not null default '',
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists schedule_items_user_date on public.schedule_items (user_id, date);

-- Each signed-in person only ever sees and changes their own items.
alter table public.schedule_items enable row level security;

create policy "own items: select" on public.schedule_items
  for select using (auth.uid() = user_id);
create policy "own items: insert" on public.schedule_items
  for insert with check (auth.uid() = user_id);
create policy "own items: update" on public.schedule_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own items: delete" on public.schedule_items
  for delete using (auth.uid() = user_id);
