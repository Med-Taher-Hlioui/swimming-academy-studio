-- Run only against the disposable local Supabase database.
begin;
set local timezone = 'Africa/Tunis';
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
select no_plan();

create temporary table fixture_ids (name text primary key,id uuid not null default gen_random_uuid());
create temporary table fixture_tokens (name text primary key,invitation_id uuid,token text,expires_at timestamptz);
grant select on fixture_ids,fixture_tokens to authenticated,anon;
grant usage on schema extensions to authenticated,anon;
create function pg_temp.fixture(p_name text) returns uuid language sql stable
as $$ select id from pg_temp.fixture_ids where name = p_name $$;
grant execute on function pg_temp.fixture(text) to authenticated,anon;

insert into fixture_ids(name) values
  ('admin_a'),('admin_b'),('coach_a'),('coach_b'),('parent_a'),('parent_b'),('outsider'),('unverified'),
  ('request_present'),('request_noop'),('request_absent'),('request_excused'),('request_unmark'),('request_closed');
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_app_meta_data,raw_user_meta_data)
  select id,name || '@academy.invalid',
    case when name = 'unverified' then null else clock_timestamp() end,false,'{}','{}'
  from fixture_ids where name in ('admin_a','admin_b','coach_a','coach_b','parent_a','parent_b','outsider','unverified');
insert into public.profiles(id,display_name)
  select id,'Synthetic ' || name from fixture_ids
  where name in ('admin_a','admin_b','coach_a','coach_b','parent_a','parent_b','outsider','unverified');

insert into fixture_ids(name,id) values
  ('academy_a',public.academy_bootstrap('synthetic-a','Synthetic Academy A',pg_temp.fixture('admin_a'),'Synthetic Admin A')),
  ('academy_b',public.academy_bootstrap('synthetic-b','Synthetic Academy B',pg_temp.fixture('admin_b'),'Synthetic Admin B'));
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_a'),'role','authenticated')::text,true);
insert into fixture_ids(name,id) values
  ('coach_member_a',public.academy_set_membership(pg_temp.fixture('academy_a'),pg_temp.fixture('coach_a'),'coach',true)),
  ('coach_member_b',public.academy_set_membership(pg_temp.fixture('academy_a'),pg_temp.fixture('coach_b'),'coach',true)),
  ('parent_member_a',public.academy_set_membership(pg_temp.fixture('academy_a'),pg_temp.fixture('parent_a'),'parent',true)),
  ('parent_member_b',public.academy_set_membership(pg_temp.fixture('academy_a'),pg_temp.fixture('parent_b'),'parent',true));
insert into fixture_ids(name,id) select 'admin_member_a',id from public.academy_memberships
  where academy_id = pg_temp.fixture('academy_a') and profile_id = pg_temp.fixture('admin_a') and role = 'admin';
insert into fixture_ids(name,id) values
  ('coach_record_a',public.academy_save_coach(pg_temp.fixture('academy_a'),'Synthetic Coach A',p_membership => pg_temp.fixture('coach_member_a'))),
  ('coach_record_b',public.academy_save_coach(pg_temp.fixture('academy_a'),'Synthetic Coach B',p_membership => pg_temp.fixture('coach_member_b'))),
  ('swimmer_a',public.academy_save_swimmer(pg_temp.fixture('academy_a'),'Synthetic Swimmer A','beginner')),
  ('swimmer_other',public.academy_save_swimmer(pg_temp.fixture('academy_a'),'Synthetic Swimmer Other','beginner')),
  ('group_a',public.academy_save_group(pg_temp.fixture('academy_a'),'Synthetic Group A','beginner',1::smallint)),
  ('group_other',public.academy_save_group(pg_temp.fixture('academy_a'),'Synthetic Group Other','beginner',2::smallint));
