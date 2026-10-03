-- Invite-only sign-up: Supabase Auth calls hook_before_user_created before
-- creating any account; only emails on private.allowed_emails get through.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into private.allowed_emails (email) values ('eden@test.dev');

select is(
  public.hook_before_user_created('{"user":{"email":"eden@test.dev"}}'),
  '{}'::jsonb,
  'an allowlisted email can sign up'
);
select is(
  public.hook_before_user_created('{"user":{"email":"Eden@Test.dev"}}'),
  '{}'::jsonb,
  'email matching ignores capitalization'
);
select is(
  (public.hook_before_user_created('{"user":{"email":"stranger@test.dev"}}') -> 'error' ->> 'http_code')::int,
  403,
  'anyone else is refused'
);
select is(
  (public.hook_before_user_created('{"user":{}}') -> 'error' ->> 'http_code')::int,
  403,
  'a sign-up with no email is refused'
);
select throws_ok(
  $$ insert into private.allowed_emails (email) values ('Mixed@Case.dev') $$,
  '23514', null, 'the list only stores lowercase emails'
);

select ok(
  has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute'),
  'Supabase Auth can run the check'
);
select ok(
  not has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute'),
  'the app cannot call the check directly'
);
select ok(
  not has_schema_privilege('anon', 'private', 'usage')
  and not has_schema_privilege('authenticated', 'private', 'usage'),
  'the app cannot read or change the allowlist'
);

select * from finish();
rollback;
