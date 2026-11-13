-- Synthetic demonstration only. Execute as an approved operator after the seven migrations.
-- psql variables admin_uid, parent_uid and other_parent_uid must identify verified example.test accounts.
\set ON_ERROR_STOP on
begin;
set local timezone = 'Africa/Tunis';
select set_config('preview.admin', :'admin_uid', true) as setting \gset
select set_config('preview.parent', :'parent_uid', true) as setting \gset
select set_config('preview.other_parent', :'other_parent_uid', true) as setting \gset

do $$
declare
  admin_id uuid := current_setting('preview.admin')::uuid;
  parent_id uuid := current_setting('preview.parent')::uuid;
  other_parent_id uuid := current_setting('preview.other_parent')::uuid;
  academy uuid; other_academy uuid; participant uuid; foreign_child uuid;
  coach uuid; training_group uuid; plan uuid; subscription uuid; observation uuid;
  document uuid; contact uuid; occurrence uuid; note uuid; token text;
  participants uuid[] := array[]::uuid[];
  training_groups uuid[] := array[]::uuid[];
  plans uuid[] := array[]::uuid[];
  group_index integer; pupil integer; month integer; offset_days integer;
  level_name text; mark text; status_value text;
begin
  perform pg_advisory_xact_lock(hashtextextended('shark-preview-synthetic-seed',0));
  if exists(select 1 from public.academies where slug in ('shark-preview-demo','shark-preview-isolation')) then
    raise exception 'Synthetic Preview already exists; preserve it and review before reseeding';
  end if;
  if (select count(*) from auth.users where id = any(array[admin_id,parent_id,other_parent_id])
      and email_confirmed_at is not null and not coalesce(is_anonymous,false)
      and email like '%@example.test') <> 3 then
    raise exception 'Three distinct verified synthetic example.test identities required';
  end if;
  academy := public.academy_bootstrap('shark-preview-demo','Shark Aquatics · DONNÉES FICTIVES',admin_id,'Démo Administrateur');
  other_academy := public.academy_bootstrap('shark-preview-isolation','Académie isolée · DONNÉES FICTIVES',admin_id,'Démo Administrateur');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  foreign_child := public.academy_save_swimmer(other_academy,'Démo Enfant autre académie','beginner');

  for group_index in 1..3 loop
    level_name := (array['beginner','developing','advanced'])[group_index];
    training_group := public.academy_save_group(academy,'Démo Groupe ' || group_index,level_name,8::smallint,'Horaires fictifs de démonstration');
    coach := public.academy_save_coach(academy,'Démo Coach ' || group_index);
    perform public.academy_assign_coach(academy,training_group,coach,current_date-30,null,true);
    plan := public.academy_save_subscription_plan(academy,null,null,'DEMO_' || group_index,'Démo Formule ' || group_index,(array[60,70,80])[group_index],true);
    training_groups := array_append(training_groups,training_group);
    plans := array_append(plans,plan);
  end loop;

  for pupil in 1..8 loop
    group_index := case when pupil <= 3 then 1 when pupil <= 6 then 2 else 3 end;
    level_name := (array['beginner','developing','advanced'])[group_index];
    participant := public.academy_save_swimmer(academy,'Démo Nageur ' || lpad(pupil::text,2,'0'),level_name);
    participants := array_append(participants,participant);
    perform public.academy_save_swimmer_birth_date(academy,participant,null,date '2015-01-01'+pupil*60);
    contact := public.academy_save_guardian_contact(academy,null,null,'Démo Responsable ' || pupil,null,null,false);
    perform public.academy_link_guardian_contact(academy,participant,contact,true);
    perform public.academy_transfer_swimmer(academy,participant,training_groups[group_index],current_date-30);
    subscription := public.academy_open_subscription(academy,participant,plans[group_index],date '2026-06-01',null,true);
    perform public.academy_publish_subscription_record(academy,'subscription',subscription,1,true);
    for month in 6..11 loop
      status_value := (array['paid','unknown','unpaid','pending',null,'paid'])[month-5];
      observation := public.academy_record_monthly_status(academy,subscription,2026,month,status_value);
      -- One unpublished observation remains to exercise the Parent publication boundary.
      if month <> 8 then perform public.academy_publish_subscription_record(academy,'month',observation,1,true); end if;
    end loop;
    document := public.academy_save_document_status(academy,participant,'certificate',null,'received');
    perform public.academy_publish_subscription_record(academy,'document',document,1,true);
    perform public.academy_save_document_status(academy,participant,'extract',null,'unknown');
    note := public.academy_save_note(academy,participant,'Exemple fictif de progression pour la démonstration.');
    perform public.academy_publish_note(academy,note,1);
    perform public.academy_save_note(academy,participant,'Note interne fictive, masquée au portail Parent.');
  end loop;

  for group_index in 1..3 loop
    for offset_days in -1..1 loop
      occurrence := public.academy_create_session(academy,training_groups[group_index],current_date+offset_days);
      if offset_days <= 0 then
        perform public.academy_session_status(academy,occurrence,'open',1);
        for pupil in 1..8 loop
          if exists(select 1 from public.session_roster where session_id=occurrence and swimmer_id=participants[pupil]) then
            mark := (array['present','absent','excused'])[((pupil-1)%3)+1];
            -- Leave one current mark empty to demonstrate unmarked attendance.
            if not (offset_days=0 and pupil=8) then
              perform public.academy_mark_attendance(academy,occurrence,participants[pupil],mark,0,gen_random_uuid());
            end if;
          end if;
        end loop;
      end if;
    end loop;
  end loop;

  -- Verify guardian relationships explicitly through the real invitation operations.
  for pupil in 1..3 loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
    participant := participants[case when pupil=3 then 4 else pupil end];
    select i.token into token from public.academy_issue_invitation(academy,
      (select email from auth.users where id=case when pupil=3 then other_parent_id else parent_id end),
      'parent',participant,'parent',date '2026-06-01',true) i;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',case when pupil=3 then other_parent_id else parent_id end,'role','authenticated')::text,true);
    perform public.academy_accept_parent_invitation(token);
  end loop;
  perform set_config('preview.academy',academy::text,true);
  perform set_config('preview.other_academy',other_academy::text,true);
end $$;
set constraints all immediate;
select jsonb_build_object('academy',current_setting('preview.academy'),
  'otherAcademy',current_setting('preview.other_academy'),
  'swimmers',8,'groups',3,'subscriptions',8,'monthlyObservations',48,'sessions',9,'guardianLinks',3,
  'synthetic',true) as preview_result;
commit;
