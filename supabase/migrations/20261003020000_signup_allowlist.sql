-- Invite-only: new accounts are created only for emails on this list.
-- The list lives in a schema the API doesn't expose; add people with
--   insert into private.allowed_emails (email) values ('someone@gmail.com');
-- (run in the SQL Editor or with `supabase db query --linked`). Emails are
-- kept out of this public repo on purpose.

create schema if not exists private;

create table if not exists private.allowed_emails (
  email text primary key check (email = lower(email))
);

-- Called by Supabase Auth before it creates any user (see config.toml).
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
as $$
begin
  if exists (
    select 1 from private.allowed_emails where email = lower(event -> 'user' ->> 'email')
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'This app is invite-only.')
  );
end;
$$;

grant usage on schema private to supabase_auth_admin;
grant select on private.allowed_emails to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
