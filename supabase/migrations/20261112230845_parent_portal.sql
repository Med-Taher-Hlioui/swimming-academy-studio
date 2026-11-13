begin;

-- This surface accepts only Parent invitations. The existing operation owns the
-- verified recipient, issuing Admin, lock, single-use and guardian-link checks.
create function private.accept_parent_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare tenant uuid;
begin
  if private.current_user_id() is null or p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;
  select i.academy_id into tenant from public.academy_invitations i
    where i.token_hash = extensions.digest(p_token,'sha256') and i.invited_role = 'parent';
  if tenant is null then raise exception 'Invitation unavailable' using errcode = '42501'; end if;
  perform private.lock_academy(tenant);
  if not exists(select 1 from public.academy_invitations i
    where i.academy_id=tenant and i.token_hash=extensions.digest(p_token,'sha256') and i.invited_role='parent')
  then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  perform public.academy_accept_invitation(p_token);
  return tenant;
end $$;

create function public.academy_accept_parent_invitation(p_token text) returns uuid
language sql security invoker set search_path = '' as $$
  select private.accept_parent_invitation(p_token)
$$;
revoke all on function private.accept_parent_invitation(text), public.academy_accept_parent_invitation(text)
  from public, anon, authenticated, service_role;
grant execute on function private.accept_parent_invitation(text), public.academy_accept_parent_invitation(text) to authenticated;

-- Keep direct Data API note reads inside the same historical window.
alter policy note_read on public.swimmer_notes using (
  private.has_role(academy_id,'admin')
  or (deleted_at is null and private.coach_swimmer(academy_id,swimmer_id))
  or (deleted_at is null and visibility='parent_visible'
    and (published_at at time zone (select a.timezone from public.academies a where a.id=academy_id))::date >= private.parent_history_from(academy_id,swimmer_id)
    and (created_at at time zone (select a.timezone from public.academies a where a.id=academy_id))::date >= private.parent_history_from(academy_id,swimmer_id)
    and (session_id is null or private.parent_session(academy_id,session_id,swimmer_id)))
);

-- Explicit child and time checks are required even for an account that separately
-- holds another role. Invoker mode preserves all baseline RLS checks as well.
create function public.academy_parent_activity(p_academy uuid, p_swimmer uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with scope as (
    select private.parent_history_from(p_academy,p_swimmer) as cutoff,
      private.academy_today(p_academy) as today, a.timezone
    from public.academies a where a.id=p_academy
      and private.parent_history_from(p_academy,p_swimmer) is not null
  )
  select jsonb_build_object(
    'today', x.today,
    'timezone', x.timezone,
    'groups', coalesce((select jsonb_agg(to_jsonb(v)) from (
      select g.name,g.schedule_label from public.group_swimmers gs
      join public.groups g on g.academy_id=gs.academy_id and g.id=gs.group_id
      where gs.academy_id=p_academy and gs.swimmer_id=p_swimmer and gs.cancelled_at is null
        and gs.valid_during @> x.today and g.archived_at is null
      order by g.name,g.id limit 10
    ) v), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(to_jsonb(v)) from (
      select s.id,s.session_date,s.starts_at,s.ends_at,s.group_name_snapshot,s.status
      from public.session_roster r join public.sessions s on s.academy_id=r.academy_id and s.id=r.session_id
      where r.academy_id=p_academy and r.swimmer_id=p_swimmer and r.withdrawn_at is null
        and s.status in ('scheduled','open') and s.session_date>=greatest(x.today,x.cutoff)
      order by s.session_date,s.starts_at,s.id limit 20
    ) v), '[]'::jsonb),
    'attendance', coalesce((select jsonb_agg(to_jsonb(v)) from (
      select s.id,s.session_date,s.group_name_snapshot,t.status
      from public.attendance t join public.sessions s on s.academy_id=t.academy_id and s.id=t.session_id
      where t.academy_id=p_academy and t.swimmer_id=p_swimmer and s.status<>'cancelled'
        and s.session_date between x.cutoff and x.today
      order by s.session_date desc,s.id limit 50
    ) v), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(to_jsonb(v)) from (
      select n.id,n.body,n.published_at from public.swimmer_notes n
      where n.academy_id=p_academy and n.swimmer_id=p_swimmer and n.deleted_at is null
        and n.visibility='parent_visible' and (n.published_at at time zone x.timezone)::date>=x.cutoff
        and (n.created_at at time zone x.timezone)::date>=x.cutoff
        and (n.session_id is null or private.parent_session(p_academy,n.session_id,p_swimmer))
      order by n.published_at desc,n.id limit 50
    ) v), '[]'::jsonb)
  ) from scope x
$$;
revoke all on function public.academy_parent_activity(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.academy_parent_activity(uuid,uuid) to authenticated;

commit;
