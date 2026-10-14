create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text not null unique,
  stripe_customer_id text,
  customer_email text not null,
  customer_name text,
  purchase_type text not null check (purchase_type in ('design','license')),
  product_slug text,
  variant text check (variant is null or variant in ('mini','small','detailed','premium')),
  license_id text,
  amount_total bigint,
  currency text,
  intended_use text,
  intended_use_confirmed boolean not null default false,
  placement_note text,
  download_object_path text,
  download_token_hash text unique,
  download_expires_at timestamptz,
  fulfillment_status text not null default 'processing' check (fulfillment_status in ('processing','fulfilled','license_active','failed')),
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_delivery_fields check (
    (purchase_type = 'license') or (product_slug is not null and variant is not null)
  )
);

create index if not exists orders_customer_email_idx on public.orders (customer_email);
create index if not exists orders_download_expiry_idx on public.orders (download_expires_at) where download_token_hash is not null;
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;

-- Create a private Storage bucket named by SUPABASE_DOWNLOAD_BUCKET (recommended: tattoo-downloads).
-- Store original, transparent PNG/TIFF files here; never enable public access for this bucket.
