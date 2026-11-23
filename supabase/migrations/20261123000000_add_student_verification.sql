alter table public.payment_orders
  add column if not exists original_amount_kz integer,
  add column if not exists student_discount_percent integer;

create table if not exists public.student_verification_requests (
  id uuid primary key,
  identifier_hash text not null,
  ip_hash text not null,
  code_hash text not null,
  student_name text,
  student_email text,
  student_phone text,
  attempts integer not null default 0,
  token_hash text,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists student_verification_identifier_idx
  on public.student_verification_requests (identifier_hash, created_at desc);
create index if not exists student_verification_ip_idx
  on public.student_verification_requests (ip_hash, created_at desc);
create unique index if not exists student_verification_token_idx
  on public.student_verification_requests (token_hash) where token_hash is not null;
create index if not exists student_verification_expiry_idx
  on public.student_verification_requests (expires_at);

alter table public.student_verification_requests enable row level security;
revoke all on public.student_verification_requests from public, anon, authenticated;
grant all on public.student_verification_requests to service_role;

create or replace function public.start_student_verification(
  p_id uuid, p_identifier_hash text, p_ip_hash text, p_code_hash text,
  p_name text, p_email text, p_phone text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.student_verification_requests
    where expires_at < now() - interval '24 hours';
  perform pg_advisory_xact_lock(hashtext('student-id:' || p_identifier_hash));
  perform pg_advisory_xact_lock(hashtext('student-ip:' || p_ip_hash));
  if (select count(*) from public.student_verification_requests
      where identifier_hash = p_identifier_hash and created_at > now() - interval '1 hour') >= 5
    or (select count(*) from public.student_verification_requests
      where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 30
    or exists (select 1 from public.student_verification_requests
      where identifier_hash = p_identifier_hash and created_at > now() - interval '1 minute')
  then return false; end if;

  insert into public.student_verification_requests
    (id, identifier_hash, ip_hash, code_hash, student_name, student_email, student_phone, expires_at)
  values
    (p_id, p_identifier_hash, p_ip_hash, p_code_hash, p_name, p_email, p_phone, now() + interval '10 minutes');
  return true;
end;
$$;

create or replace function public.verify_student_code(
  p_id uuid, p_code_hash text, p_token_hash text
) returns table(student_name text, student_email text, student_phone text)
language plpgsql security definer set search_path = public as $$
declare
  v_row public.student_verification_requests;
begin
  select * into v_row from public.student_verification_requests where id = p_id for update;
  if not found or v_row.expires_at <= now() or v_row.verified_at is not null or v_row.attempts >= 5 then
    return;
  end if;
  update public.student_verification_requests set attempts = attempts + 1 where id = p_id;
  if v_row.code_hash <> p_code_hash or v_row.student_email is null then return; end if;
  update public.student_verification_requests
    set verified_at = now(), token_hash = p_token_hash, expires_at = now() + interval '30 minutes'
    where id = p_id;
  return query select v_row.student_name, v_row.student_email, v_row.student_phone;
end;
$$;

revoke all on function public.start_student_verification(uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.verify_student_code(uuid, text, text) from public, anon, authenticated;
grant execute on function public.start_student_verification(uuid, text, text, text, text, text, text) to service_role;
grant execute on function public.verify_student_code(uuid, text, text) to service_role;
