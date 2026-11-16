alter table public.objectives
  add column if not exists parent_objective_id uuid
    references public.objectives(id) on delete cascade;

create index if not exists objectives_parent_objective_idx
  on public.objectives (parent_objective_id, active, archived, title)
  where parent_objective_id is not null;

create or replace function public.sync_objective_key_result_area()
returns trigger
language plpgsql
as $$
begin
  if new.parent_objective_id is null and old.area_id is distinct from new.area_id then
    update public.objectives
    set area_id = new.area_id,
        updated_by = new.updated_by
    where parent_objective_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists objectives_sync_key_result_area on public.objectives;
create trigger objectives_sync_key_result_area
  after update of area_id on public.objectives
  for each row execute function public.sync_objective_key_result_area();
