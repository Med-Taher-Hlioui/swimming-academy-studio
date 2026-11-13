set search_path = public, extensions;

create function private.academy_today(p_academy uuid) returns date
language sql stable security definer set search_path = ''
as $$ select (statement_timestamp() at time zone a.timezone)::date from public.academies a where a.id = p_academy $$;

create function private.lock_academy(p_academy uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.academies where id = p_academy for update;
  if not found then raise exception 'Academy unavailable' using errcode = '42501'; end if;
end $$;

create function private.guard_row() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare tenant uuid; old_json jsonb; new_json jsonb; column_name text;
begin
  if tg_op = 'DELETE' then
    raise exception 'Historical rows must be archived' using errcode = '23514';
  end if;
  new_json := to_jsonb(new);
  tenant := case when tg_table_name = 'academies' then new.id
    else (new_json->>'academy_id')::uuid end;
  if tenant is not null and not (tg_table_name = 'academies' and tg_op = 'INSERT') then
    perform private.lock_academy(tenant);
  end if;
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
    new.updated_at := new.created_at;
    new.row_version := 1;
  else
    old_json := to_jsonb(old);
    foreach column_name in array array['id','academy_id','created_at'] || tg_argv loop
      if new_json->column_name is distinct from old_json->column_name then
        raise exception 'Immutable identity or snapshot field' using errcode = '23514';
      end if;
    end loop;
    new.updated_at := clock_timestamp();
    new.row_version := old.row_version + 1;
  end if;
  return new;
end $$;

create function private.guard_membership() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.lock_academy(old.academy_id);
  if new.profile_id is null then
    new.status := 'revoked';
    new.revoked_at := coalesce(new.revoked_at,clock_timestamp());
  elsif new.profile_id is distinct from old.profile_id then
    raise exception 'Membership identity is immutable' using errcode = '23514';
  end if;
  if old.role = 'admin' and old.status = 'active' and new.status <> 'active'
     and exists(select 1 from public.academies where id = old.academy_id and status = 'active')
     and not exists(select 1 from public.academy_memberships
       where academy_id = old.academy_id and role = 'admin' and status = 'active' and id <> old.id)
  then raise exception 'The last administrator cannot be removed' using errcode = '23514'; end if;
  return new;
end $$;

create function private.guard_profile_delete() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare academy uuid;
begin
  for academy in select distinct academy_id from public.academy_memberships
    where profile_id = old.id order by academy_id
  loop perform private.lock_academy(academy); end loop;
  update public.academy_memberships set status = 'revoked', revoked_at = clock_timestamp()
    where profile_id = old.id and status = 'active';
  return old;
end $$;

create function private.guard_coach_identity() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.membership_id is not null and new.membership_id is distinct from old.membership_id then
    raise exception 'Coach account cannot be reassigned' using errcode = '23514';
  end if;
  return new;
end $$;

create function private.assert_capacity(p_academy uuid,p_group uuid,p_from date) returns void
language plpgsql security definer set search_path = ''
as $$
declare boundary date; maximum integer;
begin
  select capacity into strict maximum from public.groups where academy_id = p_academy and id = p_group;
  for boundary in
    select distinct d from (
      select valid_from d from public.group_swimmers where academy_id = p_academy and group_id = p_group and cancelled_at is null
      union all select valid_until from public.group_swimmers where academy_id = p_academy and group_id = p_group and cancelled_at is null
      union all select p_from
    ) dates where d >= p_from
  loop
    if (select count(*) from public.group_swimmers
        where academy_id = p_academy and group_id = p_group and cancelled_at is null and valid_during @> boundary) > maximum
    then raise exception 'Group capacity exceeded' using errcode = '23514'; end if;
  end loop;
  if exists(select 1 from public.sessions s where s.academy_id = p_academy and s.group_id = p_group
      and s.session_date >= p_from and s.status <> 'cancelled'
      and (select count(*) from public.session_roster r
           where r.academy_id = s.academy_id and r.session_id = s.id and r.withdrawn_at is null) > maximum)
  then raise exception 'Future session roster exceeds capacity' using errcode = '23514'; end if;
end $$;

create function private.check_allocation() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare participant public.swimmers; training_group public.groups; session_record record;
begin
  select * into strict participant from public.swimmers where academy_id = new.academy_id and id = new.swimmer_id;
  select * into strict training_group from public.groups where academy_id = new.academy_id and id = new.group_id;
  if new.cancelled_at is null and (participant.archived_at is not null or training_group.archived_at is not null or participant.level <> training_group.level)
  then raise exception 'Swimmer and group must be active and level-compatible' using errcode = '23514'; end if;
  for session_record in
    select s.session_date,r.withdrawn_at from public.session_roster r
    join public.sessions s on s.academy_id = r.academy_id and s.id = r.session_id
    where r.academy_id = new.academy_id and r.group_swimmer_id = new.id
  loop
    if (session_record.session_date < private.academy_today(new.academy_id) or session_record.withdrawn_at is null)
      and (new.cancelled_at is not null or not (new.valid_during @> session_record.session_date))
    then raise exception 'Assignment change invalidates a session snapshot' using errcode = '23514'; end if;
  end loop;
  perform private.assert_capacity(new.academy_id,new.group_id,new.valid_from);
  return null;
end $$;

create function private.check_group_capacity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.capacity <> old.capacity then
    perform private.assert_capacity(new.academy_id,new.id,private.academy_today(new.academy_id));
  end if;
  if new.level <> old.level and exists(select 1 from public.group_swimmers gs
      join public.swimmers w on w.academy_id = gs.academy_id and w.id = gs.swimmer_id
      where gs.academy_id = new.academy_id and gs.group_id = new.id and gs.cancelled_at is null
        and (gs.valid_until is null or gs.valid_until > private.academy_today(new.academy_id)) and w.level <> new.level)
  then raise exception 'Group level conflicts with allocations' using errcode = '23514'; end if;
  return null;
end $$;

create function private.check_swimmer_level() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.level <> old.level or new.archived_at is distinct from old.archived_at)
    and exists(select 1 from public.group_swimmers gs join public.groups g on g.academy_id = gs.academy_id and g.id = gs.group_id
      where gs.academy_id = new.academy_id and gs.swimmer_id = new.id and gs.cancelled_at is null
        and (gs.valid_until is null or gs.valid_until > private.academy_today(new.academy_id))
        and (new.archived_at is not null or g.level <> new.level))
  then raise exception 'Swimmer changes require allocation review' using errcode = '23514'; end if;
  return null;
