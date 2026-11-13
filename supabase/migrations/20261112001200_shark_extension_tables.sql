begin;

-- Internal tables are outside the Data API schema. RLS also protects SQL reads.
create table private.guardian_contacts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  archived_at timestamptz,
  row_version bigint not null default 1,
  unique (academy_id,id)
);

create table private.swimmer_guardian_contacts (
  academy_id uuid not null,
  swimmer_id uuid not null,
  contact_id uuid not null,
  primary key (academy_id,swimmer_id,contact_id),
  foreign key (academy_id,swimmer_id) references public.swimmers(academy_id,id),
  foreign key (academy_id,contact_id) references private.guardian_contacts(academy_id,id)
);
create index swimmer_guardian_contact_reverse on private.swimmer_guardian_contacts(academy_id,contact_id);

create table private.swimmer_private_details (
  academy_id uuid not null,
  swimmer_id uuid not null,
  birth_date date check (isfinite(birth_date)),
  row_version bigint not null default 1,
  primary key (academy_id,swimmer_id),
  foreign key (academy_id,swimmer_id) references public.swimmers(academy_id,id)
);

create table private.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  code text not null check (code ~ '^[A-Z0-9_-]{1,32}$'),
  label text not null check (length(btrim(label)) between 1 and 120),
  monthly_price_tnd numeric(12,3) not null check (monthly_price_tnd >= 0 and monthly_price_tnd <> 'NaN'::numeric),
  active boolean not null default true,
  row_version bigint not null default 1,
  unique (academy_id,id),
  unique (academy_id,code)
);

create table private.swimmer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  swimmer_id uuid not null,
  plan_id uuid not null,
  monthly_price_tnd numeric(12,3) not null check (monthly_price_tnd >= 0 and monthly_price_tnd <> 'NaN'::numeric),
  starts_on date check (isfinite(starts_on)),
  ends_before date check (isfinite(ends_before)),
  lifecycle text not null default 'review' check (lifecycle in ('review','confirmed','ended')),
  parent_visible boolean not null default false,
  row_version bigint not null default 1,
  unique (academy_id,id),
  foreign key (academy_id,swimmer_id) references public.swimmers(academy_id,id),
  foreign key (academy_id,plan_id) references private.subscription_plans(academy_id,id),
  check (starts_on < ends_before),
  check (lifecycle <> 'ended' or ends_before is not null),
  check (not parent_visible or lifecycle <> 'review')
);
create index swimmer_subscription_swimmer on private.swimmer_subscriptions(academy_id,swimmer_id);
create index swimmer_subscription_plan on private.swimmer_subscriptions(academy_id,plan_id);

create table private.import_batches (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  actor_membership_id uuid not null,
  source_digest text not null check (source_digest ~ '^[0-9a-f]{64}$'),
  mapping_version text not null check (mapping_version ~ '^[0-9]+([.][0-9]+){0,3}$'),
  billing_year integer check (billing_year between 1 and 9999),
  preview_digest text not null check (preview_digest ~ '^[0-9a-f]{64}$'),
  selection_digest text check (selection_digest ~ '^[0-9a-f]{64}$'),
  state text not null default 'review' check (state in ('review','approved')),
  includes_months boolean,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  row_version bigint not null default 1,
  unique (academy_id,id),
  unique (academy_id,source_digest,mapping_version,preview_digest),
  foreign key (academy_id,actor_membership_id) references public.academy_memberships(academy_id,id),
  foreign key (academy_id,approved_by) references public.academy_memberships(academy_id,id),
  check ((state = 'approved' and num_nonnulls(selection_digest,includes_months,approved_by,approved_at) = 4
        and (not includes_months or billing_year is not null))
      or (state = 'review' and num_nonnulls(selection_digest,includes_months,approved_by,approved_at) = 0))
);

create table private.subscription_monthly_statuses (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  subscription_id uuid not null,
  billing_year integer not null check (billing_year between 1 and 9999),
  billing_month integer not null check (billing_month between 1 and 12),
  source_batch_id uuid,
  source_code text check (upper(btrim(source_code)) in ('P','A','NP','-')),
  normalized_status text check (normalized_status in ('paid','pending','unpaid','unknown')),
  parent_visible boolean not null default false,
  row_version bigint not null default 1,
  unique (academy_id,id),
  unique (academy_id,subscription_id,billing_year,billing_month),
  foreign key (academy_id,subscription_id) references private.swimmer_subscriptions(academy_id,id),
  foreign key (academy_id,source_batch_id) references private.import_batches(academy_id,id),
  check (source_batch_id is not null or source_code is null)
);

