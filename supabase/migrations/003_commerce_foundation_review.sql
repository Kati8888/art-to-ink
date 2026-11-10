-- ART TO INK commerce foundation
-- MANUAL REVIEW ONLY: do not apply automatically.
-- Additive migration. It does not drop, rewrite, reprice, or delete existing data.
-- Review against the live schema before applying.

create extension if not exists pgcrypto;

-- Link existing orders to authenticated customers without changing existing rows.
alter table if exists public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;
alter table if exists public.orders add column if not exists stripe_payment_intent_id text;
alter table if exists public.orders add column if not exists refunded_at timestamptz;
alter table if exists public.orders add column if not exists refund_amount bigint;
create index if not exists orders_customer_id_idx on public.orders(customer_id);

-- Preserve the existing lifecycle values and add the explicit refunded state.
do $order_status$
begin
  if exists (select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_fulfillment_status_check') then
    alter table public.orders drop constraint orders_fulfillment_status_check;
  end if;
  alter table public.orders add constraint orders_fulfillment_status_check
    check (fulfillment_status in ('processing','fulfilled','license_active','failed','refunded'));
end;
$order_status$;

create unique index if not exists orders_stripe_payment_intent_uidx
  on public.orders(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table if not exists public.commerce_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  preview_image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  variant_key text not null,
  label text not null,
  price_cents bigint not null check (price_cents >= 0),
  currency text not null default 'eur',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, variant_key)
);

create table if not exists public.commerce_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  variant_id uuid references public.commerce_variants(id) on delete cascade,
  artwork_format text not null check (artwork_format in ('colour', 'blackAndWhite')),
  storage_object_path text not null unique,
  preview_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(product_id, variant_id, artwork_format)
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references auth.users(id) on delete cascade,
  currency text not null default 'eur',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid references public.commerce_products(id) on delete restrict,
  variant_id uuid references public.commerce_variants(id) on delete restrict,
  asset_id uuid references public.commerce_assets(id) on delete restrict,
  license_package_id uuid,
  quantity integer not null check (quantity > 0 and quantity <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((product_id is not null and variant_id is not null and asset_id is not null and license_package_id is null)
      or (product_id is null and variant_id is null and asset_id is null and license_package_id is not null))
);
create unique index if not exists cart_items_artwork_uidx
  on public.cart_items(cart_id, product_id, variant_id, asset_id)
  where license_package_id is null;
create unique index if not exists cart_items_license_uidx
  on public.cart_items(cart_id, license_package_id)
  where license_package_id is not null;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.commerce_products(id) on delete set null,
  variant_id uuid references public.commerce_variants(id) on delete set null,
  asset_id uuid references public.commerce_assets(id) on delete set null,
  license_package_id uuid,
  quantity integer not null check (quantity > 0),
  unit_amount bigint not null check (unit_amount >= 0),
  currency text not null,
  title_snapshot text not null,
  variant_snapshot text,
  artwork_format_snapshot text,
  storage_object_path_snapshot text,
  created_at timestamptz not null default now()
);

create unique index if not exists order_items_order_item_uidx
  on public.order_items (order_id, product_id, variant_id, license_package_id, artwork_format_snapshot) nulls not distinct;

create table if not exists public.stripe_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.license_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  price_cents bigint not null check (price_cents >= 0),
  currency text not null default 'eur',
  credit_limit integer,
  catalogue_scope text not null default 'selected',
  validity_months integer not null default 12 check (validity_months > 0),
  active boolean not null default true,
  stripe_price_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $constraints$
begin
  if not exists (select 1 from pg_constraint where conname='cart_items_license_package_fk' and conrelid='public.cart_items'::regclass) then
    alter table public.cart_items add constraint cart_items_license_package_fk
      foreign key (license_package_id) references public.license_packages(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='order_items_license_package_fk' and conrelid='public.order_items'::regclass) then
    alter table public.order_items add constraint order_items_license_package_fk
      foreign key (license_package_id) references public.license_packages(id) on delete set null;
  end if;
end;
$constraints$;

