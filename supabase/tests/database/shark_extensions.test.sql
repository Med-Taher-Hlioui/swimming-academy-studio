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

grant insert on fixture_ids to authenticated;
insert into public.guardian_swimmers(academy_id,parent_membership_id,swimmer_id,relationship,verified_at,verified_by_membership_id,history_visible_from)
values(pg_temp.fixture('academy_a'),pg_temp.fixture('parent_member_a'),pg_temp.fixture('swimmer_a'),'parent',
  clock_timestamp(),pg_temp.fixture('admin_member_a'),current_date);

select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_b'),'role','authenticated')::text,true);
insert into fixture_ids(name,id) values ('foreign_swimmer',public.academy_save_swimmer(pg_temp.fixture('academy_b'),'Synthetic Foreign','beginner'));
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_a'),'role','authenticated')::text,true);

select results_eq($$select private.shark_formule_price(v) from unnest(array['60','70','80','90']) v$$,
  $$values (60::numeric),(70::numeric),(80::numeric),(90::numeric)$$,'Confirmed plan prices');
select is(private.shark_formule_price('99'),null::numeric,'Unknown plan is not mapped');
select results_eq($$select private.shark_monthly_code(v) from unnest(array[' p ','A','NP','-',null]) v$$,
  $$values ('paid'::text),('pending'),('unpaid'),('unknown'),(null)$$,'Monthly codes including blank');
select is(private.shark_document_code('X'),'received','X means received');
select is(private.shark_document_code(null),'unknown','Document blank means unknown');

set local role authenticated;
insert into fixture_ids(name,id) values
  ('contact',public.academy_save_guardian_contact(pg_temp.fixture('academy_a'),null,null,'Synthetic contact',null,null,false)),
  ('plan',public.academy_save_subscription_plan(pg_temp.fixture('academy_a'),null,null,'60','Synthetic plan',60,true)),
  ('batch',public.academy_create_import_review(pg_temp.fixture('academy_a'),repeat('a',64),'1.0',repeat('b',64),2025)),
  ('no_year',public.academy_create_import_review(pg_temp.fixture('academy_a'),repeat('a',64),'1.0',repeat('c',64),null));
insert into fixture_ids(name,id) values
  ('subscription',public.academy_open_subscription(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),pg_temp.fixture('plan'),'2025-06-01',null,true)),
  ('other_subscription',public.academy_open_subscription(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_other'),pg_temp.fixture('plan'),null,null,true)),
  ('exception',public.academy_quarantine_import_row(pg_temp.fixture('academy_a'),pg_temp.fixture('batch'),pg_temp.fixture('swimmer_a'),'duplicate_candidate'));
select is(public.academy_link_guardian_contact(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),pg_temp.fixture('contact'),true),
  pg_temp.fixture('swimmer_a'),'Admin can link contact candidate');
select is(public.academy_save_swimmer_birth_date(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),null,'2015-01-01'),
  pg_temp.fixture('swimmer_a'),'Admin can save private birth date');
select is((select count(*) from public.academy_admin_guardian_contacts),1::bigint,'Admin sees contact');
select is((select count(*) from public.academy_admin_swimmer_private_details),1::bigint,'Admin sees birth date');
select throws_ok($$select public.academy_save_swimmer_birth_date(pg_temp.fixture('academy_a'),pg_temp.fixture('foreign_swimmer'),null,'2015-01-01')$$,
  '23503',null,'Composite foreign key rejects cross-academy birth date');
select throws_ok($$select public.academy_save_subscription_plan(pg_temp.fixture('academy_b'),null,null,'70','Foreign',70,true)$$,
  '42501',null,'Admin cannot mutate another academy');
select throws_ok($$update private.guardian_contacts set display_name='Forbidden'$$,'42501',null,'Admin direct writes are denied');
select throws_ok($$select public.academy_save_subscription_plan(pg_temp.fixture('academy_a'),null,null,'60','Duplicate',60,true)$$,
  '23505',null,'Plan codes unique within academy');
select throws_ok($$select public.academy_save_subscription_plan(pg_temp.fixture('academy_a'),null,null,'BAD','Bad price',-1,true)$$,
  '23514',null,'Negative price rejected');
select is(public.academy_save_subscription_plan(pg_temp.fixture('academy_a'),pg_temp.fixture('plan'),1,'60','Updated plan',70,true),
  pg_temp.fixture('plan'),'Admin changes catalog price');
select is((select monthly_price_tnd from public.academy_admin_swimmer_subscriptions where id=pg_temp.fixture('subscription')),
  60::numeric,'Historical price stays at opening price');
select throws_ok($$select public.academy_open_subscription(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),pg_temp.fixture('plan'),'2025-07-01',null,true)$$,
  '23P01',null,'Overlapping confirmed terms rejected');
