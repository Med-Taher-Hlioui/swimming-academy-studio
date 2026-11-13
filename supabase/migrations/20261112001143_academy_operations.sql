-- Fixed, typed transaction entry points. No caller-supplied SQL or acting-user arguments.
create function private.audit_event(
  p_academy uuid,p_actor uuid,p_action text,p_kind text,p_target uuid,
  p_details jsonb default '{}'::jsonb,p_request uuid default gen_random_uuid()
) returns void language plpgsql security definer set search_path = ''
as $$
declare target jsonb;
begin
  if p_kind not in ('membership','invitation','coach','swimmer','guardian_swimmer','group',
      'group_coach','group_swimmer','schedule_rule','session','session_coach','roster','note','academy')
  then raise exception 'Unsupported audit target' using errcode = '23514'; end if;
  target := jsonb_build_object('target_' || p_kind || '_id',p_target);
  insert into public.audit_logs(academy_id,actor_membership_id,action,request_id,details,
    target_membership_id,target_invitation_id,target_coach_id,target_swimmer_id,target_guardian_swimmer_id,
    target_group_id,target_group_coach_id,target_group_swimmer_id,target_schedule_rule_id,
    target_session_id,target_session_coach_id,target_roster_id,target_note_id)
  values(p_academy,p_actor,p_action,p_request,p_details,
    (target->>'target_membership_id')::uuid,(target->>'target_invitation_id')::uuid,
    (target->>'target_coach_id')::uuid,(target->>'target_swimmer_id')::uuid,(target->>'target_guardian_swimmer_id')::uuid,
    (target->>'target_group_id')::uuid,(target->>'target_group_coach_id')::uuid,(target->>'target_group_swimmer_id')::uuid,
    (target->>'target_schedule_rule_id')::uuid,(target->>'target_session_id')::uuid,(target->>'target_session_coach_id')::uuid,
    (target->>'target_roster_id')::uuid,(target->>'target_note_id')::uuid);
end $$;

create function private.validate_audit() returns trigger
language plpgsql set search_path = ''
as $$
declare key text;
begin
  if new.action <> 'academy_bootstrap' and new.actor_membership_id is null then
    raise exception 'Audit actor required' using errcode = '23514';
  end if;
  if new.action not in (
      'academy_bootstrap','membership_created','membership_updated','coach_created','coach_updated',
      'swimmer_created','swimmer_updated','group_created','group_updated','assignment_created','assignment_updated',
      'schedule_created','schedule_updated','session_created','session_updated','session_coach_created',
      'session_coach_updated','roster_created','roster_updated','invitation_created','invitation_updated',
      'guardian_created','guardian_updated','note_created','note_updated','attendance_changed','attendance_request')
  then raise exception 'Unsupported audit action' using errcode = '23514'; end if;
  if (case
    when new.action = 'academy_bootstrap' then num_nonnulls(new.target_membership_id,new.target_invitation_id,new.target_coach_id,new.target_swimmer_id,new.target_guardian_swimmer_id,new.target_group_id,new.target_group_coach_id,new.target_group_swimmer_id,new.target_schedule_rule_id,new.target_session_id,new.target_session_coach_id,new.target_roster_id,new.target_note_id) = 0
    when new.action like 'membership_%' then new.target_membership_id is not null
    when new.action like 'invitation_%' then new.target_invitation_id is not null
    when new.action like 'coach_%' then new.target_coach_id is not null
    when new.action like 'swimmer_%' then new.target_swimmer_id is not null
    when new.action like 'group_%' then new.target_group_id is not null
    when new.action like 'assignment_%' then num_nonnulls(new.target_group_coach_id,new.target_group_swimmer_id) = 1
    when new.action like 'schedule_%' then new.target_schedule_rule_id is not null
    when new.action like 'session_coach_%' then new.target_session_coach_id is not null
    when new.action like 'session_%' then new.target_session_id is not null
    when new.action like 'roster_%' then new.target_roster_id is not null
    when new.action like 'guardian_%' then new.target_guardian_swimmer_id is not null
    when new.action like 'note_%' then new.target_note_id is not null
    when new.action like 'attendance_%' then new.target_roster_id is not null
    else false end) is not true then
    raise exception 'Audit target does not match action' using errcode = '23514';
  end if;
  for key in select jsonb_object_keys(new.details) loop
    if key not in ('row_version','reason','fingerprint','status','version','changed','operator_id') then
      raise exception 'Unsupported audit detail' using errcode = '23514';
    end if;
    if key in ('fingerprint','status','version','changed') and new.action <> 'attendance_request' then
      raise exception 'Attendance receipt metadata used outside receipt' using errcode = '23514';
    end if;
  end loop;
  if new.action = 'attendance_request' and (new.target_roster_id is null
      or not (new.details ?& array['fingerprint','status','version','changed'])
      or (new.details->>'fingerprint') !~ '^[a-f0-9]{64}$') then
    raise exception 'Incomplete attendance receipt' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger validate_audit before insert on public.audit_logs for each row execute function private.validate_audit();

