-- O comercial responsável fica no contacto. Quem criou o registo continua em created_by.

alter table public.crm_contacts
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

update public.crm_contacts
set owner_id = created_by
where owner_id is null and created_by is not null;

update public.crm_contacts as contact
set owner_id = (
  select opportunity.created_by
  from public.crm_opportunities as opportunity
  where opportunity.contact_id = contact.id
    and opportunity.created_by is not null
  order by opportunity.created_at
  limit 1
)
where contact.owner_id is null;

create index if not exists crm_contacts_owner_idx
  on public.crm_contacts (owner_id);

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
  owner_id uuid := nullif(p_contact->>'owner_id', '')::uuid;
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
          contact_type, name, source, created_by, owner_id
        ) values (
          'company', btrim(p_contact->>'company_name'), 'manual', p_actor_id, owner_id
        )
        returning id into organization_id;
      end if;
    end if;
  end if;

  insert into public.crm_contacts (
    contact_type, name, email, phone, company_id, source, created_by, owner_id
  ) values (
    p_contact->>'contact_type',
    p_contact->>'name',
    nullif(btrim(p_contact->>'email'), ''),
    nullif(btrim(p_contact->>'phone'), ''),
    organization_id,
    'manual',
    p_actor_id,
    owner_id
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
