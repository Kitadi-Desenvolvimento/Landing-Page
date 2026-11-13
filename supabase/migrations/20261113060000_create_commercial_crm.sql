alter table public.payment_orders
  add column if not exists customer_company text;

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  contact_type text not null check (contact_type in ('person', 'company')),
  name text not null check (length(btrim(name)) between 1 and 160),
  email text,
  phone text,
  company_id uuid references public.crm_contacts(id) on delete set null,
  source text not null default 'manual',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_type = 'person' or company_id is null)
);

create table if not exists public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 180),
  product_slug text,
  product_title text,
  amount_kz integer check (amount_kz is null or amount_kz >= 0),
  stage text not null default 'new_contact'
    check (stage in ('new_contact', 'in_conversation', 'proposal_sent', 'converted')),
  source text not null default 'manual',
  payment_reference text unique references public.payment_orders(reference) on delete set null,
  payment_status text check (
    payment_status is null or
    payment_status in ('pending', 'accepted', 'rejected', 'expired', 'canceled', 'refunded')
  ),
  payment_reason text,
  notes text not null default '',
  follow_up_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  converted_at timestamptz
);

create table if not exists public.crm_opportunity_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  event_type text not null check (
    event_type in ('created', 'stage_changed', 'payment_updated', 'details_updated')
  ),
  from_stage text,
  to_stage text,
  payment_status text,
  details text not null default '',
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists crm_contacts_type_name_idx
  on public.crm_contacts (contact_type, lower(name));
create index if not exists crm_contacts_email_idx
  on public.crm_contacts (lower(email)) where email is not null;
create index if not exists crm_contacts_phone_idx
  on public.crm_contacts (phone) where phone is not null;
create index if not exists crm_opportunities_stage_created_idx
  on public.crm_opportunities (stage, created_at desc);
create index if not exists crm_opportunities_contact_created_idx
  on public.crm_opportunities (contact_id, created_at desc);
create index if not exists crm_opportunity_history_opportunity_idx
  on public.crm_opportunity_history (opportunity_id, created_at desc);

alter table public.crm_contacts enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_opportunity_history enable row level security;
revoke all on public.crm_contacts, public.crm_opportunities, public.crm_opportunity_history
  from anon, authenticated;
grant all on public.crm_contacts, public.crm_opportunities, public.crm_opportunity_history
  to service_role;

create or replace function public.set_crm_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists crm_contacts_updated_at on public.crm_contacts;
create trigger crm_contacts_updated_at
  before update on public.crm_contacts
  for each row execute function public.set_crm_updated_at();

drop trigger if exists crm_opportunities_updated_at on public.crm_opportunities;
create trigger crm_opportunities_updated_at
  before update on public.crm_opportunities
  for each row execute function public.set_crm_updated_at();

create or replace function public.record_crm_opportunity_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  actor_email text;
  event_kind text;
  event_details text := '';
begin
  actor_id := nullif(current_setting('app.crm_actor_id', true), '')::uuid;
  actor_email := coalesce(nullif(current_setting('app.crm_actor_email', true), ''), '');

  if tg_op = 'INSERT' then
    event_kind := 'created';
    event_details := case when new.source = 'checkout'
      then 'Oportunidade criada a partir do checkout.'
      else 'Oportunidade criada manualmente.' end;
  elsif old.stage is distinct from new.stage then
    event_kind := 'stage_changed';
    event_details := 'Etapa comercial actualizada.';
  elsif old.payment_status is distinct from new.payment_status
    or old.payment_reason is distinct from new.payment_reason then
    event_kind := 'payment_updated';
    event_details := coalesce(new.payment_reason, 'Estado de pagamento actualizado.');
  else
    event_kind := 'details_updated';
    event_details := 'Detalhes ou seguimento actualizados.';
  end if;

  insert into public.crm_opportunity_history (
    opportunity_id, event_type, from_stage, to_stage,
    payment_status, details, changed_by, changed_by_email
  ) values (
    new.id,
    event_kind,
    case when tg_op = 'INSERT' then null else old.stage end,
    new.stage,
    new.payment_status,
    event_details,
    actor_id,
    actor_email
  );

  return new;
end;
$$;

drop trigger if exists crm_opportunity_history_after_insert on public.crm_opportunities;
create trigger crm_opportunity_history_after_insert
  after insert on public.crm_opportunities
  for each row execute function public.record_crm_opportunity_history();