create function private.audit_mutation() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare actor uuid; kind text; action_prefix text;
begin
  actor := private.actor_membership(new.academy_id);
  -- Operator fixture/bootstrap writes are handled explicitly by the operator.
  if actor is null then return null; end if;
  kind := case tg_table_name
    when 'academy_memberships' then 'membership' when 'coaches' then 'coach'
    when 'swimmers' then 'swimmer' when 'groups' then 'group'
    when 'group_coaches' then 'group_coach' when 'group_swimmers' then 'group_swimmer'
    when 'schedule_rules' then 'schedule_rule' when 'sessions' then 'session'
    when 'session_coaches' then 'session_coach' when 'session_roster' then 'roster'
    when 'academy_invitations' then 'invitation' when 'guardian_swimmers' then 'guardian_swimmer'
    when 'swimmer_notes' then 'note' end;
  action_prefix := case kind when 'group_coach' then 'assignment' when 'group_swimmer' then 'assignment'
    when 'schedule_rule' then 'schedule' when 'guardian_swimmer' then 'guardian' else kind end;
  perform private.audit_event(new.academy_id,actor,
    action_prefix || case tg_op when 'INSERT' then '_created' else '_updated' end,
    kind,new.id,jsonb_build_object('row_version',new.row_version));
  return null;
end $$;
do $$
declare name text;
begin
  foreach name in array array['academy_memberships','coaches','swimmers','groups','group_coaches','group_swimmers',
    'schedule_rules','sessions','session_coaches','session_roster','academy_invitations','guardian_swimmers','swimmer_notes']
  loop execute format('create trigger audit_mutation after insert or update on public.%I for each row execute function private.audit_mutation()',name); end loop;
end $$;

create function public.academy_bootstrap(p_slug text,p_name text,p_profile uuid,p_display_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare tenant uuid; membership uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('academy-bootstrap:' || p_slug,0));
  if not exists(select 1 from auth.users where id = p_profile and email_confirmed_at is not null and not coalesce(is_anonymous,false))
  then raise exception 'Verified identity required' using errcode = '42501'; end if;
  select id into tenant from public.academies where slug = p_slug;
  if found then
    if exists(select 1 from public.academy_memberships where academy_id = tenant and profile_id = p_profile and role = 'admin' and status = 'active')
    then return tenant; end if;
    raise exception 'Academy ownership requires reviewed handover' using errcode = '42501';
  end if;
  insert into public.profiles(id,display_name) values(p_profile,p_display_name) on conflict(id) do nothing;
  insert into public.academies(slug,name) values(p_slug,p_name) returning id into tenant;
  insert into public.academy_memberships(academy_id,profile_id,role) values(tenant,p_profile,'admin') returning id into membership;
  perform private.audit_event(tenant,null,'academy_bootstrap','academy',tenant,jsonb_build_object('operator_id',p_profile));
  return tenant;
end $$;

create function public.academy_set_membership(p_academy uuid,p_profile uuid,p_role text,p_active boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare membership uuid;
begin
  perform private.require_admin(p_academy);
  if not exists(select 1 from public.profiles p join auth.users u on u.id = p.id
      where p.id = p_profile and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false))
  then raise exception 'Verified profile unavailable' using errcode = '42501'; end if;
  insert into public.academy_memberships(academy_id,profile_id,role,status,revoked_at)
    values(p_academy,p_profile,p_role,case when p_active then 'active' else 'revoked' end,
      case when p_active then null else clock_timestamp() end)
  on conflict(academy_id,profile_id,role) do update
    set status = excluded.status,revoked_at = excluded.revoked_at
  returning id into membership;
  return membership;
end $$;

