-- Sharing a day: someone invites another person by email to see their day
-- (view only, one-way). The invitee accepts or declines in the app.
--
-- Only people on the allowlist can sign in, so only they can ever see or
-- accept an invite; an invite to any other address simply does nothing, and
-- the sender isn't told either way.

create table if not exists public.shares (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  owner_email    text not null,
  owner_name     text,
  invitee_email  text not null check (invitee_email = lower(invitee_email)),
  invitee_id     uuid references auth.users (id) on delete cascade,
  status         text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  unique (owner_id, invitee_email)
);

alter table public.shares enable row level security;

-- Helpers for the access rules. Their own schema (not exposed by the API, and
-- separate from `private`, which holds the allowlist the app must never read).
create schema if not exists sharing;

-- The signed-in person's email, from their (Google-verified) sign-in token.
create or replace function sharing.my_email()
returns text
language sql
stable
set search_path = ''
as $$ select lower(auth.jwt() ->> 'email') $$;

-- Owners see the invites they sent; invitees see the invites sent to them.
create policy "shares: owner or invitee can see" on public.shares
  for select using (owner_id = auth.uid() or invitee_email = sharing.my_email());

-- Anyone signed in can invite someone else (the trigger below fills in the rest).
create policy "shares: invite" on public.shares
  for insert with check (owner_id = auth.uid() and invitee_email <> sharing.my_email());

-- Either side can end it: the owner stops sharing, or the invitee removes it.
create policy "shares: owner or invitee can remove" on public.shares
  for delete using (owner_id = auth.uid() or invitee_email = sharing.my_email());

-- New invites always start pending and belong to the person sending them;
-- their name and email come from their sign-in, not from the request.
create or replace function sharing.shares_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.owner_id := auth.uid();
  new.owner_email := sharing.my_email();
  new.owner_name := nullif(trim(coalesce(
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name'
  )), '');
  new.invitee_email := lower(trim(new.invitee_email));
  new.invitee_id := null;
  new.status := 'pending';
  new.created_at := now();
  new.responded_at := null;
  return new;
end;
$$;

create trigger shares_before_insert
  before insert on public.shares
  for each row execute function sharing.shares_before_insert();

-- Accepting or declining goes through this function, so an invitee can only
-- ever change the answer on an invite sent to their own email, and nothing else.
create or replace function public.respond_to_share(share_id uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shares
     set status = case when accept then 'accepted' else 'declined' end,
         invitee_id = case when accept then auth.uid() else null end,
         responded_at = now()
   where id = share_id
     and invitee_email = sharing.my_email()
     and auth.uid() is not null;
end;
$$;

-- Is the signed-in person allowed to see this owner's day?
create or replace function sharing.can_view_day_of(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shares
     where owner_id = owner
       and invitee_id = auth.uid()
       and invitee_email = sharing.my_email()
       and status = 'accepted'
  )
$$;

-- Records: in addition to their own, people can read (only read) the records
-- of anyone who shared their day with them and was accepted.
create policy "shared records: select" on public.records
  for select using (sharing.can_view_day_of(user_id));

-- Start from nothing, then grant exactly what's needed. Insert names only the
-- invitee's email; everything else is set by the trigger. There is no update:
-- answers go through respond_to_share.
revoke all on public.shares from anon, authenticated;
grant usage on schema sharing to authenticated;
revoke execute on all functions in schema sharing from public, anon;
grant execute on function sharing.my_email() to authenticated;
grant execute on function sharing.can_view_day_of(uuid) to authenticated;
grant select, delete on public.shares to authenticated;
grant insert (invitee_email) on public.shares to authenticated;
grant execute on function public.respond_to_share(uuid, boolean) to authenticated;
revoke execute on function public.respond_to_share(uuid, boolean) from public, anon;
