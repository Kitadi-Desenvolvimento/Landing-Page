-- Uma venda manual reutiliza o contacto do email só quando o nome
-- também é o do pagamento. Nomes diferentes criam outra pessoa, sem
-- alterar quem já tinha aquele email. Cada oportunidade muda de etapa
-- sozinha.

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
  normalized_name text;
  company_name text;
  existing_opportunity uuid;
begin
  normalized_email := nullif(lower(btrim(p_order.customer_email)), '');
  normalized_phone := nullif(regexp_replace(p_order.customer_phone, '[^0-9]', '', 'g'), '');
  normalized_name := nullif(lower(btrim(p_order.customer_name)), '');
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
  where contact.contact_type = 'person'
    and normalized_email is not null
    and lower(contact.email) = normalized_email
    and (
      normalized_name is null
      or lower(btrim(contact.name)) = normalized_name
    )
  order by contact.created_at
  limit 1;

  select contact.id into existing_phone_contact
  from public.crm_contacts as contact
  where contact.contact_type = 'person'
    and normalized_phone is not null
    and regexp_replace(coalesce(contact.phone, ''), '[^0-9]', '', 'g') = normalized_phone
    and (
      normalized_name is null
      or lower(btrim(contact.name)) = normalized_name
    )
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
      contact_type, name, email, phone, company_id, owner_id, source
    ) values (
      'person',
      coalesce(nullif(btrim(p_order.customer_name), ''), p_order.customer_name),
      normalized_email,
      p_order.customer_phone,
      organization_id,
      p_order.created_by,
      'checkout'
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
    set contact_id = person_id,
        payment_status = p_order.status,
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

drop trigger if exists payment_orders_sync_crm on public.payment_orders;
create trigger payment_orders_sync_crm
  after insert or update of status, reason, customer_company, customer_name on public.payment_orders
  for each row execute function public.sync_payment_order_to_crm_trigger();

-- Vendas já ligadas ao contacto do email passam para uma pessoa com o
-- nome do pagamento. O contacto original mantém o nome que já tinha.
do $$
declare
  payment_row record;
  target_id uuid;
  organization_id uuid;
  registered_name text;
  registered_email text;
begin
  for payment_row in
    select
      opportunity.id as opportunity_id,
      btrim(payment.customer_name) as customer_name,
      nullif(lower(btrim(payment.customer_email)), '') as email,
      nullif(btrim(payment.customer_phone), '') as phone,
      nullif(btrim(payment.customer_company), '') as company_name,
      payment.created_by,
      contact.owner_id
    from public.crm_opportunities as opportunity
    join public.payment_orders as payment
      on payment.reference = opportunity.payment_reference
    join public.crm_contacts as contact
      on contact.id = opportunity.contact_id
    where length(btrim(payment.customer_name)) between 1 and 160
      and lower(btrim(contact.name)) is distinct from lower(btrim(payment.customer_name))
  loop
    registered_name := payment_row.customer_name;
    registered_email := payment_row.email;
    organization_id := null;

    if payment_row.company_name is not null then
      select id into organization_id
      from public.crm_contacts
      where contact_type = 'company'
        and lower(name) = lower(payment_row.company_name)
      order by created_at
      limit 1;

      if organization_id is null then
        insert into public.crm_contacts (contact_type, name, source)
        values ('company', payment_row.company_name, 'checkout')
        returning id into organization_id;
      end if;
    end if;

    select id into target_id
    from public.crm_contacts
    where contact_type = 'person'
      and lower(btrim(name)) = lower(registered_name)
      and (
        (registered_email is null and email is null)
        or lower(email) is not distinct from registered_email
      )
    order by created_at
    limit 1;

    if target_id is null then
      insert into public.crm_contacts (
        contact_type, name, email, phone, company_id, owner_id, source
      ) values (
        'person',
        registered_name,
        registered_email,
        payment_row.phone,
        organization_id,
        coalesce(payment_row.created_by, payment_row.owner_id),
        'checkout'
      )
      returning id into target_id;
    end if;

    update public.crm_opportunities
    set contact_id = target_id
    where id = payment_row.opportunity_id;
  end loop;
end;
$$;

create or replace function public.backoffice_move_crm_contact_stage(
  p_contact_id uuid,
  p_from_stage text,
  p_to_stage text,
  p_edit_opportunity_id uuid,
  p_notes text,
  p_follow_up_at timestamptz,
  p_actor_id uuid,
  p_actor_email text,
  p_lost_reason text default null,
  p_stage_change_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
  lost_reason_text text := nullif(btrim(coalesce(p_lost_reason, '')), '');
  stage_change_reason_text text := nullif(btrim(coalesce(p_stage_change_reason, '')), '');
begin
  if p_from_stage not in ('new_contact', 'in_conversation', 'proposal_sent', 'converted', 'lost')
    or p_to_stage not in ('new_contact', 'in_conversation', 'proposal_sent', 'converted', 'lost') then
    raise exception 'Etapa comercial inválida.';
  end if;
  if p_from_stage is distinct from p_to_stage and stage_change_reason_text is null then
    raise exception 'Indique o motivo da mudança de etapa.';
  end if;
  if p_to_stage = 'lost' and lost_reason_text is null then
    raise exception 'Indique o motivo da perda.';
  end if;

  perform set_config('app.crm_actor_id', p_actor_id::text, true);
  perform set_config('app.crm_actor_email', coalesce(p_actor_email, ''), true);
  perform set_config('app.crm_stage_change_reason', coalesce(stage_change_reason_text, ''), true);

  update public.crm_opportunities
  set stage = p_to_stage,
      lost_reason = case when p_to_stage = 'lost' then lost_reason_text else null end,
      converted_at = case
        when p_to_stage = 'converted' then coalesce(converted_at, now())
        else converted_at
      end,
      notes = p_notes,
      follow_up_at = p_follow_up_at
  where id = p_edit_opportunity_id
    and contact_id = p_contact_id
    and stage = p_from_stage
    and (p_to_stage = 'converted' or payment_status is distinct from 'accepted');

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