end $$;

create function private.check_coach_range() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists(select 1 from public.session_coaches sc join public.sessions s on s.academy_id = sc.academy_id and s.id = sc.session_id
      where sc.academy_id = new.academy_id and sc.group_coach_id = new.id
        and (s.session_date < private.academy_today(new.academy_id) or sc.access_revoked_at is null)
        and (new.cancelled_at is not null or not (new.valid_during @> s.session_date)))
  then raise exception 'Coach assignment change invalidates a session snapshot' using errcode = '23514'; end if;
  return null;
end $$;

create function private.check_snapshot() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare occurrence public.sessions; period daterange; cancelled timestamptz;
begin
  select * into strict occurrence from public.sessions where academy_id = new.academy_id and id = new.session_id;
  if tg_table_name = 'session_roster' then
    if new.group_swimmer_id is not null then
      select valid_during,cancelled_at into period,cancelled from public.group_swimmers
        where academy_id = new.academy_id and id = new.group_swimmer_id;
      if cancelled is not null or not coalesce(period @> occurrence.session_date,false) then
        raise exception 'Roster source is not effective on session date' using errcode = '23514';
      end if;
    end if;
  elsif tg_table_name = 'session_coaches' then
    if new.group_coach_id is not null then
      select valid_during,cancelled_at into period,cancelled from public.group_coaches
        where academy_id = new.academy_id and id = new.group_coach_id;
      if cancelled is not null or not coalesce(period @> occurrence.session_date,false) then
        raise exception 'Coach source is not effective on session date' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;

