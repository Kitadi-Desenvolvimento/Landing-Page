-- Etapa "Perdido" no funil comercial, sempre com motivo.

alter table public.crm_opportunities
  add column if not exists lost_reason text,
  add column if not exists lost_at timestamptz;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.crm_opportunities'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%new_contact%'
  loop
    execute format('alter table public.crm_opportunities drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.crm_opportunities
  drop constraint if exists crm_opportunities_stage_check,
  drop constraint if exists crm_opportunities_lost_reason_check;

alter table public.crm_opportunities
  add constraint crm_opportunities_stage_check
    check (stage in ('new_contact', 'in_conversation', 'proposal_sent', 'converted', 'lost')),
  add constraint crm_opportunities_lost_reason_check
    check (
      stage <> 'lost' or (
        lost_reason is not null
        and length(btrim(lost_reason)) between 1 and 300
      )
    );

create index if not exists crm_opportunities_follow_up_idx
  on public.crm_opportunities (follow_up_at)
  where follow_up_at is not null and stage not in ('converted', 'lost');

-- Fora da etapa Perdido, o motivo deixa de fazer sentido.
create or replace function public.clear_crm_lost_fields()
returns trigger
language plpgsql
as $$
begin
  if new.stage <> 'lost' then
    new.lost_reason := null;
    new.lost_at := null;
  elsif old.stage is distinct from 'lost' then
    new.lost_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists crm_opportunities_lost_fields on public.crm_opportunities;
create trigger crm_opportunities_lost_fields
  before update on public.crm_opportunities
  for each row execute function public.clear_crm_lost_fields();

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
    event_details := case when new.stage = 'lost'
      then 'Marcada como perdida: ' || coalesce(new.lost_reason, '')
      else 'Etapa comercial actualizada.' end;
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

drop function if exists public.backoffice_move_crm_contact_stage(
  uuid, text, text, uuid, text, timestamptz, uuid, text
);

create or replace function public.backoffice_move_crm_contact_stage(
  p_contact_id uuid,
  p_from_stage text,
  p_to_stage text,
  p_edit_opportunity_id uuid,
  p_notes text,
  p_follow_up_at timestamptz,
  p_actor_id uuid,
  p_actor_email text,
  p_lost_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
  lost_reason_text text := nullif(btrim(coalesce(p_lost_reason, '')), '');
begin
  if p_from_stage not in ('new_contact', 'in_conversation', 'proposal_sent', 'converted', 'lost')
    or p_to_stage not in ('new_contact', 'in_conversation', 'proposal_sent', 'converted', 'lost') then
    raise exception 'Etapa comercial inválida.';
  end if;
  if p_to_stage = 'lost' and lost_reason_text is null then
    raise exception 'Indique o motivo da perda.';
  end if;

  perform set_config('app.crm_actor_id', p_actor_id::text, true);
  perform set_config('app.crm_actor_email', coalesce(p_actor_email, ''), true);

  if not exists (
    select 1
    from public.crm_opportunities
    where id = p_edit_opportunity_id
      and contact_id = p_contact_id
      and stage = p_from_stage
  ) then
    return 0;
  end if;

  update public.crm_opportunities
  set stage = p_to_stage,
      lost_reason = case when p_to_stage = 'lost' then lost_reason_text else null end,
      converted_at = case
        when p_to_stage = 'converted' then coalesce(converted_at, now())
        else converted_at
      end,
      notes = case when id = p_edit_opportunity_id then p_notes else notes end,
      follow_up_at = case
        when id = p_edit_opportunity_id then p_follow_up_at
        else follow_up_at
      end
  where contact_id = p_contact_id
    and stage = p_from_stage
    and (p_to_stage = 'converted' or payment_status is distinct from 'accepted');

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.backoffice_move_crm_contact_stage(
  uuid, text, text, uuid, text, timestamptz, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.backoffice_move_crm_contact_stage(
  uuid, text, text, uuid, text, timestamptz, uuid, text, text
) to service_role;
