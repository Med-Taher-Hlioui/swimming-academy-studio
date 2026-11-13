begin;

alter table private.subscription_monthly_statuses add column correction_reason text
  check (correction_reason in ('source_review','admin_correction'));

create function private.shark_monthly_code(p_source text) returns text
language sql immutable set search_path = '' as $$
  select case upper(btrim(p_source)) when 'P' then 'paid' when 'A' then 'pending'
    when 'NP' then 'unpaid' when '-' then 'unknown' end
$$;

create function private.shark_document_code(p_source text) returns text
language sql immutable set search_path = '' as $$
  select case when p_source is null then 'unknown' when upper(btrim(p_source))='X' then 'received' end
$$;

create function private.shark_formule_price(p_source text) returns numeric
language sql immutable set search_path = '' as $$
  select case btrim(p_source) when '60' then 60 when '70' then 70 when '80' then 80 when '90' then 90 end
$$;

create function private.subscription_covers_month(p_starts date,p_ends date,p_year integer,p_month integer) returns boolean
language sql immutable set search_path = '' as $$
  select (p_starts is null or p_starts < (make_date(p_year,p_month,1) + interval '1 month')::date)
    and (p_ends is null or p_ends > make_date(p_year,p_month,1))
$$;

-- The Admin transaction lock serializes checks and writes within each academy.
create function private.guard_shark_subscription() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' and (new.plan_id,new.swimmer_id,new.monthly_price_tnd)
    is distinct from (old.plan_id,old.swimmer_id,old.monthly_price_tnd)
  then raise exception 'Subscription price and identity are immutable' using errcode='23514'; end if;
  if new.lifecycle <> 'review' and exists(
    select 1 from private.swimmer_subscriptions s where s.academy_id=new.academy_id
      and s.swimmer_id=new.swimmer_id and s.id<>new.id and s.lifecycle<>'review'
      and daterange(s.starts_on,s.ends_before,'[)') && daterange(new.starts_on,new.ends_before,'[)')
  ) then raise exception 'Conflicting confirmed subscription term' using errcode='23P01'; end if;
  return new;
end $$;
create trigger guard_shark_subscription before insert or update on private.swimmer_subscriptions
for each row execute function private.guard_shark_subscription();

create function private.guard_shark_source_status() returns trigger
language plpgsql set search_path = '' as $$
declare batch private.import_batches; term private.swimmer_subscriptions;
begin
  if tg_op='UPDATE' and (new.source_batch_id,new.source_code) is distinct from (old.source_batch_id,old.source_code)
  then raise exception 'Source provenance is immutable' using errcode='23514'; end if;
  if tg_op='INSERT' and new.source_batch_id is not null then
    select * into batch from private.import_batches
      where academy_id=new.academy_id and id=new.source_batch_id and state='approved';
    if not found then raise exception 'Approved source batch required' using errcode='23514'; end if;
    if tg_table_name='subscription_monthly_statuses' then
      if batch.includes_months is not true or batch.billing_year is distinct from new.billing_year
        or (new.source_code is not null and private.shark_monthly_code(new.source_code) is null)
        or new.normalized_status is distinct from private.shark_monthly_code(new.source_code)
      then raise exception 'Monthly source or billing year mismatch' using errcode='23514'; end if;
    elsif private.shark_document_code(new.source_code) is null or new.status is distinct from private.shark_document_code(new.source_code)
    then raise exception 'Document source mismatch' using errcode='23514';
    end if;
  end if;
  if tg_table_name='subscription_monthly_statuses' then
    if new.billing_year not between 1 and 9999 or new.billing_month not between 1 and 12
    then raise exception 'Invalid billing period' using errcode='23514'; end if;
    select * into term from private.swimmer_subscriptions where academy_id=new.academy_id and id=new.subscription_id;
    if not found then raise exception 'Subscription unavailable' using errcode='23503'; end if;
    if tg_op='INSERT' and (term.lifecycle='review' or not private.subscription_covers_month(term.starts_on,term.ends_before,new.billing_year,new.billing_month))
    then raise exception 'Confirmed subscription term required for the billing period' using errcode='23514'; end if;
  end if;
  return new;
