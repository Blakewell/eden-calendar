-- Sharing a day: invites, answering them, and read-only access to shared records.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

select has_table('public', 'shares', 'shares table exists');
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'shares'),
  'row-level security is on'
);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'friend@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'stranger@test.dev');

create function pg_temp.sign_in(id text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', id, 'role', 'authenticated', 'email', email,
    'user_metadata', json_build_object('full_name', initcap(split_part(email, '@', 1)) || ' Test')
  )::text, true)
$$;

set local role authenticated;

-- The owner has a goal, and invites a friend (trying to forge the other fields).
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111', 'owner@test.dev');
insert into public.records (id, kind, data) values ('g1', 'goal', '{"title":"Reading"}');

select throws_ok(
  $$ insert into public.shares (invitee_email, status) values ('friend@test.dev', 'accepted') $$,
  '42501', null, 'an invite cannot be created already accepted'
);
select lives_ok(
  $$ insert into public.shares (invitee_email) values ('Friend@Test.dev ') $$,
  'the owner can invite someone by email'
);
select is(
  (select row(owner_id, owner_email, owner_name, invitee_email, status, invitee_id)::text from public.shares),
  row('11111111-1111-1111-1111-111111111111'::uuid, 'owner@test.dev', 'Owner Test', 'friend@test.dev', 'pending', null::uuid)::text,
  'the invite is pending, from the signed-in owner, with a tidy email'
);
select throws_ok(
  $$ insert into public.shares (invitee_email) values ('owner@test.dev') $$,
  '42501', null, 'nobody can invite themselves'
);
select throws_ok(
  $$ insert into public.shares (invitee_email) values ('friend@test.dev') $$,
  '23505', null, 'the same person cannot be invited twice'
);
select lives_ok(
  $$ insert into public.shares (invitee_email) values ('not-allowed@test.dev') $$,
  'inviting an address that cannot sign in looks the same to the sender'
);
select throws_ok(
  $$ update public.shares set status = 'accepted' $$,
  '42501', null, 'the owner cannot accept on the invitee''s behalf'
);
select public.respond_to_share((select id from public.shares where invitee_email = 'friend@test.dev'), true);
select is(
  (select status from public.shares where invitee_email = 'friend@test.dev'), 'pending',
  'the owner cannot accept through the function either'
);

-- The friend, before accepting.
select pg_temp.sign_in('22222222-2222-2222-2222-222222222222', 'friend@test.dev');
select is((select count(*) from public.shares), 1::bigint, 'the invitee sees the invite sent to them');
select is((select owner_name from public.shares), 'Owner Test', 'and who it is from');
select is((select count(*) from public.records), 0::bigint, 'nothing is shared before accepting');

-- A stranger sees nothing and cannot accept for the friend.
select pg_temp.sign_in('33333333-3333-3333-3333-333333333333', 'stranger@test.dev');
select is((select count(*) from public.shares), 0::bigint, 'a stranger sees no invites');
select public.respond_to_share(
  (select id from public.shares where invitee_email = 'friend@test.dev'), true
);
reset role;
select is(
  (select status from public.shares where invitee_email = 'friend@test.dev'), 'pending',
  'a stranger cannot accept someone else''s invite'
);
set local role authenticated;

-- The friend accepts.
select pg_temp.sign_in('22222222-2222-2222-2222-222222222222', 'friend@test.dev');
select lives_ok(
  $$ select public.respond_to_share((select id from public.shares), true) $$,
  'the invitee can accept'
);
select is((select status from public.shares), 'accepted', 'the invite is accepted');
select is(
  (select invitee_id from public.shares), '22222222-2222-2222-2222-222222222222'::uuid,
  'and linked to the invitee''s account'
);
select is(
  (select data ->> 'title' from public.records where user_id = '11111111-1111-1111-1111-111111111111'),
  'Reading', 'the invitee can now see the owner''s records'
);

-- View only.
update public.records set data = '{"title":"changed"}' where id = 'g1';
delete from public.records where id = 'g1';
select throws_ok(
  $$ insert into public.records (user_id, id, kind, data)
     values ('11111111-1111-1111-1111-111111111111', 'x', 'goal', '{}') $$,
  '42501', null, 'the invitee cannot add to the owner''s day'
);
select throws_ok(
  $$ update public.shares set owner_id = '33333333-3333-3333-3333-333333333333' $$,
  '42501', null, 'the invitee cannot point the share at someone else'
);
reset role;
select is(
  (select data ->> 'title' from public.records where id = 'g1'), 'Reading',
  'the invitee could not change or delete the owner''s records'
);
set local role authenticated;

-- One-way: the owner still can't see the friend's day.
select pg_temp.sign_in('22222222-2222-2222-2222-222222222222', 'friend@test.dev');
insert into public.records (id, kind, data) values ('f1', 'goal', '{"title":"Friend''s goal"}');
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111', 'owner@test.dev');
select is(
  (select count(*) from public.records where user_id = '22222222-2222-2222-2222-222222222222'), 0::bigint,
  'sharing is one-way'
);
select is((select count(*) from public.shares), 2::bigint, 'the owner sees the invites they sent');
select is(
  (select status from public.shares where invitee_email = 'friend@test.dev'), 'accepted',
  'and whether they were accepted'
);

-- The stranger still sees nothing of the owner's.
select pg_temp.sign_in('33333333-3333-3333-3333-333333333333', 'stranger@test.dev');
select is((select count(*) from public.records), 0::bigint, 'people not invited see nothing');
select is((select count(*) from public.shares), 0::bigint, 'a stranger still sees no invites');

-- Declining takes access away.
select pg_temp.sign_in('22222222-2222-2222-2222-222222222222', 'friend@test.dev');
select public.respond_to_share((select id from public.shares), false);
select is((select status from public.shares), 'declined', 'the invitee can change their mind and decline');
select is(
  (select count(*) from public.records where user_id = '11111111-1111-1111-1111-111111111111'), 0::bigint,
  'after declining, the owner''s records are hidden again'
);
select public.respond_to_share((select id from public.shares), true);

-- The owner stops sharing.
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111', 'owner@test.dev');
delete from public.shares where invitee_email = 'friend@test.dev';
select pg_temp.sign_in('22222222-2222-2222-2222-222222222222', 'friend@test.dev');
select is((select count(*) from public.shares), 0::bigint, 'once the owner stops sharing, the invite is gone');
select is(
  (select count(*) from public.records where user_id = '11111111-1111-1111-1111-111111111111'), 0::bigint,
  'and so is access to their day'
);

-- The invitee can remove a share sent to them.
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111', 'owner@test.dev');
insert into public.shares (invitee_email) values ('friend@test.dev');
select pg_temp.sign_in('22222222-2222-2222-2222-222222222222', 'friend@test.dev');
delete from public.shares;
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111', 'owner@test.dev');
select is(
  (select count(*) from public.shares where invitee_email = 'friend@test.dev'), 0::bigint,
  'the invitee can remove an invite sent to them'
);

-- Signed out.
set local role anon;
select throws_ok($$ select * from public.shares $$, '42501', null, 'signed-out visitors cannot read invites');
select throws_ok(
  $$ select public.respond_to_share(gen_random_uuid(), true) $$,
  '42501', null, 'signed-out visitors cannot answer invites'
);
select throws_ok(
  $$ insert into public.shares (invitee_email) values ('x@test.dev') $$,
  '42501', null, 'signed-out visitors cannot invite'
);

select * from finish();
rollback;