create function private.check_session_snapshots() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare occurrence public.sessions; occurrence_id uuid; tenant uuid; count_roster integer; count_primary integer;
begin
  tenant := new.academy_id;
  if tg_table_name = 'sessions' then occurrence_id := new.id;
  else occurrence_id := new.session_id; end if;
  select * into occurrence from public.sessions where academy_id = tenant and id = occurrence_id;
  if not found or occurrence.status = 'cancelled' then return null; end if;
  select count(*) into count_roster from public.session_roster where academy_id = tenant and session_id = occurrence_id and withdrawn_at is null;
  select count(*) into count_primary from public.session_coaches where academy_id = tenant and session_id = occurrence_id and is_primary and access_revoked_at is null;
  if count_roster = 0 or count_roster > occurrence.capacity_snapshot or count_primary <> 1 then
    raise exception 'Session requires a bounded roster and one primary coach' using errcode = '23514';
  end if;
  return null;
end $$;

create function private.guard_invitation() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.issued_at := clock_timestamp();
    new.expires_at := new.issued_at + interval '72 hours';
  elsif old.status <> 'pending' then
    raise exception 'Invitation is terminal' using errcode = '23514';
  end if;
  return new;
end $$;

create function private.guard_note() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.body is distinct from old.body then
    new.visibility := 'internal';
    new.published_at := null;
    new.published_by_membership_id := null;
  end if;
  if new.visibility = 'parent_visible' and (tg_op = 'INSERT' or old.visibility <> 'parent_visible') then
    if not private.has_role(new.academy_id,'admin') then
      raise exception 'Only an administrator can publish notes' using errcode = '42501';
    end if;
  end if;
  if not exists(select 1 from public.academy_memberships m
    where m.academy_id = new.academy_id and m.id = new.author_membership_id and m.role in ('admin','coach'))
  then raise exception 'Invalid note author' using errcode = '23514'; end if;
  return new;
end $$;

create function private.append_only() returns trigger
language plpgsql set search_path = ''
as $$ begin raise exception 'Append-only history' using errcode = '42501'; end $$;

-- Shared guards protect identities even when a mutation executes with owner privileges.
do $$
declare name text; immutable text[];
begin
  foreach name in array array['academies','profiles','academy_memberships','coaches','swimmers','groups',
    'group_coaches','group_swimmers','schedule_rules','sessions','session_coaches','session_roster',
    'attendance','academy_invitations','guardian_swimmers','swimmer_notes']
  loop
    immutable := case name
      when 'academy_memberships' then array['role']
      when 'group_coaches' then array['group_id','coach_id','valid_from']
      when 'group_swimmers' then array['group_id','swimmer_id','valid_from']
      when 'schedule_rules' then array['group_id','weekday','starts_local','ends_local','timezone','valid_from']
      when 'sessions' then array['group_id','schedule_rule_id','session_date','starts_at','ends_at','timezone','group_name_snapshot','level_snapshot','capacity_snapshot','roster_frozen_at']
      when 'session_coaches' then array['session_id','group_id','coach_id','group_coach_id','coach_name_snapshot','assignment_source']
      when 'session_roster' then array['session_id','group_id','swimmer_id','group_swimmer_id','swimmer_name_snapshot','level_snapshot','roster_source']
      when 'attendance' then array['session_id','swimmer_id','roster_id']
      when 'academy_invitations' then array['recipient_email_normalized','invited_role','swimmer_id','relationship','history_visible_from','relationship_verified_at','verified_by_membership_id','invited_by_membership_id','token_hash','issued_at','expires_at']
      when 'guardian_swimmers' then array['parent_membership_id','swimmer_id','relationship','verified_at','verified_by_membership_id','accepted_invitation_id']
      when 'swimmer_notes' then array['swimmer_id','author_membership_id','session_id']
      else array[]::text[] end;
    execute format('create trigger row_guard before insert or update on public.%I for each row execute function private.guard_row(%s)',
      name,(select coalesce(string_agg(quote_literal(v),','),'') from unnest(immutable) v));
    if name not in ('profiles','attendance') then
      execute format('create trigger prevent_delete before delete on public.%I for each row execute function private.append_only()',name);
    end if;
  end loop;