end $$;
create trigger guard_shark_monthly_status before insert or update on private.subscription_monthly_statuses
for each row execute function private.guard_shark_source_status();
create trigger guard_shark_document_status before insert or update on private.registration_document_statuses
for each row execute function private.guard_shark_source_status();

create function private.bump_shark_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.row_version := old.row_version+1;
  return new;
end $$;

create function private.audit_shark_extension() returns trigger
language plpgsql set search_path = '' as $$
declare
  before_row jsonb := case when tg_op<>'INSERT' then to_jsonb(old) end;
  after_row jsonb := case when tg_op<>'DELETE' then to_jsonb(new) end;
  entry jsonb := coalesce(after_row,before_row);
  tenant uuid := (entry->>'academy_id')::uuid;
  actor uuid := private.require_admin(tenant);
begin
  insert into private.academy_extension_audit(academy_id,actor_membership_id,entity,target_id,related_id,operation,
      previous_status,new_status,row_version,reason_code,previous_visibility,new_visibility)
  values(tenant,actor,tg_table_name,coalesce(entry->>'id',entry->>'swimmer_id')::uuid,
    (case when tg_table_name='swimmer_guardian_contacts' then entry->>'contact_id' end)::uuid,tg_op,
    coalesce(before_row->>'normalized_status',before_row->>'status'),
    coalesce(after_row->>'normalized_status',after_row->>'status'),(entry->>'row_version')::bigint,
    case when tg_table_name='subscription_monthly_statuses'
       and before_row->>'normalized_status' is distinct from after_row->>'normalized_status'
      then after_row->>'correction_reason' end,
    (before_row->>'parent_visible')::boolean,(after_row->>'parent_visible')::boolean);
  return null;
end $$;

do $$
declare name text;
begin
  foreach name in array array['guardian_contacts','swimmer_guardian_contacts','swimmer_private_details','subscription_plans',
    'swimmer_subscriptions','subscription_monthly_statuses','registration_document_statuses','import_batches','import_source_links','import_review_items']
  loop
    execute format('create trigger audit_shark_extension after insert or update or delete on private.%I for each row execute function private.audit_shark_extension()',name);
    if name not in ('swimmer_guardian_contacts','import_source_links') then
      execute format('create trigger bump_shark_version before update on private.%I for each row execute function private.bump_shark_version()',name);
    end if;
  end loop;
end $$;