create table private.registration_document_statuses (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  swimmer_id uuid not null,
  document_type text not null check (document_type ~ '^[a-z][a-z0-9_]{0,39}$'),
  source_batch_id uuid,
  source_code text check (upper(btrim(source_code)) = 'X'),
  status text not null check (status in ('received','unknown','missing','rejected')),
  parent_visible boolean not null default false,
  row_version bigint not null default 1,
  unique (academy_id,id),
  unique (academy_id,swimmer_id,document_type),
  foreign key (academy_id,swimmer_id) references public.swimmers(academy_id,id),
  foreign key (academy_id,source_batch_id) references private.import_batches(academy_id,id),
  check (source_batch_id is not null or source_code is null)
);

create table private.import_source_links (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  batch_id uuid not null,
  source_entity_id uuid not null,
  row_fingerprint text not null check (row_fingerprint ~ '^[0-9a-f]{64}$'),
  swimmer_id uuid,
  contact_id uuid,
  subscription_id uuid,
  unique (academy_id,source_entity_id),
  foreign key (academy_id,batch_id) references private.import_batches(academy_id,id),
  foreign key (academy_id,swimmer_id) references public.swimmers(academy_id,id),
  foreign key (academy_id,contact_id) references private.guardian_contacts(academy_id,id),
  foreign key (academy_id,subscription_id) references private.swimmer_subscriptions(academy_id,id),
  check (num_nonnulls(swimmer_id,contact_id,subscription_id) = 1)
);

create table private.import_review_items (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  batch_id uuid not null,
  source_row_key uuid not null,
  reason_code text not null check (reason_code in ('ambiguous_identity','duplicate_candidate','missing_required','invalid_value','billing_year_required','subscription_conflict')),
  resolution text not null default 'open' check (resolution in ('open','resolved','excluded')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  row_version bigint not null default 1,
  unique (academy_id,batch_id,source_row_key,reason_code),
  foreign key (academy_id,batch_id) references private.import_batches(academy_id,id),
  foreign key (academy_id,reviewed_by) references public.academy_memberships(academy_id,id),
  check ((resolution = 'open' and num_nonnulls(reviewed_by,reviewed_at) = 0)
      or (resolution <> 'open' and num_nonnulls(reviewed_by,reviewed_at) = 2))
);

-- Preserve the original audit contract and keep extension events in an append-only companion table.
create table private.academy_extension_audit (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  actor_membership_id uuid not null,
  entity text not null check (entity in ('guardian_contacts','swimmer_guardian_contacts','swimmer_private_details','subscription_plans','swimmer_subscriptions','subscription_monthly_statuses','registration_document_statuses','import_batches','import_source_links','import_review_items')),
  target_id uuid not null,
  related_id uuid,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  previous_status text,
  previous_visibility boolean,
  new_visibility boolean,
  new_status text,
  row_version bigint,
  reason_code text,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (academy_id,actor_membership_id) references public.academy_memberships(academy_id,id)
);
create index academy_extension_audit_timeline on private.academy_extension_audit(academy_id,created_at desc);
create trigger extension_audit_immutable before update or delete on private.academy_extension_audit
for each row execute function private.append_only();

do $$
declare name text;
begin
  foreach name in array array['guardian_contacts','swimmer_guardian_contacts','swimmer_private_details','subscription_plans',
    'swimmer_subscriptions','subscription_monthly_statuses','registration_document_statuses','import_batches',
    'import_source_links','import_review_items','academy_extension_audit']
  loop
    execute format('alter table private.%I enable row level security',name);
    execute format('revoke all on private.%I from public, anon, authenticated, service_role',name);
    execute format('grant select on private.%I to authenticated',name);
    execute format('create policy extension_admin_read on private.%I for select to authenticated using (private.has_role(academy_id,''admin''))',name);
  end loop;
end $$;

commit;