select throws_ok($$select public.academy_record_monthly_status(pg_temp.fixture('academy_a'),pg_temp.fixture('subscription'),2025,13,'paid')$$,
  '23514',null,'Invalid month rejected');
select throws_ok($$select public.academy_record_monthly_status(pg_temp.fixture('academy_a'),pg_temp.fixture('subscription'),2025,5,'paid')$$,
  '23514',null,'Month outside known term rejected');
select throws_ok($$select public.academy_approve_import_review(pg_temp.fixture('academy_a'),pg_temp.fixture('no_year'),1,repeat('c',64),repeat('d',64),true)$$,
  '40001',null,'Monthly batch approval requires billing year');
select throws_ok($$select public.academy_approve_import_review(pg_temp.fixture('academy_a'),pg_temp.fixture('batch'),1,repeat('b',64),repeat('d',64),true)$$,
  '40001',null,'Open exception blocks batch approval');
select is(public.academy_resolve_import_exception(pg_temp.fixture('academy_a'),pg_temp.fixture('exception'),1,'excluded'),
  pg_temp.fixture('exception'),'Admin can exclude an exception');
select throws_ok($$select public.academy_approve_import_review(pg_temp.fixture('academy_a'),pg_temp.fixture('batch'),1,repeat('e',64),repeat('d',64),true)$$,
  '40001',null,'Approval is bound to preview digest');
select is(public.academy_approve_import_review(pg_temp.fixture('academy_a'),pg_temp.fixture('batch'),1,repeat('b',64),repeat('d',64),true),
  pg_temp.fixture('batch'),'Admin approves reviewed batch');
insert into fixture_ids(name,id) values ('source_link',public.academy_link_import_source(pg_temp.fixture('academy_a'),pg_temp.fixture('batch'),
  pg_temp.fixture('request_present'),repeat('f',64),pg_temp.fixture('swimmer_a'),null,null));
select is(public.academy_link_import_source(pg_temp.fixture('academy_a'),pg_temp.fixture('batch'),pg_temp.fixture('request_present'),
  repeat('f',64),pg_temp.fixture('swimmer_a'),null,null),pg_temp.fixture('source_link'),'Provenance link replay is idempotent');
select throws_ok($$select public.academy_link_import_source(pg_temp.fixture('academy_a'),pg_temp.fixture('batch'),pg_temp.fixture('request_present'),
  repeat('a',64),pg_temp.fixture('swimmer_a'),null,null)$$,'40001',null,'Changed fingerprint cannot silently replace a source link');

reset role;
-- Fixture-only insertion exercises the storage boundary reserved for the future importer.
with rows as (
  insert into private.subscription_monthly_statuses(academy_id,subscription_id,billing_year,billing_month,source_batch_id,source_code,normalized_status)
  values
    (pg_temp.fixture('academy_a'),pg_temp.fixture('subscription'),2025,6,pg_temp.fixture('batch'),' - ','unknown'),
    (pg_temp.fixture('academy_a'),pg_temp.fixture('subscription'),2025,7,pg_temp.fixture('batch'),null,null)
  returning id,billing_month
)
insert into fixture_ids(name,id) select 'month_' || billing_month,id from rows;
with rows as (
  insert into private.registration_document_statuses(academy_id,swimmer_id,document_type,source_batch_id,source_code,status)
  values (pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),'certificate',pg_temp.fixture('batch'),'X','received')
  returning id
)
insert into fixture_ids(name,id) select 'document',id from rows;
select throws_ok($$insert into private.subscription_monthly_statuses(academy_id,subscription_id,billing_year,billing_month,source_batch_id,source_code,normalized_status)
  values(pg_temp.fixture('academy_a'),pg_temp.fixture('subscription'),2026,8,pg_temp.fixture('batch'),'P','paid')$$,'23514',null,'Source year must equal approved year');
select throws_ok($$insert into private.registration_document_statuses(academy_id,swimmer_id,document_type,source_batch_id,status)
  values(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),'extract',pg_temp.fixture('batch'),'missing')$$,'23514',null,'Blank document cannot import as missing');
select throws_ok($$update private.swimmer_subscriptions set monthly_price_tnd=1 where id=pg_temp.fixture('subscription')$$,'23514',null,'Snapshot immutable at storage boundary');

set local role authenticated;
select throws_ok($$select public.academy_record_monthly_status(pg_temp.fixture('academy_a'),pg_temp.fixture('subscription'),2025,6,'paid')$$,
  '23505',null,'Unique subscription and billing period');
select is((select normalized_status from public.academy_admin_subscription_monthly_statuses where id=pg_temp.fixture('month_7')),
  null::text,'Source blank remains NULL');
select is(public.academy_publish_subscription_record(pg_temp.fixture('academy_a'),'subscription',pg_temp.fixture('subscription'),1,true),
  pg_temp.fixture('subscription'),'Admin publishes subscription');