create function private.academy_save_guardian_contact(p_academy uuid,p_id uuid,p_expected bigint,p_name text,p_phone text,p_email text,p_archived boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  if p_id is null then
    insert into private.guardian_contacts(academy_id,display_name,phone,email)
    values(p_academy,btrim(p_name),p_phone,p_email) returning id into result;
  else
    update private.guardian_contacts set display_name=btrim(p_name), phone=p_phone, email=p_email,
      archived_at=case when p_archived then coalesce(archived_at,clock_timestamp()) end
    where academy_id=p_academy and id=p_id and row_version=p_expected returning id into result;
  end if;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_save_guardian_contact(p_academy uuid,p_id uuid,p_expected bigint,p_name text,p_phone text,p_email text,p_archived boolean) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_save_guardian_contact(p_academy,p_id,p_expected,p_name,p_phone,p_email,p_archived)
$$;
revoke all on function private.academy_save_guardian_contact(uuid,uuid,bigint,text,text,text,boolean),public.academy_save_guardian_contact(uuid,uuid,bigint,text,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.academy_save_guardian_contact(uuid,uuid,bigint,text,text,text,boolean),public.academy_save_guardian_contact(uuid,uuid,bigint,text,text,text,boolean) to authenticated;

create function private.academy_link_guardian_contact(p_academy uuid,p_swimmer uuid,p_contact uuid,p_link boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  if p_link then
    if not exists(select 1 from private.guardian_contacts where academy_id=p_academy and id=p_contact and archived_at is null)
    then raise exception 'Active contact required' using errcode='23503'; end if;
    insert into private.swimmer_guardian_contacts values(p_academy,p_swimmer,p_contact) on conflict do nothing;
  else
    delete from private.swimmer_guardian_contacts
    where academy_id=p_academy and swimmer_id=p_swimmer and contact_id=p_contact;
  end if;
  result := p_swimmer;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_link_guardian_contact(p_academy uuid,p_swimmer uuid,p_contact uuid,p_link boolean) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_link_guardian_contact(p_academy,p_swimmer,p_contact,p_link)
$$;
revoke all on function private.academy_link_guardian_contact(uuid,uuid,uuid,boolean),public.academy_link_guardian_contact(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function private.academy_link_guardian_contact(uuid,uuid,uuid,boolean),public.academy_link_guardian_contact(uuid,uuid,uuid,boolean) to authenticated;

create function private.academy_save_swimmer_birth_date(p_academy uuid,p_swimmer uuid,p_expected bigint,p_birth_date date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  if p_birth_date > private.academy_today(p_academy)
  then raise exception 'Birth date cannot be in the future' using errcode='23514'; end if;
  if p_expected is null then
    insert into private.swimmer_private_details(academy_id,swimmer_id,birth_date)
    values(p_academy,p_swimmer,p_birth_date) returning swimmer_id into result;
  else
    update private.swimmer_private_details set birth_date=p_birth_date
    where academy_id=p_academy and swimmer_id=p_swimmer and row_version=p_expected returning swimmer_id into result;
  end if;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_save_swimmer_birth_date(p_academy uuid,p_swimmer uuid,p_expected bigint,p_birth_date date) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_save_swimmer_birth_date(p_academy,p_swimmer,p_expected,p_birth_date)
$$;
revoke all on function private.academy_save_swimmer_birth_date(uuid,uuid,bigint,date),public.academy_save_swimmer_birth_date(uuid,uuid,bigint,date) from public,anon,authenticated,service_role;
grant execute on function private.academy_save_swimmer_birth_date(uuid,uuid,bigint,date),public.academy_save_swimmer_birth_date(uuid,uuid,bigint,date) to authenticated;

create function private.academy_save_subscription_plan(p_academy uuid,p_id uuid,p_expected bigint,p_code text,p_label text,p_price numeric,p_active boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  if p_price <> round(p_price,3) then raise exception 'Use at most three decimal places' using errcode='23514'; end if;
  if p_id is null then
    insert into private.subscription_plans(academy_id,code,label,monthly_price_tnd,active)
    values(p_academy,p_code,btrim(p_label),p_price,p_active) returning id into result;
  else
    update private.subscription_plans set label=btrim(p_label),monthly_price_tnd=p_price,active=p_active
    where academy_id=p_academy and id=p_id and row_version=p_expected and code=p_code returning id into result;
  end if;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_save_subscription_plan(p_academy uuid,p_id uuid,p_expected bigint,p_code text,p_label text,p_price numeric,p_active boolean) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_save_subscription_plan(p_academy,p_id,p_expected,p_code,p_label,p_price,p_active)
$$;
revoke all on function private.academy_save_subscription_plan(uuid,uuid,bigint,text,text,numeric,boolean),public.academy_save_subscription_plan(uuid,uuid,bigint,text,text,numeric,boolean) from public,anon,authenticated,service_role;
grant execute on function private.academy_save_subscription_plan(uuid,uuid,bigint,text,text,numeric,boolean),public.academy_save_subscription_plan(uuid,uuid,bigint,text,text,numeric,boolean) to authenticated;

create function private.academy_open_subscription(p_academy uuid,p_swimmer uuid,p_plan uuid,p_starts date,p_ends date,p_confirmed boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  insert into private.swimmer_subscriptions(academy_id,swimmer_id,plan_id,monthly_price_tnd,starts_on,ends_before,lifecycle)
  select p_academy,p_swimmer,p_plan,monthly_price_tnd,p_starts,p_ends,case when p_confirmed then 'confirmed' else 'review' end
  from private.subscription_plans where academy_id=p_academy and id=p_plan and active
  returning id into result;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_open_subscription(p_academy uuid,p_swimmer uuid,p_plan uuid,p_starts date,p_ends date,p_confirmed boolean) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_open_subscription(p_academy,p_swimmer,p_plan,p_starts,p_ends,p_confirmed)
$$;
revoke all on function private.academy_open_subscription(uuid,uuid,uuid,date,date,boolean),public.academy_open_subscription(uuid,uuid,uuid,date,date,boolean) from public,anon,authenticated,service_role;
grant execute on function private.academy_open_subscription(uuid,uuid,uuid,date,date,boolean),public.academy_open_subscription(uuid,uuid,uuid,date,date,boolean) to authenticated;

create function private.academy_update_subscription_term(p_academy uuid,p_id uuid,p_expected bigint,p_starts date,p_ends date,p_lifecycle text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  update private.swimmer_subscriptions set starts_on=p_starts,ends_before=p_ends,lifecycle=p_lifecycle,parent_visible=false
  where academy_id=p_academy and id=p_id and row_version=p_expected returning id into result;
  if exists (
    select 1 from private.subscription_monthly_statuses
    where academy_id=p_academy and subscription_id=result
      and not private.subscription_covers_month(p_starts,p_ends,billing_year,billing_month)
  ) then raise exception 'Term excludes an existing monthly observation' using errcode='23514'; end if;
  update private.subscription_monthly_statuses set parent_visible=false
  where academy_id=p_academy and subscription_id=result and parent_visible;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_update_subscription_term(p_academy uuid,p_id uuid,p_expected bigint,p_starts date,p_ends date,p_lifecycle text) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_update_subscription_term(p_academy,p_id,p_expected,p_starts,p_ends,p_lifecycle)
$$;
revoke all on function private.academy_update_subscription_term(uuid,uuid,bigint,date,date,text),public.academy_update_subscription_term(uuid,uuid,bigint,date,date,text) from public,anon,authenticated,service_role;
grant execute on function private.academy_update_subscription_term(uuid,uuid,bigint,date,date,text),public.academy_update_subscription_term(uuid,uuid,bigint,date,date,text) to authenticated;

create function private.academy_record_monthly_status(p_academy uuid,p_subscription uuid,p_year integer,p_month integer,p_status text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  insert into private.subscription_monthly_statuses(academy_id,subscription_id,billing_year,billing_month,normalized_status)
  values(p_academy,p_subscription,p_year,p_month,p_status) returning id into result;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_record_monthly_status(p_academy uuid,p_subscription uuid,p_year integer,p_month integer,p_status text) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_record_monthly_status(p_academy,p_subscription,p_year,p_month,p_status)
$$;
revoke all on function private.academy_record_monthly_status(uuid,uuid,integer,integer,text),public.academy_record_monthly_status(uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function private.academy_record_monthly_status(uuid,uuid,integer,integer,text),public.academy_record_monthly_status(uuid,uuid,integer,integer,text) to authenticated;

create function private.academy_correct_monthly_status(p_academy uuid,p_id uuid,p_expected bigint,p_status text,p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  if p_reason is null or p_reason not in ('source_review','admin_correction')
  then raise exception 'Correction reason required' using errcode='23514'; end if;
  update private.subscription_monthly_statuses set normalized_status=p_status,parent_visible=false,correction_reason=p_reason
  where academy_id=p_academy and id=p_id and row_version=p_expected returning id into result;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_correct_monthly_status(p_academy uuid,p_id uuid,p_expected bigint,p_status text,p_reason text) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_correct_monthly_status(p_academy,p_id,p_expected,p_status,p_reason)
$$;
revoke all on function private.academy_correct_monthly_status(uuid,uuid,bigint,text,text),public.academy_correct_monthly_status(uuid,uuid,bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function private.academy_correct_monthly_status(uuid,uuid,bigint,text,text),public.academy_correct_monthly_status(uuid,uuid,bigint,text,text) to authenticated;

create function private.academy_save_document_status(p_academy uuid,p_swimmer uuid,p_type text,p_expected bigint,p_status text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  if p_expected is null then
    insert into private.registration_document_statuses(academy_id,swimmer_id,document_type,status)
    values(p_academy,p_swimmer,p_type,p_status) returning id into result;
  else
    update private.registration_document_statuses set status=p_status,parent_visible=false
    where academy_id=p_academy and swimmer_id=p_swimmer and document_type=p_type and row_version=p_expected
    returning id into result;
  end if;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_save_document_status(p_academy uuid,p_swimmer uuid,p_type text,p_expected bigint,p_status text) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_save_document_status(p_academy,p_swimmer,p_type,p_expected,p_status)
$$;
revoke all on function private.academy_save_document_status(uuid,uuid,text,bigint,text),public.academy_save_document_status(uuid,uuid,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function private.academy_save_document_status(uuid,uuid,text,bigint,text),public.academy_save_document_status(uuid,uuid,text,bigint,text) to authenticated;

create function private.academy_publish_subscription_record(p_academy uuid,p_kind text,p_id uuid,p_expected bigint,p_visible boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  if p_kind = 'subscription' then
    update private.swimmer_subscriptions set parent_visible=p_visible
    where academy_id=p_academy and id=p_id and row_version=p_expected returning id into result;
    if not p_visible then
      update private.subscription_monthly_statuses set parent_visible=false
      where academy_id=p_academy and subscription_id=result and parent_visible;
    end if;
  elsif p_kind = 'month' then
    update private.subscription_monthly_statuses m set parent_visible=p_visible
    where m.academy_id=p_academy and m.id=p_id and m.row_version=p_expected
      and (not p_visible or exists (select 1 from private.swimmer_subscriptions s
        where s.academy_id=m.academy_id and s.id=m.subscription_id and s.parent_visible))
    returning m.id into result;
  elsif p_kind = 'document' then
    update private.registration_document_statuses set parent_visible=p_visible
    where academy_id=p_academy and id=p_id and row_version=p_expected returning id into result;
  else raise exception 'Unsupported publication kind' using errcode='23514';
  end if;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_publish_subscription_record(p_academy uuid,p_kind text,p_id uuid,p_expected bigint,p_visible boolean) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_publish_subscription_record(p_academy,p_kind,p_id,p_expected,p_visible)
$$;
revoke all on function private.academy_publish_subscription_record(uuid,text,uuid,bigint,boolean),public.academy_publish_subscription_record(uuid,text,uuid,bigint,boolean) from public,anon,authenticated,service_role;
grant execute on function private.academy_publish_subscription_record(uuid,text,uuid,bigint,boolean),public.academy_publish_subscription_record(uuid,text,uuid,bigint,boolean) to authenticated;

create function private.academy_create_import_review(p_academy uuid,p_source_digest text,p_mapping_version text,p_preview_digest text,p_billing_year integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid; actor uuid;
begin
  actor := private.require_admin(p_academy);

  insert into private.import_batches(academy_id,actor_membership_id,source_digest,mapping_version,preview_digest,billing_year)
  values(p_academy,actor,p_source_digest,p_mapping_version,p_preview_digest,p_billing_year)
  on conflict (academy_id,source_digest,mapping_version,preview_digest) do nothing returning id into result;
  if result is null then
    select id into result from private.import_batches where academy_id=p_academy and source_digest=p_source_digest
      and mapping_version=p_mapping_version and preview_digest=p_preview_digest
      and billing_year is not distinct from p_billing_year;
  end if;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_create_import_review(p_academy uuid,p_source_digest text,p_mapping_version text,p_preview_digest text,p_billing_year integer) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_create_import_review(p_academy,p_source_digest,p_mapping_version,p_preview_digest,p_billing_year)
$$;
revoke all on function private.academy_create_import_review(uuid,text,text,text,integer),public.academy_create_import_review(uuid,text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function private.academy_create_import_review(uuid,text,text,text,integer),public.academy_create_import_review(uuid,text,text,text,integer) to authenticated;

create function private.academy_quarantine_import_row(p_academy uuid,p_batch uuid,p_row uuid,p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  insert into private.import_review_items(academy_id,batch_id,source_row_key,reason_code)
  select p_academy,p_batch,p_row,p_reason from private.import_batches
  where academy_id=p_academy and id=p_batch and state='review'
  on conflict (academy_id,batch_id,source_row_key,reason_code) do nothing returning id into result;
  if result is null then
    select id into result from private.import_review_items where academy_id=p_academy and batch_id=p_batch
      and source_row_key=p_row and reason_code=p_reason;
  end if;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_quarantine_import_row(p_academy uuid,p_batch uuid,p_row uuid,p_reason text) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_quarantine_import_row(p_academy,p_batch,p_row,p_reason)
$$;
revoke all on function private.academy_quarantine_import_row(uuid,uuid,uuid,text),public.academy_quarantine_import_row(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.academy_quarantine_import_row(uuid,uuid,uuid,text),public.academy_quarantine_import_row(uuid,uuid,uuid,text) to authenticated;

create function private.academy_resolve_import_exception(p_academy uuid,p_id uuid,p_expected bigint,p_resolution text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid; actor uuid;
begin
  actor := private.require_admin(p_academy);

  if p_resolution is null or p_resolution not in ('resolved','excluded')
  then raise exception 'Invalid resolution' using errcode='23514'; end if;
  update private.import_review_items i set resolution=p_resolution,reviewed_by=actor,reviewed_at=clock_timestamp()
  where i.academy_id=p_academy and i.id=p_id and i.row_version=p_expected
    and exists(select 1 from private.import_batches b where b.academy_id=i.academy_id and b.id=i.batch_id and b.state='review')
  returning i.id into result;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_resolve_import_exception(p_academy uuid,p_id uuid,p_expected bigint,p_resolution text) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_resolve_import_exception(p_academy,p_id,p_expected,p_resolution)
$$;
revoke all on function private.academy_resolve_import_exception(uuid,uuid,bigint,text),public.academy_resolve_import_exception(uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function private.academy_resolve_import_exception(uuid,uuid,bigint,text),public.academy_resolve_import_exception(uuid,uuid,bigint,text) to authenticated;
create function private.academy_approve_import_review(p_academy uuid,p_batch uuid,p_expected bigint,p_preview_digest text,p_selection_digest text,p_includes_months boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid; actor uuid;
begin
  actor := private.require_admin(p_academy);

  update private.import_batches b set state='approved',approved_by=actor,approved_at=clock_timestamp(),selection_digest=p_selection_digest,includes_months=p_includes_months
  where b.academy_id=p_academy and b.id=p_batch and b.row_version=p_expected and b.state='review'
    and b.preview_digest=p_preview_digest and p_includes_months is not null
    and (not p_includes_months or b.billing_year is not null)
    and not exists(select 1 from private.import_review_items i where i.academy_id=b.academy_id and i.batch_id=b.id and i.resolution='open')
  returning b.id into result;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_approve_import_review(p_academy uuid,p_batch uuid,p_expected bigint,p_preview_digest text,p_selection_digest text,p_includes_months boolean) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_approve_import_review(p_academy,p_batch,p_expected,p_preview_digest,p_selection_digest,p_includes_months)
$$;
revoke all on function private.academy_approve_import_review(uuid,uuid,bigint,text,text,boolean),public.academy_approve_import_review(uuid,uuid,bigint,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.academy_approve_import_review(uuid,uuid,bigint,text,text,boolean),public.academy_approve_import_review(uuid,uuid,bigint,text,text,boolean) to authenticated;

create function private.academy_link_import_source(p_academy uuid,p_batch uuid,p_source uuid,p_fingerprint text,p_swimmer uuid,p_contact uuid,p_subscription uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  perform private.require_admin(p_academy);

  insert into private.import_source_links(academy_id,batch_id,source_entity_id,row_fingerprint,swimmer_id,contact_id,subscription_id)
  select p_academy,p_batch,p_source,p_fingerprint,p_swimmer,p_contact,p_subscription
  from private.import_batches where academy_id=p_academy and id=p_batch and state='approved'
  on conflict (academy_id,source_entity_id) do nothing returning id into result;
  if result is null then
    select id into result from private.import_source_links
    where academy_id=p_academy and batch_id=p_batch and source_entity_id=p_source and row_fingerprint=p_fingerprint
      and swimmer_id is not distinct from p_swimmer and contact_id is not distinct from p_contact
      and subscription_id is not distinct from p_subscription;
  end if;
  if result is null then raise exception 'Record unavailable, invalid or stale' using errcode='40001'; end if;
  return result;
end $$;
create function public.academy_link_import_source(p_academy uuid,p_batch uuid,p_source uuid,p_fingerprint text,p_swimmer uuid,p_contact uuid,p_subscription uuid) returns uuid
language sql security invoker set search_path = '' as $$
  select private.academy_link_import_source(p_academy,p_batch,p_source,p_fingerprint,p_swimmer,p_contact,p_subscription)
$$;
revoke all on function private.academy_link_import_source(uuid,uuid,uuid,text,uuid,uuid,uuid),public.academy_link_import_source(uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.academy_link_import_source(uuid,uuid,uuid,text,uuid,uuid,uuid),public.academy_link_import_source(uuid,uuid,uuid,text,uuid,uuid,uuid) to authenticated;

create function private.academy_parent_subscriptions(p_academy uuid,p_swimmer uuid) returns table(id uuid,swimmer_id uuid,monthly_price_tnd numeric,starts_on date,ends_before date,lifecycle text)
language sql stable security definer set search_path = '' as $$
  select s.id,s.swimmer_id,s.monthly_price_tnd,s.starts_on,s.ends_before,s.lifecycle
  from private.swimmer_subscriptions s
  where s.academy_id=p_academy and s.swimmer_id=p_swimmer and s.parent_visible
    and private.parent_history_from(p_academy,p_swimmer) is not null
$$;
create function public.academy_parent_subscriptions(p_academy uuid,p_swimmer uuid) returns table(id uuid,swimmer_id uuid,monthly_price_tnd numeric,starts_on date,ends_before date,lifecycle text)
language sql stable security invoker set search_path = '' as $$
  select * from private.academy_parent_subscriptions(p_academy,p_swimmer)
$$;
revoke all on function private.academy_parent_subscriptions(uuid,uuid),public.academy_parent_subscriptions(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.academy_parent_subscriptions(uuid,uuid),public.academy_parent_subscriptions(uuid,uuid) to authenticated;

create function private.academy_parent_months(p_academy uuid,p_swimmer uuid) returns table(subscription_id uuid,billing_year integer,billing_month integer,normalized_status text)
language sql stable security definer set search_path = '' as $$
  select m.subscription_id,m.billing_year,m.billing_month,m.normalized_status
  from private.subscription_monthly_statuses m
  join private.swimmer_subscriptions s on s.academy_id=m.academy_id and s.id=m.subscription_id
  where s.academy_id=p_academy and s.swimmer_id=p_swimmer and s.parent_visible and m.parent_visible
    and private.parent_history_from(p_academy,p_swimmer) is not null
$$;
create function public.academy_parent_months(p_academy uuid,p_swimmer uuid) returns table(subscription_id uuid,billing_year integer,billing_month integer,normalized_status text)
language sql stable security invoker set search_path = '' as $$
  select * from private.academy_parent_months(p_academy,p_swimmer)
$$;
revoke all on function private.academy_parent_months(uuid,uuid),public.academy_parent_months(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.academy_parent_months(uuid,uuid),public.academy_parent_months(uuid,uuid) to authenticated;

create function private.academy_parent_documents(p_academy uuid,p_swimmer uuid) returns table(document_type text,status text)
language sql stable security definer set search_path = '' as $$
  select d.document_type,d.status from private.registration_document_statuses d
  where d.academy_id=p_academy and d.swimmer_id=p_swimmer and d.parent_visible
    and private.parent_history_from(p_academy,p_swimmer) is not null
$$;
create function public.academy_parent_documents(p_academy uuid,p_swimmer uuid) returns table(document_type text,status text)
language sql stable security invoker set search_path = '' as $$
  select * from private.academy_parent_documents(p_academy,p_swimmer)
$$;
revoke all on function private.academy_parent_documents(uuid,uuid),public.academy_parent_documents(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.academy_parent_documents(uuid,uuid),public.academy_parent_documents(uuid,uuid) to authenticated;

create view public.academy_admin_guardian_contacts with (security_invoker=true) as select * from private.guardian_contacts;
revoke all on public.academy_admin_guardian_contacts from public,anon,authenticated,service_role;
grant select on public.academy_admin_guardian_contacts to authenticated;
create view public.academy_admin_swimmer_guardian_contacts with (security_invoker=true) as select * from private.swimmer_guardian_contacts;
revoke all on public.academy_admin_swimmer_guardian_contacts from public,anon,authenticated,service_role;
grant select on public.academy_admin_swimmer_guardian_contacts to authenticated;
create view public.academy_admin_swimmer_private_details with (security_invoker=true) as select * from private.swimmer_private_details;
revoke all on public.academy_admin_swimmer_private_details from public,anon,authenticated,service_role;
grant select on public.academy_admin_swimmer_private_details to authenticated;
create view public.academy_admin_subscription_plans with (security_invoker=true) as select * from private.subscription_plans;
revoke all on public.academy_admin_subscription_plans from public,anon,authenticated,service_role;
grant select on public.academy_admin_subscription_plans to authenticated;
create view public.academy_admin_swimmer_subscriptions with (security_invoker=true) as select * from private.swimmer_subscriptions;
revoke all on public.academy_admin_swimmer_subscriptions from public,anon,authenticated,service_role;
grant select on public.academy_admin_swimmer_subscriptions to authenticated;
create view public.academy_admin_subscription_monthly_statuses with (security_invoker=true) as select * from private.subscription_monthly_statuses;
revoke all on public.academy_admin_subscription_monthly_statuses from public,anon,authenticated,service_role;
grant select on public.academy_admin_subscription_monthly_statuses to authenticated;
create view public.academy_admin_registration_document_statuses with (security_invoker=true) as select * from private.registration_document_statuses;
revoke all on public.academy_admin_registration_document_statuses from public,anon,authenticated,service_role;
grant select on public.academy_admin_registration_document_statuses to authenticated;
create view public.academy_admin_import_batches with (security_invoker=true) as select * from private.import_batches;
revoke all on public.academy_admin_import_batches from public,anon,authenticated,service_role;
grant select on public.academy_admin_import_batches to authenticated;
create view public.academy_admin_import_source_links with (security_invoker=true) as select * from private.import_source_links;
revoke all on public.academy_admin_import_source_links from public,anon,authenticated,service_role;
grant select on public.academy_admin_import_source_links to authenticated;
create view public.academy_admin_import_review_items with (security_invoker=true) as select * from private.import_review_items;
revoke all on public.academy_admin_import_review_items from public,anon,authenticated,service_role;
grant select on public.academy_admin_import_review_items to authenticated;
create view public.academy_admin_academy_extension_audit with (security_invoker=true) as select * from private.academy_extension_audit;
revoke all on public.academy_admin_academy_extension_audit from public,anon,authenticated,service_role;
grant select on public.academy_admin_academy_extension_audit to authenticated;

revoke all on function private.shark_monthly_code(text),private.shark_document_code(text),private.shark_formule_price(text),
  private.subscription_covers_month(date,date,integer,integer),private.guard_shark_subscription(),
  private.guard_shark_source_status(),private.bump_shark_version(),private.audit_shark_extension()
from public,anon,authenticated,service_role;

commit;
