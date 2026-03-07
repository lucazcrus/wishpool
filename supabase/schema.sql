create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  price_alert boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  price numeric(12, 2) not null default 0 check (price >= 0),
  url text not null,
  image text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.link_price_history (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  price numeric(12, 2) not null check (price >= 0),
  source text not null default 'manual',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.link_events (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'updated', 'deleted', 'visited')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_price numeric(12, 2) not null check (previous_price >= 0),
  current_price numeric(12, 2) not null check (current_price >= 0),
  drop_amount numeric(12, 2) not null check (drop_amount >= 0),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_links_user_id on public.links(user_id);
create index if not exists idx_links_user_id_category on public.links(user_id, category);
create index if not exists idx_link_price_history_user_id on public.link_price_history(user_id);
create index if not exists idx_link_price_history_link_id on public.link_price_history(link_id);
create index if not exists idx_link_events_user_id on public.link_events(user_id);
create index if not exists idx_link_events_link_id on public.link_events(link_id);
create index if not exists idx_price_alerts_user_id on public.price_alerts(user_id);
create index if not exists idx_price_alerts_link_id on public.price_alerts(link_id);

-- Keep updated_at columns in sync

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

drop trigger if exists links_set_updated_at on public.links;
create trigger links_set_updated_at
before update on public.links
for each row
execute function public.set_updated_at();

-- Auto-create profile + default preferences when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  insert into public.user_preferences (user_id, price_alert)
  values (new.id, false)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.categories enable row level security;
alter table public.links enable row level security;
alter table public.link_price_history enable row level security;
alter table public.link_events enable row level security;
alter table public.price_alerts enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own
on public.user_preferences
for select
using (auth.uid() = user_id);

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own
on public.user_preferences
for insert
with check (auth.uid() = user_id);

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own
on public.user_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists categories_all_own on public.categories;
create policy categories_all_own
on public.categories
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists links_all_own on public.links;
create policy links_all_own
on public.links
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists link_price_history_all_own on public.link_price_history;
create policy link_price_history_all_own
on public.link_price_history
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists link_events_all_own on public.link_events;
create policy link_events_all_own
on public.link_events
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists price_alerts_all_own on public.price_alerts;
create policy price_alerts_all_own
on public.price_alerts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
