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

select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname = any(array[
    'academies','profiles','academy_memberships','academy_invitations','coaches','swimmers','guardian_swimmers','groups',
    'group_coaches','group_swimmers','schedule_rules','sessions','session_coaches','session_roster','attendance',
    'swimmer_notes','attendance_history','audit_logs']) and c.relrowsecurity),18::bigint,'All 18 operational tables have RLS');
select ok(not has_function_privilege('authenticated','public.academy_bootstrap(text,text,uuid,text)','execute'),'Bootstrap unavailable to browser users');
select ok(not has_table_privilege('authenticated','public.academy_invitations','select'),'Invitation hash table is inaccessible');

set local role anon;
select throws_ok('select count(*) from public.swimmers','42501',null,'Anonymous operational read denied');
select throws_ok($$select public.academy_save_swimmer(pg_temp.fixture('academy_a'),'Forbidden','beginner')$$,'42501',null,'Anonymous RPC denied');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('outsider'),'role','authenticated')::text,true);
set local role authenticated;
select is((select count(*) from public.swimmers),0::bigint,'No-membership user sees no swimmers');
select throws_ok($$select public.academy_set_membership(pg_temp.fixture('academy_a'),pg_temp.fixture('outsider'),'admin',true)$$,'42501',null,'Self promotion denied');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('unverified'),'role','authenticated')::text,true);
set local role authenticated;
select is((select count(*) from public.groups),0::bigint,'Unverified identity has no operational access');
reset role;

select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_a'),'role','authenticated')::text,true);
set local role authenticated;
select is((select count(*) from public.swimmers),2::bigint,'Admin sees only their academy swimmers');
select is((select count(*) from public.swimmers where academy_id = pg_temp.fixture('academy_b')),0::bigint,'Cross-tenant read denied');
select throws_ok($$select public.academy_save_swimmer(pg_temp.fixture('academy_b'),'Forbidden','beginner')$$,'42501',null,'Cross-tenant mutation denied');
select throws_ok($$insert into public.academy_memberships(academy_id,profile_id,role) values(pg_temp.fixture('academy_b'),pg_temp.fixture('admin_a'),'admin')$$,'42501',null,'Direct privilege escalation denied even for an Admin client');
select throws_ok($$select public.academy_set_membership(pg_temp.fixture('academy_a'),pg_temp.fixture('admin_a'),'admin',false)$$,'23514',null,'Last Admin cannot revoke self');
select throws_ok($$delete from public.audit_logs$$,'42501',null,'Admin cannot delete audit history');
reset role;

-- Owner fixture writes test constraints independently of API RLS.
select throws_ok($$insert into public.coaches(academy_id,display_name,membership_id)
  select pg_temp.fixture('academy_b'),'Bad cross-tenant coach',pg_temp.fixture('coach_member_a')$$,'23503',null,'Composite FK rejects cross-tenant membership');
select throws_ok($$insert into public.coaches(academy_id,display_name,membership_id)
  select pg_temp.fixture('academy_a'),'Bad role coach',pg_temp.fixture('parent_member_a')$$,'23503',null,'Role-qualified FK rejects Parent as Coach');
select throws_ok($$insert into public.group_swimmers(academy_id,group_id,swimmer_id,valid_from,valid_until)
  values(pg_temp.fixture('academy_a'),pg_temp.fixture('foreign_group'),pg_temp.fixture('swimmer_other'),current_date-32,current_date-31)$$,'23503',null,'Cross-academy group FK rejected');
select throws_ok($$insert into public.group_swimmers(academy_id,group_id,swimmer_id,valid_from)
  values(pg_temp.fixture('academy_a'),pg_temp.fixture('group_other'),pg_temp.fixture('swimmer_a'),current_date)$$,'23P01',null,'Overlapping swimmer allocation rejected');
select throws_ok($$insert into public.sessions(academy_id,group_id,session_date,timezone,group_name_snapshot,level_snapshot,capacity_snapshot)
  values(pg_temp.fixture('academy_a'),pg_temp.fixture('group_a'),current_date,'Africa/Tunis','Duplicate','beginner',1)$$,'23505',null,'Duplicate group/date session rejected');

select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('coach_a'),'role','authenticated')::text,true);
set local role authenticated;
select is((select count(*) from public.groups),1::bigint,'Coach reads assigned group only');
select is((select count(*) from public.sessions),2::bigint,'Coach reads own current and historical sessions');
select is((select count(*) from public.swimmers),1::bigint,'Coach reads assigned swimmer only');
select throws_ok($$select public.academy_save_group(pg_temp.fixture('academy_a'),'Forbidden','beginner',8::smallint)$$,'42501',null,'Coach cannot manage groups');
select throws_ok($$select public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_other'),pg_temp.fixture('swimmer_other'),'present',0,gen_random_uuid())$$,'42501',null,'Coach cannot mark another session');
select throws_ok($$insert into public.attendance(academy_id,session_id,swimmer_id,roster_id,status)
  select academy_id,session_id,swimmer_id,id,'present' from public.session_roster limit 1$$,'42501',null,'Direct attendance mutation denied');
select is((public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'present',0,pg_temp.fixture('request_present'))->>'status'),'present','Present accepted');
select is((public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'present',0,pg_temp.fixture('request_present'))->>'version'),'1','Identical retry returns original receipt');
select is((public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'present',1,pg_temp.fixture('request_noop'))->>'changed'),'false','No-op has a receipt');
select is((public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'absent',1,pg_temp.fixture('request_absent'))->>'status'),'absent','Absent accepted');
select is((public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'present',1,pg_temp.fixture('request_noop'))->>'version'),'1','Delayed no-op retry preserves original result');
select is((select status from public.attendance),'absent','Delayed retry does not overwrite a later mark');
select is((public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'excused',2,pg_temp.fixture('request_excused'))->>'status'),'excused','Excused accepted');
select throws_ok($$select public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'unmarked',3,gen_random_uuid())$$,'23514',null,'Unmarked is not a fourth status');
select throws_ok($$select public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'absent',0,gen_random_uuid())$$,'40001',null,'Stale version rejected');
select public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),null,3,pg_temp.fixture('request_unmark'));
select is((select count(*) from public.attendance),0::bigint,'Unmarked has no current row');
select is((select count(*) from public.attendance_history),4::bigint,'Every actual change preserved in history');
select is((select count(*) from public.attendance_history where new_status = 'excused'),1::bigint,'Excused transition in history');
select is((select count(*) from public.attendance_history where new_status is null),1::bigint,'Unmark transition in history');
select throws_ok($$select public.academy_publish_note(pg_temp.fixture('academy_a'),pg_temp.fixture('note_internal'),1)$$,'42501',null,'Coach cannot publish Parent notes');
reset role;