end $$;
create trigger membership_guard before update on public.academy_memberships for each row execute function private.guard_membership();
create trigger profile_delete_guard before delete on public.profiles for each row execute function private.guard_profile_delete();
create trigger coach_identity_guard before update on public.coaches for each row execute function private.guard_coach_identity();
create trigger allocation_check after insert or update on public.group_swimmers for each row execute function private.check_allocation();
create trigger group_capacity_check after update on public.groups for each row execute function private.check_group_capacity();
create trigger swimmer_level_check after update on public.swimmers for each row execute function private.check_swimmer_level();
create trigger coach_range_check after update on public.group_coaches for each row execute function private.check_coach_range();
create trigger roster_source_check before insert on public.session_roster for each row execute function private.check_snapshot();
create trigger coach_source_check before insert on public.session_coaches for each row execute function private.check_snapshot();
create trigger invitation_clock before insert or update on public.academy_invitations for each row execute function private.guard_invitation();
create trigger note_guard before insert or update on public.swimmer_notes for each row execute function private.guard_note();
create trigger history_immutable before update or delete on public.attendance_history for each row execute function private.append_only();
create trigger audit_immutable before update or delete on public.audit_logs for each row execute function private.append_only();
create constraint trigger session_complete after insert or update on public.sessions
  deferrable initially deferred for each row execute function private.check_session_snapshots();
create constraint trigger roster_complete after insert or update on public.session_roster
  deferrable initially deferred for each row execute function private.check_session_snapshots();
create constraint trigger coaches_complete after insert or update on public.session_coaches
  deferrable initially deferred for each row execute function private.check_session_snapshots();

-- Every FK gets an index on its referencing columns. Duplicate PK/unique prefixes are skipped.
do $$
declare fk record; columns_sql text;
begin
  for fk in select c.oid,c.conrelid,c.conkey,c.conname from pg_catalog.pg_constraint c
    join pg_catalog.pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'f'
  loop
    if not exists(select 1 from pg_catalog.pg_index i where i.indrelid = fk.conrelid
      and i.indisvalid and i.indpred is null and i.indnkeyatts >= cardinality(fk.conkey)
      and not exists(select 1 from unnest(fk.conkey) with ordinality u(attnum,position)
        where i.indkey[(u.position-1)::integer] <> u.attnum))
    then
      select string_agg(quote_ident(a.attname),',' order by u.ordinality) into columns_sql
        from unnest(fk.conkey) with ordinality u(attnum,ordinality)
        join pg_catalog.pg_attribute a on a.attrelid = fk.conrelid and a.attnum = u.attnum;
      execute format('create index %I on %s (%s)',
        'fk_' || fk.conrelid::regclass::text || '_' || left(md5(fk.conname),8),
        fk.conrelid::regclass,columns_sql);
    end if;
  end loop;
end $$;
create index memberships_actor_lookup on public.academy_memberships(profile_id,academy_id,status,role);
create index swimmer_directory on public.swimmers(academy_id,archived_at,level,status);
create index group_directory on public.groups(academy_id,archived_at,level);
create index session_calendar on public.sessions(academy_id,session_date,status);
create index swimmer_session_roster on public.session_roster(academy_id,swimmer_id,session_id);
create index attendance_summary on public.attendance(academy_id,session_id,status);
create index swimmer_attendance on public.attendance(academy_id,swimmer_id,session_id);
create index published_swimmer_notes on public.swimmer_notes(academy_id,swimmer_id,published_at)
  where deleted_at is null and visibility = 'parent_visible';
create index attendance_revisions on public.attendance_history(academy_id,session_id,swimmer_id,revision);
create index audit_timeline on public.audit_logs(academy_id,created_at desc);
create index invitation_expiry on public.academy_invitations(academy_id,status,expires_at);