select public.academy_assign_coach(pg_temp.fixture('academy_a'),pg_temp.fixture('group_a'),pg_temp.fixture('coach_record_a'),current_date-30,p_primary => true);
select public.academy_assign_coach(pg_temp.fixture('academy_a'),pg_temp.fixture('group_other'),pg_temp.fixture('coach_record_b'),current_date-30,p_primary => true);
select public.academy_transfer_swimmer(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),pg_temp.fixture('group_a'),current_date-30);
select public.academy_transfer_swimmer(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_other'),pg_temp.fixture('group_other'),current_date-30);
insert into fixture_ids(name,id) values
  ('session_today',public.academy_create_session(pg_temp.fixture('academy_a'),pg_temp.fixture('group_a'),current_date)),
  ('session_old',public.academy_create_session(pg_temp.fixture('academy_a'),pg_temp.fixture('group_a'),current_date-10)),
  ('session_other',public.academy_create_session(pg_temp.fixture('academy_a'),pg_temp.fixture('group_other'),current_date));
select public.academy_session_status(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),'open',1);
insert into public.guardian_swimmers(academy_id,parent_membership_id,swimmer_id,relationship,verified_at,verified_by_membership_id,history_visible_from)
  values(pg_temp.fixture('academy_a'),pg_temp.fixture('parent_member_a'),pg_temp.fixture('swimmer_a'),'parent',
    clock_timestamp(),pg_temp.fixture('admin_member_a'),current_date),
  (pg_temp.fixture('academy_a'),pg_temp.fixture('parent_member_b'),pg_temp.fixture('swimmer_other'),'parent',
    clock_timestamp(),pg_temp.fixture('admin_member_a'),current_date);
insert into fixture_ids(name,id) values
  ('note_internal',public.academy_save_note(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),'Synthetic internal note')),
  ('note_public',public.academy_save_note(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),'Synthetic parent-visible note'));
select public.academy_publish_note(pg_temp.fixture('academy_a'),pg_temp.fixture('note_public'),1);

select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_b'),'role','authenticated')::text,true);
insert into fixture_ids(name,id) values
  ('foreign_swimmer',public.academy_save_swimmer(pg_temp.fixture('academy_b'),'Synthetic Foreign Swimmer','beginner')),
  ('foreign_group',public.academy_save_group(pg_temp.fixture('academy_b'),'Synthetic Foreign Group','beginner',8::smallint));
set constraints all immediate;
set constraints all deferred;

