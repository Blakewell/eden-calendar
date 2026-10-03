-- Everything (routines, goals, assignments, fun plans, check-offs, settings) lives in one
-- table; `data` holds the fields for each kind.

create table if not exists public.records (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id          text not null,
  kind        text not null check (kind in ('routine', 'goal', 'task', 'fun', 'check', 'settings')),
  data        jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- Each signed-in person only ever sees and changes their own records.
alter table public.records enable row level security;

create policy "own records: select" on public.records
  for select using (auth.uid() = user_id);
create policy "own records: insert" on public.records
  for insert with check (auth.uid() = user_id);
create policy "own records: update" on public.records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own records: delete" on public.records
  for delete using (auth.uid() = user_id);
