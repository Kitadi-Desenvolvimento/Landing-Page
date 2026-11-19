-- E-books (PDF) vendidos na landing page.
-- Os originais e as cópias entregues ficam num bucket privado: só o servidor
-- (service role) lhes acede e entrega links temporários.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ebooks', 'ebooks', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada compra de e-book só pode ser descarregada uma vez pelo cliente.
alter table public.payment_orders
  add column if not exists ebook_downloaded_at timestamptz;