select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_a'),'role','authenticated')::text,true);
select public.academy_session_status(pg_temp.fixture('academy_a'),pg_temp.fixture('session_old'),'open',1);
select public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_old'),pg_temp.fixture('swimmer_a'),'absent',0,pg_temp.fixture('request_absent'));
select public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'present',0,pg_temp.fixture('request_present'));
insert into fixture_ids(name,id) values ('old_note',public.academy_save_note(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),'Synthetic pre-cutoff note',pg_temp.fixture('session_old')));
select public.academy_publish_note(pg_temp.fixture('academy_a'),pg_temp.fixture('old_note'),1);
insert into fixture_ids(name,id) values ('late_note',public.academy_save_note(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_other'),'Synthetic late published note'));
select public.academy_publish_note(pg_temp.fixture('academy_a'),pg_temp.fixture('late_note'),1);
alter table public.swimmer_notes disable trigger user;
update public.swimmer_notes set created_at=created_at-interval '10 days' where id=pg_temp.fixture('late_note');
alter table public.swimmer_notes enable trigger user;
select public.academy_set_membership(pg_temp.fixture('academy_a'),pg_temp.fixture('parent_a'),'admin',true);
insert into fixture_tokens select 'parent_sibling',* from public.academy_issue_invitation(
  pg_temp.fixture('academy_a'),'parent_a@academy.invalid','parent',pg_temp.fixture('swimmer_other'),'parent',current_date,true);
insert into fixture_tokens select 'coach',* from public.academy_issue_invitation(pg_temp.fixture('academy_a'),'parent_a@academy.invalid','coach');
insert into fixture_tokens select 'expired',* from public.academy_issue_invitation(
  pg_temp.fixture('academy_a'),'parent_b@academy.invalid','parent',pg_temp.fixture('swimmer_a'),'parent',current_date,true);
alter table public.academy_invitations disable trigger user;
update public.academy_invitations set issued_at=issued_at-interval '72 hours',expires_at=expires_at-interval '72 hours'
where id=(select invitation_id from fixture_tokens where name='expired');
alter table public.academy_invitations enable trigger user;
select is((select token_hash from public.academy_invitations where id=(select invitation_id from fixture_tokens where name='parent_sibling')),
  (select extensions.digest(token,'sha256') from fixture_tokens where name='parent_sibling'),'Only token digest is stored');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_b'),'role','authenticated')::text,true);
insert into fixture_tokens select 'second_tenant',* from public.academy_issue_invitation(
  pg_temp.fixture('academy_b'),'parent_a@academy.invalid','parent',pg_temp.fixture('foreign_swimmer'),'parent',current_date,true);

set local role anon;
select throws_ok($$select public.academy_parent_activity(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'))$$,
  '42501',null,'Anonymous activity denied');
select throws_ok($$select public.academy_accept_parent_invitation(repeat('a',43))$$,'42501',null,'Anonymous acceptance denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('parent_b'),'role','authenticated')::text,true);
select throws_ok($$select public.academy_accept_parent_invitation((select token from fixture_tokens where name='parent_sibling'))$$,'42501',null,'Wrong verified recipient denied');
select throws_ok($$select public.academy_accept_parent_invitation((select token from fixture_tokens where name='expired'))$$,'42501',null,'Expired Parent invitation denied');
select throws_ok($$select public.academy_record_monthly_status(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),2026,6,'paid')$$,'42501',null,'Parent financial mutation denied');
select is(public.academy_parent_activity(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a')),null::jsonb,'Unrelated child denied');
select is((select count(*) from public.swimmer_notes where id=pg_temp.fixture('late_note')),0::bigint,'Direct RLS excludes a pre-cutoff note published later');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_b'),'role','authenticated')::text,true);
select is(public.academy_parent_activity(pg_temp.fixture('academy_b'),pg_temp.fixture('foreign_swimmer')),null::jsonb,'Admin role alone cannot open Parent activity');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('parent_a'),'role','authenticated')::text,true);
select is(public.academy_parent_activity(pg_temp.fixture('academy_b'),pg_temp.fixture('foreign_swimmer')),null::jsonb,'Cross-tenant child denied before invitation');
select is(public.academy_parent_activity(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_other')),null::jsonb,'Admin role cannot bypass child check on Parent projection');
select is(jsonb_array_length(public.academy_parent_activity(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'))->'attendance'),1,'Only authorized attendance is projected for dual-role actor');
select is(public.academy_parent_activity(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'))->'attendance'->0->>'status','present','Pre-cutoff absence is excluded');
select is(jsonb_array_length(public.academy_parent_activity(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'))->'notes'),1,'Internal and pre-cutoff session notes are excluded');
select is(public.academy_parent_activity(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'))->'notes'->0->>'body','Synthetic parent-visible note','Published note is included');
select throws_ok($$select public.academy_accept_parent_invitation((select token from fixture_tokens where name='coach'))$$,'42501',null,'Coach token cannot use Parent acceptance');
select is(public.academy_accept_parent_invitation((select token from fixture_tokens where name='parent_sibling')),
  pg_temp.fixture('academy_a'),'Invitation accepts for the token-bound academy');
select throws_ok($$select public.academy_accept_parent_invitation((select token from fixture_tokens where name='parent_sibling'))$$,'42501',null,'Invitation cannot be replayed');
select ok(public.academy_parent_activity(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_other')) is not null,'A second verified child is accessible');
select is(public.academy_accept_parent_invitation((select token from fixture_tokens where name='second_tenant')),
  pg_temp.fixture('academy_b'),'A separate invitation is required for another academy');
select ok(public.academy_parent_activity(pg_temp.fixture('academy_b'),pg_temp.fixture('foreign_swimmer')) is not null,'Second verified academy is accessible');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_a'),'role','authenticated')::text,true);
select public.academy_revoke_guardian(pg_temp.fixture('academy_a'),(select id from public.guardian_swimmers
  where parent_membership_id=pg_temp.fixture('parent_member_a') and swimmer_id=pg_temp.fixture('swimmer_a') and revoked_at is null));
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('parent_a'),'role','authenticated')::text,true);
select is(public.academy_parent_activity(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a')),null::jsonb,'Revocation removes access despite another role');
select ok(public.academy_parent_activity(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_other')) is not null,'Revoking one child preserves another verified child');
reset role;
select * from finish();
rollback;