drop trigger if exists crm_opportunity_history_after_update on public.crm_opportunities;
create trigger crm_opportunity_history_after_update
  after update on public.crm_opportunities
  for each row
  when (
    old.stage is distinct from new.stage
    or old.payment_status is distinct from new.payment_status
    or old.payment_reason is distinct from new.payment_reason
    or old.notes is distinct from new.notes
    or old.follow_up_at is distinct from new.follow_up_at
  )
  execute function public.record_crm_opportunity_history();

create or replace function public.sync_payment_order_to_crm(p_order public.payment_orders)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  person_id uuid;
  organization_id uuid;
  existing_email_contact uuid;
  existing_phone_contact uuid;
  normalized_email text;
  normalized_phone text;
  company_name text;
  existing_opportunity uuid;
begin
  normalized_email := nullif(lower(btrim(p_order.customer_email)), '');
  normalized_phone := nullif(regexp_replace(p_order.customer_phone, '[^0-9]', '', 'g'), '');
  company_name := nullif(btrim(p_order.customer_company), '');

  if normalized_email is not null then
    perform pg_advisory_xact_lock(hashtextextended('email:' || normalized_email, 0));
  end if;
  if normalized_phone is not null then
    perform pg_advisory_xact_lock(hashtextextended('phone:' || normalized_phone, 0));
  end if;
  if normalized_email is null and normalized_phone is null then
    perform pg_advisory_xact_lock(hashtextextended('reference:' || p_order.reference, 0));
  end if;

  if company_name is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('company:' || lower(company_name), 0)
    );
    select id into organization_id
    from public.crm_contacts
    where contact_type = 'company' and lower(name) = lower(company_name)
    order by created_at
    limit 1;

    if organization_id is null then
      insert into public.crm_contacts (contact_type, name, source)
      values ('company', company_name, 'checkout')
      returning id into organization_id;
    end if;
  end if;

  select contact.id into existing_email_contact
  from public.crm_contacts as contact
  where contact.contact_type = 'person' and normalized_email is not null
    and lower(contact.email) = normalized_email
  order by contact.created_at
  limit 1;

  select contact.id into existing_phone_contact
  from public.crm_contacts as contact
  where contact.contact_type = 'person' and normalized_phone is not null
    and regexp_replace(coalesce(contact.phone, ''), '[^0-9]', '', 'g') = normalized_phone
  order by contact.created_at
  limit 1;

  if existing_email_contact is not null
    and existing_phone_contact is not null
    and existing_email_contact <> existing_phone_contact then
    person_id := null;
  else
    person_id := coalesce(existing_email_contact, existing_phone_contact);
  end if;

  if person_id is null then
    insert into public.crm_contacts (
      contact_type, name, email, phone, company_id, source
    ) values (
      'person', p_order.customer_name, normalized_email, p_order.customer_phone,
      organization_id, 'checkout'
    )
    returning id into person_id;
  else
    update public.crm_contacts
    set email = coalesce(email, normalized_email),
        phone = coalesce(phone, p_order.customer_phone),
        company_id = coalesce(public.crm_contacts.company_id, organization_id)
    where id = person_id;
  end if;

  select id into existing_opportunity
  from public.crm_opportunities
  where payment_reference = p_order.reference;

  if existing_opportunity is null then
    insert into public.crm_opportunities (
      contact_id, title, product_slug, product_title, amount_kz, stage,
      source, payment_reference, payment_status, payment_reason, created_at
    ) values (
      person_id,
      p_order.product_title,
      p_order.course_slug,
      p_order.product_title,
      p_order.amount_kz,
      case when p_order.status = 'accepted' then 'converted' else 'new_contact' end,
      'checkout',
      p_order.reference,
      p_order.status,
      p_order.reason,
      p_order.created_at
    )
    on conflict (payment_reference) do nothing;
  else
    update public.crm_opportunities
    set payment_status = p_order.status,
        payment_reason = p_order.reason,
        stage = case when p_order.status = 'accepted' then 'converted' else stage end,
        converted_at = case
          when p_order.status = 'accepted' then coalesce(converted_at, p_order.paid_at, now())
          else converted_at
        end
    where id = existing_opportunity;
  end if;

  if p_order.status = 'accepted' then
    update public.crm_opportunities
    set stage = 'converted',
        converted_at = coalesce(converted_at, p_order.paid_at, now())
    where payment_reference = p_order.reference;
  end if;
end;
$$;

create or replace function public.sync_payment_order_to_crm_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_payment_order_to_crm(new);
  return new;
end;
$$;