create table if not exists public.customer_licenses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  customer_email text not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  license_package_id uuid not null references public.license_packages(id) on delete restrict,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  purchased_credits integer,
  used_credits integer not null default 0 check (used_credits >= 0),
  status text not null default 'active' check (status in ('active', 'expired', 'refunded', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (purchased_credits is null or used_credits <= purchased_credits)
);
create index if not exists customer_licenses_customer_idx on public.customer_licenses(customer_id, status, expires_at);
create unique index if not exists customer_licenses_order_package_uidx on public.customer_licenses(order_id, license_package_id);

create table if not exists public.license_usage (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.customer_licenses(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  asset_id uuid not null references public.commerce_assets(id) on delete restrict,
  design_id text not null,
  credits integer not null default 1 check (credits > 0),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists license_usage_license_idx on public.license_usage(license_id, created_at desc);

create table if not exists public.download_entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  license_usage_id uuid references public.license_usage(id) on delete restrict,
  asset_id uuid not null references public.commerce_assets(id) on delete restrict,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (order_id is not null or license_usage_id is not null)
);
create index if not exists download_entitlements_customer_idx on public.download_entitlements(customer_id, expires_at);

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_key text not null unique,
  customer_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  email_type text not null,
  recipient_email text not null,
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

-- Customer read access is limited to records owned by the authenticated user.
alter table public.commerce_products enable row level security;
alter table public.commerce_variants enable row level security;
alter table public.commerce_assets enable row level security;
alter table public.license_packages enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.order_items enable row level security;
alter table public.customer_licenses enable row level security;
alter table public.license_usage enable row level security;
alter table public.download_entitlements enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.stripe_events enable row level security;

revoke all on public.stripe_events from anon, authenticated;
revoke all on public.email_deliveries from anon, authenticated;

-- Policies are named and guarded so the migration can be reviewed/applied repeatedly.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own') then
    create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
  end if;
  -- No row-level UPDATE policy is created for profiles: column grants below allow
  -- customers to edit only display_name and phone, never is_admin.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commerce_products' and policyname='products_public_read') then
    create policy products_public_read on public.commerce_products for select using (active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commerce_variants' and policyname='variants_public_read') then
    create policy variants_public_read on public.commerce_variants for select using (active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='commerce_assets' and policyname='assets_public_preview_read') then
    create policy assets_public_preview_read on public.commerce_assets for select using (active = true and preview_url is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='license_packages' and policyname='license_packages_public_read') then
    create policy license_packages_public_read on public.license_packages for select using (active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='carts' and policyname='carts_own_all') then
    create policy carts_own_all on public.carts for all using (auth.uid() = customer_id) with check (auth.uid() = customer_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cart_items' and policyname='cart_items_own_all') then
    create policy cart_items_own_all on public.cart_items for all using (exists (select 1 from public.carts c where c.id = cart_id and c.customer_id = auth.uid())) with check (exists (select 1 from public.carts c where c.id = cart_id and c.customer_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_own_read') then
    create policy orders_own_read on public.orders for select using (customer_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='order_items' and policyname='order_items_own_read') then
    create policy order_items_own_read on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='customer_licenses' and policyname='licenses_own_read') then
    create policy licenses_own_read on public.customer_licenses for select using (customer_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='license_usage' and policyname='license_usage_own_read') then
    create policy license_usage_own_read on public.license_usage for select using (customer_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='download_entitlements' and policyname='entitlements_own_read') then
    create policy entitlements_own_read on public.download_entitlements for select using (customer_id = auth.uid() and revoked_at is null and expires_at > now());
  end if;
end $$;

-- Signup profile creation. This only inserts a missing profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

do $trigger$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'art_to_ink_on_auth_user_created' and not tgisinternal) then
    create trigger art_to_ink_on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
  end if;
end;
$trigger$;

-- Atomic licence activation. Application code must call this only after verifying the
-- authenticated user and the requested asset; this function enforces ownership,
-- expiry, available credits, and replay protection inside one transaction.
create or replace function public.activate_license(
  p_license_id uuid,
  p_asset_id uuid,
  p_design_id text,
  p_idempotency_key text,
  p_entitlement_expires_at timestamptz
)
returns table (usage_id uuid, entitlement_id uuid, remaining_credits integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_license public.customer_licenses%rowtype;
  v_usage_id uuid;
  v_entitlement_id uuid;
  v_remaining integer;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 16 then raise exception 'invalid_idempotency_key' using errcode = '22023'; end if;

  select * into v_license
  from public.customer_licenses
  where id = p_license_id and customer_id = v_user_id
  for update;
  if not found or v_license.status <> 'active' or v_license.expires_at <= now() then raise exception 'license_not_active' using errcode = 'P0001'; end if;
  -- Idempotency replay is scoped to the authenticated owner and exact licence.
  if exists (select 1 from public.license_usage where idempotency_key = p_idempotency_key) then
    select lu.id, de.id,
      case when v_license.purchased_credits is null then null else v_license.purchased_credits - v_license.used_credits end
    into usage_id, entitlement_id, remaining_credits
    from public.license_usage lu
    left join public.download_entitlements de on de.license_usage_id = lu.id
    where lu.idempotency_key = p_idempotency_key
      and lu.customer_id = v_user_id
      and lu.license_id = p_license_id
      and lu.asset_id = p_asset_id
      and lu.design_id = p_design_id;
    if not found then raise exception 'idempotency_key_conflict' using errcode = '23505'; end if;
    return next;
    return;
  end if;

  if v_license.purchased_credits is null then raise exception 'license_credit_limit_not_configured' using errcode = 'P0001'; end if;
  if v_license.purchased_credits is not null and v_license.used_credits >= v_license.purchased_credits then raise exception 'license_credits_exhausted' using errcode = 'P0001'; end if;

  -- Never trust asset/design identifiers supplied by the browser.
  if not exists (
    select 1
    from public.commerce_assets a
    join public.commerce_products p on p.id = a.product_id
    where a.id = p_asset_id
      and a.active = true
      and p.active = true
      and p.slug = p_design_id
      and (a.variant_id is null or exists (
        select 1 from public.commerce_variants v
        where v.id = a.variant_id and v.product_id = p.id and v.active = true
      ))
  ) then
    raise exception 'asset_not_available_for_design' using errcode = 'P0001';
  end if;

  insert into public.license_usage (license_id, customer_id, asset_id, design_id, idempotency_key)
  values (p_license_id, v_user_id, p_asset_id, p_design_id, p_idempotency_key)
  returning id into v_usage_id;

  update public.customer_licenses
  set used_credits = used_credits + 1, updated_at = now()
  where id = p_license_id;

  insert into public.download_entitlements (customer_id, license_usage_id, asset_id, expires_at)
  values (v_user_id, v_usage_id, p_asset_id, least(coalesce(p_entitlement_expires_at, v_license.expires_at), v_license.expires_at))
  returning id into v_entitlement_id;

  v_remaining := case when v_license.purchased_credits is null then null else v_license.purchased_credits - v_license.used_credits - 1 end;
  usage_id := v_usage_id;
  entitlement_id := v_entitlement_id;
  remaining_credits := v_remaining;
  return next;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.activate_license(uuid, uuid, text, text, timestamptz) from public, anon;
grant execute on function public.activate_license(uuid, uuid, text, text, timestamptz) to authenticated;

-- Explicit client grants. RLS remains the row-level boundary; sensitive writes stay server-only.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, phone) on public.profiles to authenticated;

grant select on public.commerce_products, public.commerce_variants, public.license_packages to anon, authenticated;
revoke all on public.commerce_assets from anon, authenticated;
grant select, insert, update, delete on public.carts, public.cart_items to authenticated;
grant select on public.orders, public.order_items, public.customer_licenses, public.license_usage, public.download_entitlements to authenticated;
revoke all on public.stripe_events, public.email_deliveries from anon, authenticated;
revoke all on public.download_links from anon, authenticated;

-- Catalogue records mirror the current public catalogue. Secure asset rows are
-- intentionally NOT seeded until matching original files have been uploaded to
-- the private Storage bucket and verified.
insert into public.commerce_products (slug, title, description)
values
  ('brain-heart', 'Brain Heart', 'Original tattoo artwork by Kateřina Pohnetalová.'),
  ('mrs-beer', 'MRS Beer', 'Original tattoo artwork by Kateřina Pohnetalová.'),
  ('sea-dragons', 'Assimilation', 'Original tattoo artwork by Kateřina Pohnetalová.'),
  ('lion-heart', 'Lion Heart', 'Original tattoo artwork by Kateřina Pohnetalová.'),
  ('babicka-dedo', 'Grandparents — Babicka & Dedo', 'Original tattoo artwork by Kateřina Pohnetalová.'),
  ('faces-within', 'Faces Within', 'Original tattoo artwork by Kateřina Pohnetalová.'),
  ('goodbye-london', 'Goodbye London', 'Original tattoo artwork by Kateřina Pohnetalová.'),
  ('war-inside', 'War Inside', 'Original tattoo artwork by Kateřina Pohnetalová.')
on conflict (slug) do nothing;

insert into public.commerce_variants (product_id, variant_key, label, price_cents, currency)
select p.id, v.variant_key, v.label, v.price_cents, 'eur'
from public.commerce_products p
cross join (values
  ('mini', 'Mini — 1,200 px', 900),
  ('small', 'Small — 2,000 px', 1900),
  ('detailed', 'Detailed — 3,200 px', 3900),
  ('premium', 'Premium — 4,000 px', 7900),
  ('collection', 'Complete Size Collection', 14900)
) as v(variant_key, label, price_cents)
where p.slug in ('brain-heart','mrs-beer','sea-dragons','lion-heart','babicka-dedo','faces-within','goodbye-london','war-inside')
on conflict (product_id, variant_key) do nothing;

-- Defaults are intentionally inserts-only. Existing package rows are never changed.
insert into public.license_packages (code, title, description, price_cents, credit_limit, catalogue_scope)
values
  ('starter', 'STARTER', 'For occasional commercial tattoo use.', 24900, 5, 'selected'),
  ('professional', 'PROFESSIONAL', 'For established artists using a broader catalogue.', 49900, 20, 'selected'),
  ('studio', 'STUDIO', 'For studio-wide catalogue access.', 150000, null, 'catalogue')
on conflict (code) do nothing;