select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('parent_a'),'role','authenticated')::text,true);
set local role authenticated;
select is((select count(*) from public.swimmers),1::bigint,'Parent sees only verified linked child');
select is((select count(*) from public.sessions),1::bigint,'Parent cannot read older sessions before history_visible_from');
select is((select count(*) from public.session_roster),1::bigint,'Parent sees only own child roster');
select is((select count(*) from public.swimmer_notes),1::bigint,'Parent reads published note only');
select is((select count(*) from public.attendance_history),0::bigint,'Parent cannot read internal correction details');
select throws_ok($$select token_hash from public.academy_invitations$$,'42501',null,'Parent cannot read invitation hashes');
select throws_ok($$select public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'present',4,gen_random_uuid())$$,'42501',null,'Parent attendance write denied');
select throws_ok($$update public.guardian_swimmers set history_visible_from = current_date-100$$,'42501',null,'Parent cannot extend historical access');
reset role;

select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_a'),'role','authenticated')::text,true);
select public.academy_session_status(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),'closed',2);
set local role authenticated;
select throws_ok($$select public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'present',4,gen_random_uuid())$$,'23514',null,'Closed correction requires reason');
select lives_ok($$select public.academy_mark_attendance(pg_temp.fixture('academy_a'),pg_temp.fixture('session_today'),pg_temp.fixture('swimmer_a'),'present',4,pg_temp.fixture('request_closed'),'Synthetic correction')$$,'Admin closed correction with reason succeeds');
reset role;
select throws_ok($$insert into public.attendance(academy_id,session_id,swimmer_id,roster_id,status)
  select academy_id,session_id,swimmer_id,roster_id,'absent' from public.attendance$$,'23505',null,'Duplicate current attendance rejected');
select throws_ok($$update public.attendance_history set new_status = 'absent'$$,'42501',null,'History rows are append-only even for privileged writes');

-- Token fixtures are generated in SQL and never printed.
insert into fixture_tokens select 'valid',* from public.academy_issue_invitation(
  pg_temp.fixture('academy_a'),'parent_a@academy.invalid','parent',pg_temp.fixture('swimmer_other'),'parent',current_date,true);
insert into fixture_tokens select 'expired',* from public.academy_issue_invitation(
  pg_temp.fixture('academy_a'),'parent_b@academy.invalid','parent',pg_temp.fixture('swimmer_a'),'parent',current_date,true);
select is((select expires_at-issued_at from public.academy_invitations where id = (select invitation_id from fixture_tokens where name='valid')),interval '72 hours','Invitation lifetime is exactly 72 hours');
alter table public.academy_invitations disable trigger user;
update public.academy_invitations set issued_at = issued_at-interval '72 hours',expires_at = expires_at-interval '72 hours'
  where id = (select invitation_id from fixture_tokens where name = 'expired');
alter table public.academy_invitations enable trigger user;

select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('parent_b'),'role','authenticated')::text,true);
set local role authenticated;
select throws_ok($$select public.academy_accept_invitation((select token from fixture_tokens where name='valid'))$$,'42501',null,'Wrong recipient cannot accept');
select throws_ok($$select public.academy_accept_invitation((select token from fixture_tokens where name='expired'))$$,'42501',null,'Invitation fails at 72-hour expiry boundary');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('parent_a'),'role','authenticated')::text,true);
set local role authenticated;
select lives_ok($$select public.academy_accept_invitation((select token from fixture_tokens where name='valid'))$$,'Verified intended recipient accepts');
select throws_ok($$select public.academy_accept_invitation((select token from fixture_tokens where name='valid'))$$,'42501',null,'Consumed invitation replay fails');
select is((select count(*) from public.swimmers),2::bigint,'Accepted verified relationship grants the intended additional child');
reset role;

select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_a'),'role','authenticated')::text,true);
insert into fixture_tokens select 'dual',* from public.academy_issue_invitation(
  pg_temp.fixture('academy_a'),'coach_a@academy.invalid','parent',pg_temp.fixture('swimmer_other'),'legal_guardian',current_date,true);
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('coach_a'),'role','authenticated')::text,true);
set local role authenticated;
select lives_ok($$select public.academy_accept_invitation((select token from fixture_tokens where name='dual'))$$,'Coach can accept a separate Parent role');
select is((select count(*) from public.academy_memberships where profile_id = pg_temp.fixture('coach_a') and status = 'active'),2::bigint,'Coach and Parent membership rows coexist');
select ok(not exists(select 1 from public.academy_memberships where academy_id = pg_temp.fixture('academy_b')),'Combined roles grant no foreign tenant access');
reset role;

set constraints all immediate;
select * from finish();
rollback;
