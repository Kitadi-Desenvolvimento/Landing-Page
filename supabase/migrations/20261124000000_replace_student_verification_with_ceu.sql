drop function if exists public.start_student_verification(uuid, text, text, text, text, text, text);
drop function if exists public.verify_student_code(uuid, text, text);
drop table if exists public.student_verification_requests;

create table if not exists public.ceu_student_verifications (
  id uuid primary key,
  token_hash text,
  expires_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists ceu_student_verification_token_idx
  on public.ceu_student_verifications (token_hash)
  where token_hash is not null;
create index if not exists ceu_student_verification_created_idx
  on public.ceu_student_verifications (created_at);
create index if not exists ceu_student_verification_expiry_idx
  on public.ceu_student_verifications (expires_at);

alter table public.ceu_student_verifications enable row level security;
revoke all on public.ceu_student_verifications from public, anon, authenticated;
grant all on public.ceu_student_verifications to service_role;

create or replace function public.reserve_ceu_student_validation(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('ceu-student-validation-global'));
  delete from public.ceu_student_verifications
    where created_at < now() - interval '24 hours';

  if (select count(*) from public.ceu_student_verifications
      where created_at > now() - interval '1 minute') >= 30
  then
    return false;
  end if;

  insert into public.ceu_student_verifications (id, expires_at)
  values (p_id, now());
  return true;
end;
$$;

revoke all on function public.reserve_ceu_student_validation(uuid) from public, anon, authenticated;
grant execute on function public.reserve_ceu_student_validation(uuid) to service_role;
