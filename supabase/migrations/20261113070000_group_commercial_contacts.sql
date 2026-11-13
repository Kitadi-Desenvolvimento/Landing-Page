create or replace function public.backoffice_move_crm_contact_stage(
  p_contact_id uuid,
  p_from_stage text,
  p_to_stage text,
  p_edit_opportunity_id uuid,
  p_notes text,
  p_follow_up_at timestamptz,
  p_actor_id uuid,
  p_actor_email text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if p_from_stage not in ('new_contact', 'in_conversation', 'proposal_sent', 'converted')
    or p_to_stage not in ('new_contact', 'in_conversation', 'proposal_sent', 'converted') then
    raise exception 'Etapa comercial inválida.';
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
  uuid, text, text, uuid, text, timestamptz, uuid, text
) from public, anon, authenticated;
grant execute on function public.backoffice_move_crm_contact_stage(
  uuid, text, text, uuid, text, timestamptz, uuid, text
) to service_role;
