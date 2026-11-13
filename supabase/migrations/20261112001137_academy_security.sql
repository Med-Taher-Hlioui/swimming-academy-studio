-- Membership helpers deliberately live outside the exposed Data API schema.
create function private.current_user_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select u.id from auth.users u where u.id = auth.uid()
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
$$;

create function private.has_role(p_academy uuid,p_role text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.academy_memberships m
    join public.academies a on a.id = m.academy_id
    where m.academy_id = p_academy and m.profile_id = private.current_user_id()
      and m.role = p_role and m.status = 'active' and a.status = 'active')
$$;

create function private.actor_membership(p_academy uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.id from public.academy_memberships m join public.academies a on a.id = m.academy_id
  where m.academy_id = p_academy and m.profile_id = private.current_user_id()
    and m.status = 'active' and a.status = 'active'
  order by case m.role when 'admin' then 1 when 'coach' then 2 else 3 end limit 1
$$;

create function private.require_admin(p_academy uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.lock_academy(p_academy);
  if not private.has_role(p_academy,'admin') then
    raise exception 'Operation not permitted' using errcode = '42501';
  end if;
  return private.actor_membership(p_academy);
end $$;

create function private.own_coach(p_academy uuid,p_coach uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.coaches c join public.academy_memberships m
    on m.academy_id = c.academy_id and m.id = c.membership_id
    where c.academy_id = p_academy and c.id = p_coach and c.archived_at is null
      and m.profile_id = private.current_user_id() and m.status = 'active'
      and private.has_role(p_academy,'coach'))
$$;
create function private.coach_group(p_academy uuid,p_group uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.group_coaches gc
    where gc.academy_id = p_academy and gc.group_id = p_group and gc.cancelled_at is null
      and gc.valid_during @> private.academy_today(p_academy) and private.own_coach(p_academy,gc.coach_id))
$$;
create function private.coach_session(p_academy uuid,p_session uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.session_coaches sc
    where sc.academy_id = p_academy and sc.session_id = p_session and sc.access_revoked_at is null
      and private.own_coach(p_academy,sc.coach_id))
$$;
create function private.coach_swimmer(p_academy uuid,p_swimmer uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.group_swimmers gs
    where gs.academy_id = p_academy and gs.swimmer_id = p_swimmer and gs.cancelled_at is null
      and gs.valid_during @> private.academy_today(p_academy) and private.coach_group(p_academy,gs.group_id))
  or exists(select 1 from public.session_roster r join public.sessions s
    on s.academy_id = r.academy_id and s.id = r.session_id
    where r.academy_id = p_academy and r.swimmer_id = p_swimmer and r.withdrawn_at is null
      and s.status in ('scheduled','open') and s.session_date >= private.academy_today(p_academy)
      and private.coach_session(p_academy,r.session_id))
$$;
create function private.parent_history_from(p_academy uuid,p_swimmer uuid) returns date
language sql stable security definer set search_path = ''
as $$
  select min(g.history_visible_from) from public.guardian_swimmers g
    join public.academy_memberships m on m.academy_id = g.academy_id and m.id = g.parent_membership_id
  where g.academy_id = p_academy and g.swimmer_id = p_swimmer and g.revoked_at is null
    and m.profile_id = private.current_user_id() and m.status = 'active'
    and private.has_role(p_academy,'parent')
$$;
create function private.parent_session(p_academy uuid,p_session uuid,p_swimmer uuid default null) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.session_roster r join public.sessions s
    on s.academy_id = r.academy_id and s.id = r.session_id
    where r.academy_id = p_academy and r.session_id = p_session
      and (p_swimmer is null or r.swimmer_id = p_swimmer) and s.status <> 'cancelled'
      and s.session_date >= private.parent_history_from(p_academy,r.swimmer_id))
$$;
create function private.can_read_session(p_academy uuid,p_session uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select private.has_role(p_academy,'admin') or private.coach_session(p_academy,p_session)
  or private.parent_session(p_academy,p_session) $$;
create function private.can_read_group(p_academy uuid,p_group uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_role(p_academy,'admin') or private.coach_group(p_academy,p_group)
    or exists(select 1 from public.sessions s where s.academy_id = p_academy and s.group_id = p_group
      and (private.coach_session(p_academy,s.id) or private.parent_session(p_academy,s.id)))
    or exists(select 1 from public.group_swimmers gs where gs.academy_id = p_academy and gs.group_id = p_group
      and gs.cancelled_at is null and gs.valid_during @> private.academy_today(p_academy)
      and private.parent_history_from(p_academy,gs.swimmer_id) is not null)
$$;
create function private.can_read_coach(p_academy uuid,p_coach uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_role(p_academy,'admin') or private.own_coach(p_academy,p_coach)
    or exists(select 1 from public.session_coaches sc where sc.academy_id = p_academy and sc.coach_id = p_coach
      and (private.coach_session(p_academy,sc.session_id) or private.parent_session(p_academy,sc.session_id)))
$$;

create policy academy_read on public.academies for select to authenticated
using (private.actor_membership(id) is not null);
create policy profile_read on public.profiles for select to authenticated using (id = private.current_user_id());
create policy profile_update on public.profiles for update to authenticated
using (id = private.current_user_id()) with check (id = private.current_user_id());
create policy membership_read on public.academy_memberships for select to authenticated
using (private.has_role(academy_id,'admin') or (profile_id = private.current_user_id() and private.actor_membership(academy_id) is not null));
create policy coach_read on public.coaches for select to authenticated using (private.can_read_coach(academy_id,id));
create policy swimmer_read on public.swimmers for select to authenticated
using (private.has_role(academy_id,'admin') or private.coach_swimmer(academy_id,id) or private.parent_history_from(academy_id,id) is not null);
create policy guardian_read on public.guardian_swimmers for select to authenticated
using (private.has_role(academy_id,'admin') or (revoked_at is null and exists(
  select 1 from public.academy_memberships m where m.academy_id = guardian_swimmers.academy_id
    and m.id = guardian_swimmers.parent_membership_id and m.profile_id = private.current_user_id() and m.status = 'active')));
create policy group_read on public.groups for select to authenticated using (private.can_read_group(academy_id,id));
create policy group_coach_read on public.group_coaches for select to authenticated
using (private.has_role(academy_id,'admin') or private.own_coach(academy_id,coach_id)
  or exists(select 1 from public.session_coaches sc where sc.academy_id = group_coaches.academy_id
    and sc.group_coach_id = group_coaches.id and private.coach_session(sc.academy_id,sc.session_id)));
create policy group_swimmer_read on public.group_swimmers for select to authenticated
using (private.has_role(academy_id,'admin')
  or (cancelled_at is null and valid_during @> private.academy_today(academy_id) and private.coach_group(academy_id,group_id))
  or exists(select 1 from public.session_roster r where r.academy_id = group_swimmers.academy_id
    and r.group_swimmer_id = group_swimmers.id and private.coach_session(r.academy_id,r.session_id))
  or (private.parent_history_from(academy_id,swimmer_id) is not null
    and (valid_until is null or valid_until > private.parent_history_from(academy_id,swimmer_id))));
create policy schedule_read on public.schedule_rules for select to authenticated
using (private.has_role(academy_id,'admin') or private.coach_group(academy_id,group_id)
  or (cancelled_at is null and valid_during @> private.academy_today(academy_id)
    and exists(select 1 from public.group_swimmers gs where gs.academy_id = schedule_rules.academy_id
      and gs.group_id = schedule_rules.group_id and gs.cancelled_at is null
      and gs.valid_during @> private.academy_today(gs.academy_id)
      and private.parent_history_from(gs.academy_id,gs.swimmer_id) is not null)));
create policy session_read on public.sessions for select to authenticated using (private.can_read_session(academy_id,id));
create policy session_coach_read on public.session_coaches for select to authenticated using (private.can_read_session(academy_id,session_id));
create policy roster_read on public.session_roster for select to authenticated
using (private.has_role(academy_id,'admin') or private.coach_session(academy_id,session_id)
  or private.parent_session(academy_id,session_id,swimmer_id));
create policy attendance_read on public.attendance for select to authenticated
using (private.has_role(academy_id,'admin') or private.coach_session(academy_id,session_id)
  or private.parent_session(academy_id,session_id,swimmer_id));
create policy note_read on public.swimmer_notes for select to authenticated
using (private.has_role(academy_id,'admin')
  or (deleted_at is null and private.coach_swimmer(academy_id,swimmer_id))
  or (deleted_at is null and visibility = 'parent_visible'
    and (published_at at time zone (select a.timezone from public.academies a where a.id = academy_id))::date >= private.parent_history_from(academy_id,swimmer_id)
    and (session_id is null or private.parent_session(academy_id,session_id,swimmer_id))));
create policy history_read on public.attendance_history for select to authenticated
using (private.has_role(academy_id,'admin') or private.coach_session(academy_id,session_id));
create policy audit_read on public.audit_logs for select to authenticated using (private.has_role(academy_id,'admin'));
-- Explicit default denial on the sensitive invitation table, including for Admin clients.
create policy invitation_no_direct_access on public.academy_invitations for all to authenticated using (false) with check (false);

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_user_id(), private.has_role(uuid,text),
  private.actor_membership(uuid), private.academy_today(uuid), private.own_coach(uuid,uuid),
  private.coach_group(uuid,uuid), private.coach_session(uuid,uuid), private.coach_swimmer(uuid,uuid),
  private.parent_history_from(uuid,uuid), private.parent_session(uuid,uuid,uuid),
  private.can_read_session(uuid,uuid), private.can_read_group(uuid,uuid), private.can_read_coach(uuid,uuid)
to authenticated;

grant select on public.academies, public.profiles, public.academy_memberships, public.coaches,
  public.swimmers, public.guardian_swimmers, public.groups, public.group_coaches, public.group_swimmers,
  public.schedule_rules, public.sessions, public.session_coaches, public.session_roster, public.attendance,
  public.swimmer_notes, public.attendance_history, public.audit_logs to authenticated;
grant update(display_name) on public.profiles to authenticated;