drop trigger if exists payment_orders_sync_crm on public.payment_orders;
create trigger payment_orders_sync_crm
  after insert or update of status, reason, customer_company on public.payment_orders
  for each row execute function public.sync_payment_order_to_crm_trigger();

do $$
declare
  order_row public.payment_orders;
begin
  for order_row in select * from public.payment_orders loop
    perform public.sync_payment_order_to_crm(order_row);
  end loop;
end;
$$;

create or replace function public.backoffice_create_crm_opportunity(
  p_contact jsonb,
  p_opportunity jsonb,
  p_actor_id uuid,
  p_actor_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  contact_id uuid;
  opportunity_id uuid;
  organization_id uuid;
begin
  perform set_config('app.crm_actor_id', p_actor_id::text, true);
  perform set_config('app.crm_actor_email', coalesce(p_actor_email, ''), true);

  if p_contact->>'contact_type' = 'person' then
    if nullif(p_contact->>'company_id', '') is not null then
      organization_id := (p_contact->>'company_id')::uuid;
      if not exists (
        select 1 from public.crm_contacts
        where id = organization_id and contact_type = 'company'
      ) then
        raise exception 'Empresa inválida.';
      end if;
    elsif nullif(btrim(p_contact->>'company_name'), '') is not null then
      perform pg_advisory_xact_lock(
        hashtextextended('company:' || lower(btrim(p_contact->>'company_name')), 0)
      );
      select id into organization_id
      from public.crm_contacts
      where contact_type = 'company'
        and lower(name) = lower(btrim(p_contact->>'company_name'))
      order by created_at
      limit 1;
      if organization_id is null then
        insert into public.crm_contacts (
          contact_type, name, source, created_by
        ) values (
          'company', btrim(p_contact->>'company_name'), 'manual', p_actor_id
        )
        returning id into organization_id;
      end if;
    end if;
  end if;

  insert into public.crm_contacts (
    contact_type, name, email, phone, company_id, source, created_by
  ) values (
    p_contact->>'contact_type',
    p_contact->>'name',
    nullif(btrim(p_contact->>'email'), ''),
    nullif(btrim(p_contact->>'phone'), ''),
    organization_id,
    'manual',
    p_actor_id
  )
  returning id into contact_id;

  insert into public.crm_opportunities (
    contact_id, title, product_slug, product_title, amount_kz,
    stage, source, notes, follow_up_at, created_by
  ) values (
    contact_id,
    p_opportunity->>'title',
    nullif(p_opportunity->>'product_slug', ''),
    nullif(p_opportunity->>'product_title', ''),
    nullif(p_opportunity->>'amount_kz', '')::integer,
    coalesce(nullif(p_opportunity->>'stage', ''), 'new_contact'),
    'manual',
    coalesce(p_opportunity->>'notes', ''),
    nullif(p_opportunity->>'follow_up_at', '')::timestamptz,
    p_actor_id
  )
  returning id into opportunity_id;

  return opportunity_id;
end;
$$;

create or replace function public.backoffice_update_crm_opportunity(
  p_opportunity_id uuid,
  p_stage text,
  p_notes text,
  p_follow_up_at timestamptz,
  p_actor_id uuid,
  p_actor_email text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.crm_actor_id', p_actor_id::text, true);
  perform set_config('app.crm_actor_email', coalesce(p_actor_email, ''), true);

  update public.crm_opportunities
  set stage = p_stage,
      notes = p_notes,
  follow_up_at = p_follow_up_at,
  converted_at = case
    when p_stage = 'converted' then coalesce(converted_at, now())
    else converted_at
  end
  where id = p_opportunity_id;

  return found;
end;
$$;

revoke all on function public.sync_payment_order_to_crm(public.payment_orders)
  from public, anon, authenticated;
revoke all on function public.sync_payment_order_to_crm_trigger()
  from public, anon, authenticated;
revoke all on function public.record_crm_opportunity_history()
  from public, anon, authenticated;
revoke all on function public.backoffice_create_crm_opportunity(jsonb, jsonb, uuid, text)
  from public, anon, authenticated;
revoke all on function public.backoffice_update_crm_opportunity(uuid, text, text, timestamptz, uuid, text)
  from public, anon, authenticated;
grant execute on function public.backoffice_create_crm_opportunity(jsonb, jsonb, uuid, text)
  to service_role;
grant execute on function public.backoffice_update_crm_opportunity(uuid, text, text, timestamptz, uuid, text)
  to service_role;