select is(public.academy_publish_subscription_record(pg_temp.fixture('academy_a'),'subscription',pg_temp.fixture('other_subscription'),1,true),
  pg_temp.fixture('other_subscription'),'Admin publishes another family subscription');
select is(public.academy_publish_subscription_record(pg_temp.fixture('academy_a'),'month',pg_temp.fixture('month_6'),1,true),
  pg_temp.fixture('month_6'),'Admin publishes explicit unknown month');
select is(public.academy_publish_subscription_record(pg_temp.fixture('academy_a'),'document',pg_temp.fixture('document'),1,true),
  pg_temp.fixture('document'),'Admin publishes document status');

select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('parent_a'),'role','authenticated')::text,true);
select is((select count(*) from public.academy_parent_subscriptions(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'))),1::bigint,'Verified parent sees published subscription');
select is((select count(*) from public.academy_parent_subscriptions(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_other'))),0::bigint,'Parent cannot see another family');
select is((select count(*) from public.academy_parent_subscriptions(pg_temp.fixture('academy_b'),pg_temp.fixture('swimmer_a'))),0::bigint,'Parent cannot substitute tenant');
select results_eq($$select billing_month,normalized_status from public.academy_parent_months(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'))$$,
  $$values (6,'unknown'::text)$$,'Unpublished blank month is hidden');
select results_eq($$select status from public.academy_parent_documents(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'))$$,
  $$values ('received'::text)$$,'Parent sees published document receipt');
select is((select count(*) from public.academy_admin_subscription_monthly_statuses),0::bigint,'Parent cannot use Admin raw status view');
select is((select count(*) from public.academy_admin_swimmer_private_details),0::bigint,'Parent cannot read restricted birth date');
select is((select count(*) from public.academy_admin_import_source_links),0::bigint,'Parent cannot read source provenance');
select throws_ok($$select public.academy_save_document_status(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'),'certificate',2,'missing')$$,
  '42501',null,'Parent cannot mutate documents');
select throws_ok($$select public.academy_record_monthly_status(pg_temp.fixture('academy_a'),pg_temp.fixture('subscription'),2025,9,'paid')$$,
  '42501',null,'Parent cannot mutate monthly statuses');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('parent_b'),'role','authenticated')::text,true);
select is((select count(*) from public.academy_parent_subscriptions(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_other'))),0::bigint,'Parent membership alone is insufficient');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('coach_a'),'role','authenticated')::text,true);
select is((select count(*) from public.academy_admin_subscription_plans),0::bigint,'Coach cannot access new plans');
select is((select count(*) from public.academy_parent_months(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'))),0::bigint,'Coach cannot use parent projection');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_b'),'role','authenticated')::text,true);
select is((select count(*) from public.academy_admin_import_batches),0::bigint,'Other Admin cannot read import metadata');

select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('admin_a'),'role','authenticated')::text,true);
select is(public.academy_correct_monthly_status(pg_temp.fixture('academy_a'),pg_temp.fixture('month_6'),2,'paid','source_review'),
  pg_temp.fixture('month_6'),'Admin can correct imported effective status');
select results_eq($$select source_code,normalized_status,parent_visible from public.academy_admin_subscription_monthly_statuses where id=pg_temp.fixture('month_6')$$,
  $$values (' - '::text,'paid'::text,false)$$,'Correction preserves raw code and withdraws publication');
select results_eq($$select previous_status,new_status,reason_code from public.academy_admin_academy_extension_audit
  where target_id=pg_temp.fixture('month_6') and reason_code is not null$$,
  $$values ('unknown'::text,'paid'::text,'source_review'::text)$$,'Correction audit records old/new state and reason');
select throws_ok($$select public.academy_correct_monthly_status(pg_temp.fixture('academy_a'),pg_temp.fixture('month_6'),2,'pending','admin_correction')$$,
  '40001',null,'Stale version rejected');
select lives_ok($$select public.academy_revoke_guardian(pg_temp.fixture('academy_a'),
  (select id from public.guardian_swimmers where academy_id=pg_temp.fixture('academy_a') and swimmer_id=pg_temp.fixture('swimmer_a')))$$,
  'Admin revokes verified guardian relationship');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture('parent_a'),'role','authenticated')::text,true);
select is((select count(*) from public.academy_parent_documents(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'))),0::bigint,'Revoked parent loses document access');
reset role;
set local role anon;
select throws_ok($$select * from public.academy_parent_subscriptions(pg_temp.fixture('academy_a'),pg_temp.fixture('swimmer_a'))$$,
  '42501',null,'Anonymous callers cannot execute parent RPC');
select throws_ok($$select * from public.academy_admin_guardian_contacts$$,'42501',null,'Anonymous callers cannot access Admin view');
reset role;
select * from finish();
rollback;