create function public.academy_save_coach(
  p_academy uuid,p_name text,p_id uuid default null,p_expected bigint default null,
  p_membership uuid default null,p_archive boolean default false
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare result uuid;
begin
  perform private.require_admin(p_academy);
  if p_membership is not null and not exists(select 1 from public.academy_memberships
      where academy_id = p_academy and id = p_membership and role = 'coach' and status = 'active')
  then raise exception 'Active Coach membership required' using errcode = '23514'; end if;
  if p_id is null then
    insert into public.coaches(academy_id,display_name,membership_id)
      values(p_academy,btrim(p_name),p_membership) returning id into result;
  else
    if p_archive and exists(select 1 from public.session_coaches sc join public.sessions s
      on s.academy_id = sc.academy_id and s.id = sc.session_id
      where sc.academy_id = p_academy and sc.coach_id = p_id and sc.access_revoked_at is null
        and s.session_date >= private.academy_today(p_academy) and s.status <> 'cancelled')
    then raise exception 'Reconcile upcoming sessions before archiving' using errcode = '23514'; end if;
    update public.coaches set display_name = btrim(p_name),membership_id = coalesce(p_membership,membership_id),
      archived_at = case when p_archive then clock_timestamp() else null end
      where academy_id = p_academy and id = p_id and row_version = p_expected returning id into result;
    if not found then raise exception 'Record unavailable or stale version' using errcode = '40001'; end if;
  end if;
  return result;
end $$;

create function public.academy_save_swimmer(
  p_academy uuid,p_name text,p_level text,p_status text default 'active',
  p_id uuid default null,p_expected bigint default null,p_archive boolean default false
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare result uuid;
begin
  perform private.require_admin(p_academy);
  if p_id is null then
    insert into public.swimmers(academy_id,display_name,level,status)
      values(p_academy,btrim(p_name),p_level,p_status) returning id into result;
  else
    update public.swimmers set display_name = btrim(p_name),level = p_level,status = p_status,
      archived_at = case when p_archive then clock_timestamp() else null end
      where academy_id = p_academy and id = p_id and row_version = p_expected returning id into result;
    if not found then raise exception 'Record unavailable or stale version' using errcode = '40001'; end if;
  end if;
  return result;
end $$;

create function public.academy_save_group(
  p_academy uuid,p_name text,p_level text,p_capacity smallint,p_schedule text default null,
  p_id uuid default null,p_expected bigint default null,p_archive boolean default false
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare result uuid;
begin
  perform private.require_admin(p_academy);
  if p_id is null then
    insert into public.groups(academy_id,name,level,capacity,schedule_label)
      values(p_academy,btrim(p_name),p_level,p_capacity,p_schedule) returning id into result;
  else
    if p_archive and exists(select 1 from public.group_swimmers where academy_id = p_academy and group_id = p_id
      and cancelled_at is null and (valid_until is null or valid_until > private.academy_today(p_academy)))
    then raise exception 'Close allocations before archiving' using errcode = '23514'; end if;
    update public.groups set name = btrim(p_name),level = p_level,capacity = p_capacity,schedule_label = p_schedule,
      archived_at = case when p_archive then clock_timestamp() else null end
      where academy_id = p_academy and id = p_id and row_version = p_expected returning id into result;
    if not found then raise exception 'Record unavailable or stale version' using errcode = '40001'; end if;
  end if;
  return result;
end $$;

create function public.academy_assign_coach(
  p_academy uuid,p_group uuid,p_coach uuid,p_from date,p_until date default null,p_primary boolean default false
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare result uuid;
begin
  perform private.require_admin(p_academy);
  if not exists(select 1 from public.groups where academy_id = p_academy and id = p_group and archived_at is null)
    or not exists(select 1 from public.coaches where academy_id = p_academy and id = p_coach and archived_at is null)
  then raise exception 'Group or coach unavailable' using errcode = '23514'; end if;
  insert into public.group_coaches(academy_id,group_id,coach_id,valid_from,valid_until,is_primary)
    values(p_academy,p_group,p_coach,p_from,p_until,p_primary) returning id into result;
  return result;
end $$;

create function public.academy_transfer_swimmer(p_academy uuid,p_swimmer uuid,p_group uuid,p_from date,p_until date default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare result uuid;
begin
  perform private.require_admin(p_academy);
  perform 1 from public.swimmers where academy_id = p_academy and id = p_swimmer for update;
  if not found then raise exception 'Swimmer unavailable' using errcode = '23514'; end if;
  -- Same-day conflicting rows are cancelled; older allocations end on the transfer day.
  update public.group_swimmers set cancelled_at = clock_timestamp()
    where academy_id = p_academy and swimmer_id = p_swimmer and cancelled_at is null and valid_from = p_from;
  update public.group_swimmers set valid_until = p_from
    where academy_id = p_academy and swimmer_id = p_swimmer and cancelled_at is null
      and valid_from < p_from and valid_during @> p_from;
  if p_group is not null then
    insert into public.group_swimmers(academy_id,group_id,swimmer_id,valid_from,valid_until)
      values(p_academy,p_group,p_swimmer,p_from,p_until) returning id into result;
  end if;
  return result;
end $$;

create function public.academy_end_assignment(p_academy uuid,p_kind text,p_id uuid,p_until date,p_expected bigint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_academy);
  if p_kind = 'coach' then
    update public.group_coaches set valid_until = p_until where academy_id = p_academy and id = p_id and row_version = p_expected;
  elsif p_kind = 'swimmer' then
    update public.group_swimmers set valid_until = p_until where academy_id = p_academy and id = p_id and row_version = p_expected;
  else raise exception 'Unknown assignment type' using errcode = '23514'; end if;
  if not found then raise exception 'Record unavailable or stale version' using errcode = '40001'; end if;
end $$;

create function public.academy_schedule_rule(
  p_academy uuid,p_group uuid,p_weekday smallint,p_start time,p_end time,p_from date,p_until date default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare result uuid; zone text;
begin
  perform private.require_admin(p_academy);
  select timezone into zone from public.academies where id = p_academy;
  insert into public.schedule_rules(academy_id,group_id,weekday,starts_local,ends_local,timezone,valid_from,valid_until)
    values(p_academy,p_group,p_weekday,p_start,p_end,zone,p_from,p_until) returning id into result;
  return result;
end $$;
create function public.academy_end_schedule_rule(p_academy uuid,p_id uuid,p_until date,p_expected bigint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_academy);
  update public.schedule_rules set valid_until = p_until where academy_id = p_academy and id = p_id and row_version = p_expected;
  if not found then raise exception 'Record unavailable or stale version' using errcode = '40001'; end if;
end $$;

create function private.local_instant(p_day date,p_time time,p_zone text) returns timestamptz
language plpgsql stable set search_path = ''
as $$
declare result timestamptz; local_value timestamp;
begin
  local_value := p_day + p_time;
  result := local_value at time zone p_zone;
  if result at time zone p_zone <> local_value or exists(
    select 1 from generate_series(-12,12) offset_value
    where offset_value <> 0 and (result + offset_value * interval '15 minutes') at time zone p_zone = local_value)
  then raise exception 'Ambiguous or nonexistent local time requires a manual occurrence' using errcode = '23514'; end if;
  return result;
end $$;

create function public.academy_create_session(
  p_academy uuid,p_group uuid,p_day date,p_rule uuid default null,
  p_start timestamptz default null,p_end timestamptz default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare result uuid; training_group public.groups; recurrence public.schedule_rules; zone text;
begin
  perform private.require_admin(p_academy);
  select * into strict training_group from public.groups where academy_id = p_academy and id = p_group and archived_at is null;
  select timezone into zone from public.academies where id = p_academy;
  if p_rule is not null then
    select * into strict recurrence from public.schedule_rules where academy_id = p_academy and id = p_rule
      and group_id = p_group and cancelled_at is null and valid_during @> p_day;
    if recurrence.weekday <> extract(isodow from p_day)::integer or recurrence.timezone <> zone then
      raise exception 'Schedule rule does not match the academy date' using errcode = '23514';
    end if;
    p_start := private.local_instant(p_day,recurrence.starts_local,zone);
    p_end := private.local_instant(p_day,recurrence.ends_local,zone);
  end if;
  select id into result from public.sessions where academy_id = p_academy and group_id = p_group and session_date = p_day;
  if found then
    if exists(select 1 from public.sessions where id = result and schedule_rule_id is not distinct from p_rule
      and starts_at is not distinct from p_start and ends_at is not distinct from p_end) then return result; end if;
    raise exception 'An occurrence already exists for this group and day' using errcode = '23505';
  end if;
  insert into public.sessions(academy_id,group_id,schedule_rule_id,session_date,starts_at,ends_at,timezone,
    group_name_snapshot,level_snapshot,capacity_snapshot)
  values(p_academy,p_group,p_rule,p_day,p_start,p_end,zone,training_group.name,training_group.level,training_group.capacity)
  returning id into result;
  insert into public.session_coaches(academy_id,session_id,group_id,coach_id,group_coach_id,coach_name_snapshot,is_primary,assignment_source)
    select p_academy,result,p_group,c.id,gc.id,c.display_name,gc.is_primary,'group'
    from public.group_coaches gc join public.coaches c on c.academy_id = gc.academy_id and c.id = gc.coach_id
    where gc.academy_id = p_academy and gc.group_id = p_group and gc.cancelled_at is null
      and gc.valid_during @> p_day and c.archived_at is null;
  insert into public.session_roster(academy_id,session_id,group_id,swimmer_id,group_swimmer_id,swimmer_name_snapshot,level_snapshot,roster_source)
    select p_academy,result,p_group,w.id,gs.id,w.display_name,w.level,'group'
    from public.group_swimmers gs join public.swimmers w on w.academy_id = gs.academy_id and w.id = gs.swimmer_id
    where gs.academy_id = p_academy and gs.group_id = p_group and gs.cancelled_at is null
      and gs.valid_during @> p_day and w.archived_at is null;
  if not exists(select 1 from public.session_roster where academy_id = p_academy and session_id = result)
    or (select count(*) from public.session_coaches where academy_id = p_academy and session_id = result and is_primary) <> 1
  then raise exception 'Session requires swimmers and one primary coach' using errcode = '23514'; end if;
  return result;
end $$;

create function public.academy_generate_sessions(p_academy uuid,p_group uuid,p_from date,p_until date)
returns setof uuid language plpgsql security definer set search_path = ''
as $$
declare recurrence record;
begin
  perform private.require_admin(p_academy);
  if p_until < p_from or p_until - p_from > 90 then
    raise exception 'Generate at most 90 days per request' using errcode = '23514';
  end if;
  for recurrence in select r.id,d::date as occurrence_date from public.schedule_rules r
    cross join generate_series(p_from::timestamp,p_until::timestamp,interval '1 day') d
    where r.academy_id = p_academy and r.group_id = p_group and r.cancelled_at is null
      and r.valid_during @> d::date and r.weekday = extract(isodow from d)::integer order by d
  loop return next public.academy_create_session(p_academy,p_group,recurrence.occurrence_date,recurrence.id); end loop;
end $$;

create function public.academy_session_status(p_academy uuid,p_session uuid,p_status text,p_expected bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare occurrence public.sessions;
begin
  perform private.require_admin(p_academy);
  select * into strict occurrence from public.sessions where academy_id = p_academy and id = p_session for update;
  if occurrence.row_version <> p_expected then raise exception 'Stale session version' using errcode = '40001'; end if;
  if p_status not in ('open','closed','cancelled') or occurrence.status = 'cancelled'
    or (p_status = 'open' and occurrence.status <> 'scheduled')
    or (p_status = 'closed' and occurrence.status <> 'open')
    or (p_status in ('open','closed') and occurrence.session_date > private.academy_today(p_academy))
  then raise exception 'Invalid session transition' using errcode = '23514'; end if;
  update public.sessions set status = p_status,
    opened_at = case when p_status = 'open' then clock_timestamp() else opened_at end,
    closed_at = case when p_status = 'closed' then clock_timestamp() else closed_at end,
    cancelled_at = case when p_status = 'cancelled' then clock_timestamp() else cancelled_at end
    where academy_id = p_academy and id = p_session;
end $$;

create function public.academy_amend_roster(
  p_academy uuid,p_session uuid,p_swimmer uuid,p_withdraw boolean,p_reason text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare occurrence public.sessions; result uuid; participant public.swimmers;
begin
  perform private.require_admin(p_academy);
  if coalesce(length(btrim(p_reason)),0) = 0 then raise exception 'Amendment reason required' using errcode = '23514'; end if;
  select * into strict occurrence from public.sessions where academy_id = p_academy and id = p_session and status <> 'cancelled' for update;
  if p_withdraw then
    update public.session_roster set withdrawn_at = clock_timestamp(),withdrawal_reason = p_reason
      where academy_id = p_academy and session_id = p_session and swimmer_id = p_swimmer and withdrawn_at is null returning id into result;
    if not found then raise exception 'Roster entry unavailable' using errcode = '23514'; end if;
  else
    select * into strict participant from public.swimmers where academy_id = p_academy and id = p_swimmer and archived_at is null;
    if participant.level <> occurrence.level_snapshot then raise exception 'Swimmer level does not match session' using errcode = '23514'; end if;
    if (select count(*) from public.session_roster where academy_id = p_academy and session_id = p_session and withdrawn_at is null) >= occurrence.capacity_snapshot
    then raise exception 'Session capacity exceeded' using errcode = '23514'; end if;
    insert into public.session_roster(academy_id,session_id,group_id,swimmer_id,swimmer_name_snapshot,level_snapshot,roster_source,added_reason)
      values(p_academy,p_session,occurrence.group_id,p_swimmer,participant.display_name,participant.level,'manual',p_reason) returning id into result;
  end if;
  return result;
end $$;

create function public.academy_substitute_coach(
  p_academy uuid,p_session uuid,p_coach uuid,p_replace uuid,p_primary boolean,p_reason text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare occurrence public.sessions; coach_name text; result uuid;
begin
  perform private.require_admin(p_academy);
  if coalesce(length(btrim(p_reason)),0) = 0 then raise exception 'Substitution reason required' using errcode = '23514'; end if;
  select * into strict occurrence from public.sessions where academy_id = p_academy and id = p_session and status <> 'cancelled' for update;
  select display_name into strict coach_name from public.coaches where academy_id = p_academy and id = p_coach and archived_at is null;
  if p_replace is not null then
    update public.session_coaches set access_revoked_at = clock_timestamp() where academy_id = p_academy and session_id = p_session and coach_id = p_replace;
    if not found then raise exception 'Prior coach unavailable' using errcode = '23514'; end if;
  end if;
  insert into public.session_coaches(academy_id,session_id,group_id,coach_id,coach_name_snapshot,is_primary,assignment_source,substitution_reason)
    values(p_academy,p_session,occurrence.group_id,p_coach,coach_name,p_primary,'substitute',p_reason)
  on conflict(academy_id,session_id,coach_id) do update
    set access_revoked_at = null,is_primary = excluded.is_primary,substitution_reason = excluded.substitution_reason
  returning id into result;
  return result;
end $$;

create function public.academy_revoke_session_coach(p_academy uuid,p_session uuid,p_coach uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_academy);
  update public.session_coaches set access_revoked_at = clock_timestamp()
    where academy_id = p_academy and session_id = p_session and coach_id = p_coach;
  if not found then raise exception 'Session coach unavailable' using errcode = '23514'; end if;
end $$;

create function public.academy_issue_invitation(
  p_academy uuid,p_email text,p_role text,p_swimmer uuid default null,
  p_relationship text default null,p_history_from date default null,p_relationship_verified boolean default false
) returns table(invitation_id uuid,token text,expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare actor uuid; recipient text; issued_token text;
begin
  actor := private.require_admin(p_academy);
  recipient := lower(btrim(p_email));
  if recipient is null or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Valid recipient required' using errcode = '23514';
  end if;
  if p_role = 'parent' and (p_relationship_verified is distinct from true or p_history_from is null or p_swimmer is null or p_relationship is null) then
    raise exception 'Prior verification and approved historical access date required' using errcode = '23514';
  end if;
  if p_role = 'parent' and not exists(select 1 from public.swimmers where academy_id = p_academy and id = p_swimmer and archived_at is null) then
    raise exception 'Swimmer unavailable' using errcode = '23514';
  end if;
  update public.academy_invitations set status = 'revoked',revoked_at = clock_timestamp()
    where academy_id = p_academy and recipient_email_normalized = recipient and invited_role = p_role and status = 'pending'
      and swimmer_id is not distinct from p_swimmer;
  issued_token := rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
  return query
    insert into public.academy_invitations(academy_id,recipient_email_normalized,invited_role,swimmer_id,relationship,
      history_visible_from,relationship_verified_at,verified_by_membership_id,invited_by_membership_id,token_hash)
    values(p_academy,recipient,p_role,p_swimmer,p_relationship,p_history_from,
      case when p_role = 'parent' then clock_timestamp() else null end,
      case when p_role = 'parent' then actor else null end,actor,extensions.digest(issued_token,'sha256'))
    returning id,issued_token,academy_invitations.expires_at;
end $$;

create function public.academy_revoke_invitation(p_academy uuid,p_invitation uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_academy);
  update public.academy_invitations set status = 'revoked',revoked_at = clock_timestamp()
    where academy_id = p_academy and id = p_invitation and status = 'pending';
  if not found then raise exception 'Pending invitation unavailable' using errcode = '23514'; end if;
end $$;

create function public.academy_list_invitations(p_academy uuid)
returns table(id uuid,recipient text,role text,status text,expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin(p_academy);
  return query select i.id,i.recipient_email_normalized,i.invited_role,
    case when i.status = 'pending' and i.expires_at <= clock_timestamp() then 'expired' else i.status end,i.expires_at
    from public.academy_invitations i where i.academy_id = p_academy order by i.created_at desc;
end $$;

create function public.academy_accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare invitation public.academy_invitations; actor uuid; recipient text; membership public.academy_memberships;
begin
  actor := private.current_user_id();
  if actor is null or p_token is null or length(p_token) <> 43 then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;
  select * into invitation from public.academy_invitations where token_hash = extensions.digest(p_token,'sha256');
  if not found then raise exception 'Invitation unavailable' using errcode = '42501'; end if;
  perform private.lock_academy(invitation.academy_id);
  select * into strict invitation from public.academy_invitations where id = invitation.id for update;
  select lower(btrim(email)) into recipient from auth.users where id = actor and email_confirmed_at is not null;
  if invitation.status <> 'pending' or invitation.expires_at <= clock_timestamp()
    or recipient is distinct from invitation.recipient_email_normalized
    or not exists(select 1 from public.academies where id = invitation.academy_id and status = 'active')
    or not exists(select 1 from public.academy_memberships where academy_id = invitation.academy_id
      and id = invitation.invited_by_membership_id and role = 'admin' and status = 'active')
  then raise exception 'Invitation unavailable' using errcode = '42501'; end if;
  if invitation.invited_role = 'parent' and (
    invitation.relationship_verified_at is null or invitation.history_visible_from is null
    or not exists(select 1 from public.swimmers where academy_id = invitation.academy_id and id = invitation.swimmer_id and archived_at is null))
  then raise exception 'Invitation unavailable' using errcode = '42501'; end if;
  select * into membership from public.academy_memberships
    where academy_id = invitation.academy_id and profile_id = actor and role = invitation.invited_role;
  if found and membership.status = 'revoked' and membership.revoked_at >= invitation.issued_at then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;
  insert into public.profiles(id,display_name) values(actor,'Academy member') on conflict(id) do nothing;
  insert into public.academy_memberships(academy_id,profile_id,role)
    values(invitation.academy_id,actor,invitation.invited_role)
  on conflict(academy_id,profile_id,role) do update set status = 'active',revoked_at = null
  returning * into membership;
  update public.academy_invitations set status = 'accepted',accepted_at = clock_timestamp(),accepted_by_membership_id = membership.id
    where id = invitation.id;
  if invitation.invited_role = 'parent' then
    if exists(select 1 from public.guardian_swimmers where academy_id = invitation.academy_id
        and parent_membership_id = membership.id and swimmer_id = invitation.swimmer_id and revoked_at is null)
    then raise exception 'Relationship already granted; administrator review required' using errcode = '23514'; end if;
    insert into public.guardian_swimmers(academy_id,parent_membership_id,swimmer_id,relationship,
      verified_at,verified_by_membership_id,accepted_invitation_id,history_visible_from)
    values(invitation.academy_id,membership.id,invitation.swimmer_id,invitation.relationship,
      invitation.relationship_verified_at,invitation.verified_by_membership_id,invitation.id,invitation.history_visible_from);
  end if;
  return membership.id;
end $$;

create function public.academy_revoke_guardian(p_academy uuid,p_relationship uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid;
begin
  actor := private.require_admin(p_academy);
  update public.guardian_swimmers set revoked_at = clock_timestamp(),revoked_by_membership_id = actor
    where academy_id = p_academy and id = p_relationship and revoked_at is null;
  if not found then raise exception 'Relationship unavailable' using errcode = '23514'; end if;
end $$;

create function private.attendance_actor(p_academy uuid,p_session uuid,p_swimmer uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare occurrence public.sessions;
begin
  perform private.lock_academy(p_academy);
  select * into occurrence from public.sessions where academy_id = p_academy and id = p_session;
  if not found or occurrence.status = 'cancelled' or occurrence.session_date > private.academy_today(p_academy)
    or not exists(select 1 from public.session_roster where academy_id = p_academy
      and session_id = p_session and swimmer_id = p_swimmer and withdrawn_at is null)
    or not (private.has_role(p_academy,'admin') or (occurrence.status = 'open' and private.coach_session(p_academy,p_session)))
  then raise exception 'Attendance operation not permitted' using errcode = '42501'; end if;
  return private.actor_membership(p_academy);
end $$;

create function private.capture_attendance() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare entry public.attendance; before_status text; after_status text; actor uuid; version bigint; request uuid; fingerprint bytea; reason text;
begin
  if tg_op = 'DELETE' then entry := old; else entry := new; end if;
  actor := private.attendance_actor(entry.academy_id,entry.session_id,entry.swimmer_id);
  before_status := case when tg_op = 'INSERT' then null else old.status end;
  after_status := case when tg_op = 'DELETE' then null else new.status end;
  if before_status is not distinct from after_status then return null; end if;
  request := nullif(current_setting('academy.request_id',true),'')::uuid;
  fingerprint := decode(current_setting('academy.fingerprint',true),'hex');
  reason := nullif(current_setting('academy.reason',true),'');
  if request is null or fingerprint is null then raise exception 'Controlled attendance operation required' using errcode = '42501'; end if;
  if exists(select 1 from public.sessions where academy_id = entry.academy_id and id = entry.session_id and status = 'closed')
    and coalesce(length(btrim(reason)),0) = 0
  then raise exception 'Closed-session correction reason required' using errcode = '23514'; end if;
  update public.session_roster set attendance_version = attendance_version + 1
    where academy_id = entry.academy_id and id = entry.roster_id returning attendance_version into version;
  insert into public.attendance_history(academy_id,session_id,swimmer_id,roster_id,revision,previous_status,new_status,
    actor_membership_id,request_id,request_fingerprint,reason)
  values(entry.academy_id,entry.session_id,entry.swimmer_id,entry.roster_id,version,before_status,after_status,actor,request,fingerprint,reason);
  perform private.audit_event(entry.academy_id,actor,'attendance_changed','roster',entry.roster_id,jsonb_build_object('row_version',version),request);
  return null;
end $$;
create trigger attendance_history_capture after insert or update or delete on public.attendance
  for each row execute function private.capture_attendance();

create function public.academy_mark_attendance(
  p_academy uuid,p_session uuid,p_swimmer uuid,p_status text,p_expected bigint,p_request uuid,p_reason text default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare actor uuid; roster public.session_roster; receipt public.audit_logs; fingerprint text; previous text; result jsonb; reason text; resulting_version bigint;
begin
  actor := private.attendance_actor(p_academy,p_session,p_swimmer);
  if p_request is null or (p_status is not null and p_status not in ('present','absent','excused')) then
    raise exception 'Invalid attendance request' using errcode = '23514';
  end if;
  reason := nullif(btrim(p_reason),'');
  fingerprint := encode(extensions.digest(jsonb_build_object('actor',actor,'session',p_session,
    'swimmer',p_swimmer,'status',p_status,'expected',p_expected,'reason',reason)::text,'sha256'),'hex');
  select * into receipt from public.audit_logs where academy_id = p_academy and request_id = p_request and action = 'attendance_request';
  if found then
    if receipt.actor_membership_id <> actor or receipt.details->>'fingerprint' <> fingerprint then
      raise exception 'Request identifier reused with different arguments' using errcode = '23514';
    end if;
    return receipt.details - 'fingerprint';
  end if;
  select * into strict roster from public.session_roster
    where academy_id = p_academy and session_id = p_session and swimmer_id = p_swimmer for update;
  if p_expected is null or p_expected <> roster.attendance_version then raise exception 'Stale attendance version' using errcode = '40001'; end if;
  select status into previous from public.attendance where academy_id = p_academy and roster_id = roster.id;
  perform set_config('academy.request_id',p_request::text,true);
  perform set_config('academy.fingerprint',fingerprint,true);
  perform set_config('academy.reason',coalesce(reason,''),true);
  if previous is distinct from p_status then
    if p_status is null then
      delete from public.attendance where academy_id = p_academy and roster_id = roster.id;
    else
      insert into public.attendance(academy_id,session_id,swimmer_id,roster_id,status)
        values(p_academy,p_session,p_swimmer,roster.id,p_status)
      on conflict(academy_id,session_id,swimmer_id) do update set status = excluded.status,marked_at = clock_timestamp();
    end if;
  end if;
  select attendance_version into resulting_version from public.session_roster where id = roster.id;
  result := jsonb_build_object('status',p_status,'version',resulting_version,'changed',previous is distinct from p_status);
  perform private.audit_event(p_academy,actor,'attendance_request','roster',roster.id,result || jsonb_build_object('fingerprint',fingerprint),p_request);
  return result;
end $$;

create function public.academy_save_note(
  p_academy uuid,p_swimmer uuid,p_body text,p_session uuid default null,p_id uuid default null,p_expected bigint default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare actor uuid; result uuid;
begin
  perform private.lock_academy(p_academy);
  actor := private.actor_membership(p_academy);
  if actor is null or not (private.has_role(p_academy,'admin') or private.coach_swimmer(p_academy,p_swimmer)) then
    raise exception 'Note operation not permitted' using errcode = '42501';
  end if;
  if p_id is null then
    insert into public.swimmer_notes(academy_id,swimmer_id,author_membership_id,session_id,body)
      values(p_academy,p_swimmer,actor,p_session,btrim(p_body)) returning id into result;
  else
    update public.swimmer_notes set body = btrim(p_body)
      where academy_id = p_academy and id = p_id and swimmer_id = p_swimmer and session_id is not distinct from p_session
        and row_version = p_expected and deleted_at is null
        and (private.has_role(p_academy,'admin') or author_membership_id = actor)
      returning id into result;
    if not found then raise exception 'Note unavailable or stale version' using errcode = '40001'; end if;
  end if;
  return result;
end $$;

create function public.academy_publish_note(p_academy uuid,p_note uuid,p_expected bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor uuid;
begin
  actor := private.require_admin(p_academy);
  update public.swimmer_notes set visibility = 'parent_visible',published_at = clock_timestamp(),published_by_membership_id = actor
    where academy_id = p_academy and id = p_note and row_version = p_expected and deleted_at is null;
  if not found then raise exception 'Note unavailable or stale version' using errcode = '40001'; end if;
end $$;

create function public.academy_delete_note(p_academy uuid,p_note uuid,p_expected bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare note public.swimmer_notes; actor uuid;
begin
  perform private.lock_academy(p_academy);
  actor := private.actor_membership(p_academy);
  select * into strict note from public.swimmer_notes where academy_id = p_academy and id = p_note;
  if not (private.has_role(p_academy,'admin') or (note.author_membership_id = actor and private.coach_swimmer(p_academy,note.swimmer_id)))
  then raise exception 'Note operation not permitted' using errcode = '42501'; end if;
  update public.swimmer_notes set deleted_at = clock_timestamp() where id = note.id and row_version = p_expected;
  if not found then raise exception 'Stale note version' using errcode = '40001'; end if;
end $$;

-- New functions default to PUBLIC execution in PostgreSQL. Restrict every entry point.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_user_id(), private.has_role(uuid,text),
  private.actor_membership(uuid), private.academy_today(uuid), private.own_coach(uuid,uuid),
  private.coach_group(uuid,uuid), private.coach_session(uuid,uuid), private.coach_swimmer(uuid,uuid),
  private.parent_history_from(uuid,uuid), private.parent_session(uuid,uuid,uuid),
  private.can_read_session(uuid,uuid), private.can_read_group(uuid,uuid), private.can_read_coach(uuid,uuid)
to authenticated;
do $$
declare routine record;
begin
  for routine in select p.oid::regprocedure identity,p.proname from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and left(p.proname,8) = 'academy_'
  loop
    execute format('revoke all on function %s from public, anon, authenticated',routine.identity);
    if routine.proname = 'academy_bootstrap' then
      execute format('grant execute on function %s to service_role',routine.identity);
    else
      execute format('grant execute on function %s to authenticated',routine.identity);
    end if;
  end loop;
end $$;
