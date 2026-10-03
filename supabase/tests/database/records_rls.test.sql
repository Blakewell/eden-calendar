-- Row-level security on public.records: each person sees and changes only
-- their own rows; signed-out visitors get nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_table('public', 'records', 'records table exists');
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'records'),
  'row-level security is on'
);
select policies_are('public', 'records', array[
  'own records: select', 'own records: insert', 'own records: update', 'own records: delete',
  'shared records: select'
]);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'eden@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'other@test.dev');

-- Signed in as Eden.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.records (id, kind, data) values ('g1', 'goal', '{"title":"Reading"}') $$,
  'a user can add a record'
);
select is(
  (select user_id from public.records where id = 'g1'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'new records belong to the signed-in user'
);
select is((select count(*) from public.records), 1::bigint, 'a user sees their own record');
select throws_ok(
  $$ insert into public.records (id, kind, data) values ('x', 'nonsense', '{}') $$,
  '23514', null, 'unknown kinds are rejected'
);

-- Signed in as someone else.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*) from public.records), 0::bigint, 'another user cannot see it');
select throws_ok(
  $$ insert into public.records (user_id, id, kind, data)
     values ('11111111-1111-1111-1111-111111111111', 'g2', 'goal', '{}') $$,
  '42501', null, 'another user cannot add records as someone else'
);
update public.records set data = '{"title":"hacked"}' where id = 'g1';
delete from public.records where id = 'g1';

-- Signed out.
set local role anon;
select throws_ok($$ select * from public.records $$, '42501', null, 'signed-out visitors cannot read');
select throws_ok(
  $$ insert into public.records (id, kind, data) values ('a', 'goal', '{}') $$,
  '42501', null, 'signed-out visitors cannot write'
);

reset role;
select is(
  (select data ->> 'title' from public.records where id = 'g1'),
  'Reading',
  'another user could not change or delete it'
);
select is(
  (select count(*) from public.records where user_id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'nothing was created for the other user'
);

-- Signed in as Eden again: can update and delete her own.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
delete from public.records where id = 'g1';
select is((select count(*) from public.records), 0::bigint, 'a user can delete their own record');

select * from finish();
rollback;
