create table if not exists public.wipay_signature_token_cache (
  id boolean primary key default true check (id),
  encrypted_token text,
  encryption_iv text,
  encryption_tag text,
  expires_at timestamptz,
  refresh_lock_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.wipay_signature_token_cache (id)
values (true)
on conflict (id) do nothing;

alter table public.wipay_signature_token_cache enable row level security;
revoke all on public.wipay_signature_token_cache from anon, authenticated;
grant all on public.wipay_signature_token_cache to service_role;

create or replace function public.set_wipay_signature_token_cache_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wipay_signature_token_cache_updated_at
  on public.wipay_signature_token_cache;
create trigger wipay_signature_token_cache_updated_at
  before update on public.wipay_signature_token_cache
  for each row execute function public.set_wipay_signature_token_cache_updated_at();
