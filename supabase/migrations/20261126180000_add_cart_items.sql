-- Linhas de um carrinho. O amount_kz da encomenda continua a ser o total
-- cobrado na WiPay, para a confirmação comparar o mesmo valor.
alter table public.payment_orders
  add column if not exists cart_items jsonb;
