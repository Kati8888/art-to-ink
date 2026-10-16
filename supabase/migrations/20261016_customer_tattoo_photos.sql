create table if not exists public.customer_tattoo_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  display_name text,
  caption text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.customer_tattoo_photos enable row level security;
-- No anon/authenticated table policies: only the server using the service-role key can read or write submissions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-photos','customer-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=array['image/jpeg','image/png','image/webp'];
