-- Local PostgreSQL 17 foundation. Applying this file remotely requires separate approval.
create schema if not exists private;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

create function private.valid_timezone(value text) returns boolean
language sql stable set search_path = ''
as $$ select exists(select 1 from pg_catalog.pg_timezone_names where name = value) $$;

create table public.academies (
  id uuid primary key default gen_random_uuid(),
  slug varchar(80) not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name varchar(160) not null check (length(btrim(name)) > 0),
  timezone text not null default 'Africa/Tunis' check (private.valid_timezone(timezone)),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0)
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(160) not null check (length(btrim(display_name)) > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0)
);
create table public.academy_memberships (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  profile_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('admin','coach','parent')),
  status text not null default 'active' check (status in ('active','revoked')),
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id), unique (academy_id,id,role),
  unique (academy_id,profile_id,role),
  check ((status = 'active' and profile_id is not null and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null))
);
create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  display_name varchar(160) not null check (length(btrim(display_name)) > 0),
  membership_id uuid,
  membership_role text not null default 'coach' check (membership_role = 'coach'),
  archived_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id), unique (academy_id,membership_id),
  foreign key (academy_id,membership_id,membership_role)
    references public.academy_memberships(academy_id,id,role)
);
create table public.swimmers (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  display_name varchar(160) not null check (length(btrim(display_name)) > 0),
  level text not null check (level in ('beginner','developing','advanced')),
  status text not null default 'active' check (status in ('active','trial')),
  archived_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id)
);
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  name varchar(60) not null check (length(btrim(name)) > 0),
  level text not null check (level in ('beginner','developing','advanced')),
  schedule_label varchar(100),
  capacity smallint not null check (capacity between 1 and 50),
  archived_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id)
);
create unique index groups_name_unique on public.groups(academy_id, lower(btrim(name)));
create table public.group_coaches (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  group_id uuid not null,
  coach_id uuid not null,
  valid_from date not null,
  valid_until date,
  valid_during daterange generated always as (daterange(valid_from,valid_until,'[)')) stored,
  is_primary boolean not null default false,
  cancelled_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id), unique (academy_id,id,group_id,coach_id),
  foreign key (academy_id,group_id) references public.groups(academy_id,id),
  foreign key (academy_id,coach_id) references public.coaches(academy_id,id),
  check (valid_until is null or valid_until > valid_from),
  exclude using gist (academy_id with =, group_id with =, coach_id with =, valid_during with &&)
    where (cancelled_at is null),
  exclude using gist (academy_id with =, group_id with =, valid_during with &&)
    where (cancelled_at is null and is_primary)
);
create table public.group_swimmers (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  group_id uuid not null,
  swimmer_id uuid not null,
  valid_from date not null,
  valid_until date,
  valid_during daterange generated always as (daterange(valid_from,valid_until,'[)')) stored,
  cancelled_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id), unique (academy_id,id,group_id,swimmer_id),
  foreign key (academy_id,group_id) references public.groups(academy_id,id),
  foreign key (academy_id,swimmer_id) references public.swimmers(academy_id,id),
  check (valid_until is null or valid_until > valid_from),
  exclude using gist (academy_id with =, swimmer_id with =, valid_during with &&)
    where (cancelled_at is null)
);
create table public.schedule_rules (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  group_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  starts_local time not null,
  ends_local time not null check (ends_local > starts_local),
  timezone text not null check (private.valid_timezone(timezone)),
  valid_from date not null,
  valid_until date,
  valid_during daterange generated always as (daterange(valid_from,valid_until,'[)')) stored,
  cancelled_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id), unique (academy_id,id,group_id),
  foreign key (academy_id,group_id) references public.groups(academy_id,id),
  check (valid_until is null or valid_until > valid_from),
  exclude using gist (academy_id with =, group_id with =, weekday with =, valid_during with &&)
    where (cancelled_at is null)
);
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  group_id uuid not null,
  schedule_rule_id uuid,
  session_date date not null,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null check (private.valid_timezone(timezone)),
  group_name_snapshot varchar(60) not null,
  level_snapshot text not null check (level_snapshot in ('beginner','developing','advanced')),
  capacity_snapshot smallint not null check (capacity_snapshot between 1 and 50),
  status text not null default 'scheduled' check (status in ('scheduled','open','closed','cancelled')),
  roster_frozen_at timestamptz not null default clock_timestamp(),
  opened_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id), unique (academy_id,id,group_id),
  unique (academy_id,group_id,session_date),
  foreign key (academy_id,group_id) references public.groups(academy_id,id),
  foreign key (academy_id,schedule_rule_id,group_id) references public.schedule_rules(academy_id,id,group_id),
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and ends_at > starts_at)),
  check (starts_at is null or (starts_at at time zone timezone)::date = session_date),
  check ((status = 'scheduled' and opened_at is null and closed_at is null and cancelled_at is null)
      or (status = 'open' and opened_at is not null and closed_at is null and cancelled_at is null)
      or (status = 'closed' and opened_at is not null and closed_at is not null and cancelled_at is null)
      or (status = 'cancelled' and cancelled_at is not null))
);
create table public.session_coaches (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  session_id uuid not null,
  group_id uuid not null,
  coach_id uuid not null,
  group_coach_id uuid,
  coach_name_snapshot varchar(160) not null,
  is_primary boolean not null default false,
  assignment_source text not null check (assignment_source in ('group','substitute')),
  substitution_reason varchar(500),
  access_revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id), unique (academy_id,session_id,coach_id),
  foreign key (academy_id,session_id,group_id) references public.sessions(academy_id,id,group_id),
  foreign key (academy_id,coach_id) references public.coaches(academy_id,id),
  foreign key (academy_id,group_coach_id,group_id,coach_id) references public.group_coaches(academy_id,id,group_id,coach_id),
  check ((assignment_source = 'group' and group_coach_id is not null)
      or (assignment_source = 'substitute' and group_coach_id is null and substitution_reason is not null and length(btrim(substitution_reason)) > 0))
);
create unique index session_primary_coach on public.session_coaches(academy_id,session_id)
  where is_primary and access_revoked_at is null;
