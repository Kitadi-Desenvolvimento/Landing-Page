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
  stage_change_reason text;
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
    stage_change_reason := nullif(
      btrim(coalesce(current_setting('app.crm_stage_change_reason', true), '')),
      ''
    );
    event_details := 'Motivo da mudança: ' || coalesce(
      stage_change_reason,
      case
        when new.stage = 'converted' and new.payment_status = 'accepted'
          then 'Pagamento confirmado automaticamente.'
        else 'Etapa actualizada automaticamente pelo sistema.'
      end
    );
    if new.stage = 'lost'
      and nullif(btrim(new.lost_reason), '') is not null
      and nullif(btrim(new.lost_reason), '') is distinct from stage_change_reason then
      event_details := event_details || ' Motivo da perda: ' ||
        coalesce(nullif(btrim(new.lost_reason), ''), 'Não indicado.');
    end if;
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
  uuid, text, text, uuid, text, timestamptz, uuid, text, text
);

create function public.backoffice_move_crm_contact_stage(
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

revoke all on function public.record_crm_opportunity_history()
  from public, anon, authenticated;
revoke all on function public.backoffice_update_crm_opportunity(
  uuid, text, text, timestamptz, uuid, text
) from public, anon, authenticated;
grant execute on function public.backoffice_update_crm_opportunity(
  uuid, text, text, timestamptz, uuid, text
) to service_role;
revoke all on function public.backoffice_move_crm_contact_stage(
  uuid, text, text, uuid, text, timestamptz, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.backoffice_move_crm_contact_stage(
  uuid, text, text, uuid, text, timestamptz, uuid, text, text, text
) to service_role;
