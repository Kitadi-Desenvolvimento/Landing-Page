-- Mudar de etapa fecha os seguimentos de hoje e atrasados das outras
-- oportunidades do mesmo cartão. O próximo contacto volta a aparecer
-- quando for marcada uma nova data. A oportunidade editada recebe a data
-- enviada pelo backoffice.

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
  luanda_today date := (timezone('Africa/Luanda', now()))::date;
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
        when p_from_stage is distinct from p_to_stage
          and follow_up_at is not null
          and (follow_up_at at time zone 'Africa/Luanda')::date <= luanda_today
          then null
        else follow_up_at
      end
  where contact_id = p_contact_id
    and stage = p_from_stage
    and (p_to_stage = 'converted' or payment_status is distinct from 'accepted');

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