create table public.session_roster (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  session_id uuid not null,
  group_id uuid not null,
  swimmer_id uuid not null,
  group_swimmer_id uuid,
  swimmer_name_snapshot varchar(160) not null,
  level_snapshot text not null check (level_snapshot in ('beginner','developing','advanced')),
  roster_source text not null check (roster_source in ('group','manual','import')),
  added_reason varchar(500),
  attendance_version bigint not null default 0 check (attendance_version >= 0),
  withdrawn_at timestamptz,
  withdrawal_reason varchar(500),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id), unique (academy_id,session_id,swimmer_id),
  unique (academy_id,id,session_id,swimmer_id),
  foreign key (academy_id,session_id,group_id) references public.sessions(academy_id,id,group_id),
  foreign key (academy_id,swimmer_id) references public.swimmers(academy_id,id),
  foreign key (academy_id,group_swimmer_id,group_id,swimmer_id) references public.group_swimmers(academy_id,id,group_id,swimmer_id),
  check ((roster_source = 'group' and group_swimmer_id is not null)
      or (roster_source in ('manual','import') and group_swimmer_id is null and added_reason is not null and length(btrim(added_reason)) > 0)),
  check ((withdrawn_at is null and withdrawal_reason is null)
      or (withdrawn_at is not null and withdrawal_reason is not null and length(btrim(withdrawal_reason)) > 0))
);
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  session_id uuid not null,
  swimmer_id uuid not null,
  roster_id uuid not null,
  status text not null check (status in ('present','absent','excused')),
  marked_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id), unique (academy_id,session_id,swimmer_id),
  unique (academy_id,roster_id),
  foreign key (academy_id,roster_id,session_id,swimmer_id) references public.session_roster(academy_id,id,session_id,swimmer_id)
);
create table public.academy_invitations (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  recipient_email_normalized text not null check (recipient_email_normalized = lower(btrim(recipient_email_normalized)) and length(recipient_email_normalized) between 3 and 254),
  invited_role text not null check (invited_role in ('admin','coach','parent')),
  swimmer_id uuid,
  relationship text check (relationship in ('parent','legal_guardian')),
  history_visible_from date,
  relationship_verified_at timestamptz,
  verified_by_membership_id uuid,
  invited_by_membership_id uuid not null,
  admin_role text generated always as ('admin'::text) stored,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  accepted_by_membership_id uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id), unique (academy_id,id,swimmer_id,accepted_by_membership_id),
  foreign key (academy_id,swimmer_id) references public.swimmers(academy_id,id),
  foreign key (academy_id,verified_by_membership_id,admin_role) references public.academy_memberships(academy_id,id,role),
  foreign key (academy_id,invited_by_membership_id,admin_role) references public.academy_memberships(academy_id,id,role),
  foreign key (academy_id,accepted_by_membership_id,invited_role) references public.academy_memberships(academy_id,id,role),
  check (expires_at = issued_at + interval '72 hours'),
  check ((invited_role = 'parent' and swimmer_id is not null and relationship is not null
          and history_visible_from is not null and relationship_verified_at is not null and verified_by_membership_id is not null)
      or (invited_role <> 'parent' and swimmer_id is null and relationship is null
          and history_visible_from is null and relationship_verified_at is null and verified_by_membership_id is null)),
  check ((status = 'accepted' and accepted_at is not null and accepted_by_membership_id is not null)
      or (status <> 'accepted' and accepted_at is null and accepted_by_membership_id is null)),
  check ((status = 'revoked') = (revoked_at is not null))
);
create unique index pending_staff_invitation on public.academy_invitations(academy_id,recipient_email_normalized,invited_role)
  where status = 'pending' and invited_role <> 'parent';
