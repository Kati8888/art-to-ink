alter table public.orders
  add column if not exists artwork_format text
  check (artwork_format is null or artwork_format in ('colour', 'blackAndWhite'));

alter table public.orders
  drop constraint if exists orders_variant_check;

alter table public.orders
  add constraint orders_variant_check
  check (variant is null or variant in ('mini', 'small', 'detailed', 'premium', 'collection'));

create table if not exists public.download_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists download_links_order_id_idx on public.download_links (order_id);
create index if not exists download_links_expiry_idx on public.download_links (expires_at);

alter table public.download_links enable row level security;
revoke all on public.download_links from anon, authenticated;