create unique index pending_parent_invitation on public.academy_invitations(academy_id,recipient_email_normalized,swimmer_id)
  where status = 'pending' and invited_role = 'parent';
create table public.guardian_swimmers (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  parent_membership_id uuid not null,
  membership_role text not null default 'parent' check (membership_role = 'parent'),
  swimmer_id uuid not null,
  relationship text not null check (relationship in ('parent','legal_guardian')),
  verified_at timestamptz not null,
  verified_by_membership_id uuid not null,
  admin_role text generated always as ('admin'::text) stored,
  accepted_invitation_id uuid,
  history_visible_from date not null,
  revoked_at timestamptz,
  revoked_by_membership_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id), unique (academy_id,accepted_invitation_id),
  foreign key (academy_id,parent_membership_id,membership_role) references public.academy_memberships(academy_id,id,role),
  foreign key (academy_id,swimmer_id) references public.swimmers(academy_id,id),
  foreign key (academy_id,verified_by_membership_id,admin_role) references public.academy_memberships(academy_id,id,role),
  foreign key (academy_id,revoked_by_membership_id,admin_role) references public.academy_memberships(academy_id,id,role),
  foreign key (academy_id,accepted_invitation_id,swimmer_id,parent_membership_id)
    references public.academy_invitations(academy_id,id,swimmer_id,accepted_by_membership_id),
  check ((revoked_at is null) = (revoked_by_membership_id is null))
);
create unique index current_guardian_link on public.guardian_swimmers(academy_id,parent_membership_id,swimmer_id) where revoked_at is null;
create table public.swimmer_notes (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  swimmer_id uuid not null,
  author_membership_id uuid not null,
  session_id uuid,
  body text not null check (length(btrim(body)) between 1 and 4000),
  visibility text not null default 'internal' check (visibility in ('internal','parent_visible')),
  published_at timestamptz,
  published_by_membership_id uuid,
  admin_role text generated always as ('admin'::text) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (academy_id,id),
  foreign key (academy_id,swimmer_id) references public.swimmers(academy_id,id),
  foreign key (academy_id,author_membership_id) references public.academy_memberships(academy_id,id),
  foreign key (academy_id,published_by_membership_id,admin_role) references public.academy_memberships(academy_id,id,role),
  foreign key (academy_id,session_id,swimmer_id) references public.session_roster(academy_id,session_id,swimmer_id),
  check ((visibility = 'internal' and published_at is null and published_by_membership_id is null)
      or (visibility = 'parent_visible' and published_at is not null and published_by_membership_id is not null))
);
create table public.attendance_history (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  session_id uuid not null,
  swimmer_id uuid not null,
  roster_id uuid not null,
  revision bigint not null check (revision > 0),
  previous_status text check (previous_status in ('present','absent','excused')),
  new_status text check (new_status in ('present','absent','excused')),
  actor_membership_id uuid not null,
  request_id uuid not null,
  request_fingerprint bytea not null check (octet_length(request_fingerprint) = 32),
  reason varchar(500),
  created_at timestamptz not null default clock_timestamp(),
  unique (academy_id,id), unique (academy_id,roster_id,revision), unique (academy_id,request_id),
  foreign key (academy_id,roster_id,session_id,swimmer_id) references public.session_roster(academy_id,id,session_id,swimmer_id),
  foreign key (academy_id,actor_membership_id) references public.academy_memberships(academy_id,id),
  check (previous_status is distinct from new_status)
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  actor_membership_id uuid,
  action text not null check (length(action) between 1 and 80),
  request_id uuid not null default gen_random_uuid(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 2000),
  target_membership_id uuid, target_invitation_id uuid, target_coach_id uuid,
  target_swimmer_id uuid, target_guardian_swimmer_id uuid, target_group_id uuid,
  target_group_coach_id uuid, target_group_swimmer_id uuid, target_schedule_rule_id uuid,
  target_session_id uuid, target_session_coach_id uuid, target_roster_id uuid, target_note_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  unique (academy_id,id),
  foreign key (academy_id,actor_membership_id) references public.academy_memberships(academy_id,id),
  foreign key (academy_id,target_membership_id) references public.academy_memberships(academy_id,id),
  foreign key (academy_id,target_invitation_id) references public.academy_invitations(academy_id,id),
  foreign key (academy_id,target_coach_id) references public.coaches(academy_id,id),
  foreign key (academy_id,target_swimmer_id) references public.swimmers(academy_id,id),
  foreign key (academy_id,target_guardian_swimmer_id) references public.guardian_swimmers(academy_id,id),
  foreign key (academy_id,target_group_id) references public.groups(academy_id,id),
  foreign key (academy_id,target_group_coach_id) references public.group_coaches(academy_id,id),
  foreign key (academy_id,target_group_swimmer_id) references public.group_swimmers(academy_id,id),
  foreign key (academy_id,target_schedule_rule_id) references public.schedule_rules(academy_id,id),
  foreign key (academy_id,target_session_id) references public.sessions(academy_id,id),
  foreign key (academy_id,target_session_coach_id) references public.session_coaches(academy_id,id),
  foreign key (academy_id,target_roster_id) references public.session_roster(academy_id,id),
  foreign key (academy_id,target_note_id) references public.swimmer_notes(academy_id,id)
);
create unique index attendance_request_receipt on public.audit_logs(academy_id,request_id) where action = 'attendance_request';

-- RLS is on before subsequent migrations establish any client grants.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'academies','profiles','academy_memberships','academy_invitations','coaches','swimmers',
    'guardian_swimmers','groups','group_coaches','group_swimmers','schedule_rules','sessions',
    'session_coaches','session_roster','attendance','swimmer_notes','attendance_history','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from public, anon, authenticated',table_name);
  end loop;
end $$;
