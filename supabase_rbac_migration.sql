-- =============================================
-- SMARTMENI v2 — RBAC migracija
-- Pokreni u Supabase SQL Editor
-- =============================================

-- Profili korisnika (superadmin flag)
create table if not exists user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  is_superadmin boolean default false,
  full_name text,
  created_at timestamp with time zone default now()
);

-- Auto-kreiraj profil pri registraciji
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Role (definisane od vlasnika po restoranu)
create table if not exists roles (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,
  permissions text[] default '{}',
  created_at timestamp with time zone default now()
);

-- Osoblje (zaposleni sa rolama)
create table if not exists staff (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references restaurants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role_id uuid references roles(id) on delete set null,
  email text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  unique(restaurant_id, user_id)
);

-- Pozivnice za osoblje
create table if not exists staff_invites (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references restaurants(id) on delete cascade,
  role_id uuid references roles(id) on delete set null,
  email text not null,
  token text unique default gen_random_uuid()::text,
  accepted boolean default false,
  created_at timestamp with time zone default now()
);

-- =============================================
-- RLS za nove tabele
-- =============================================

alter table user_profiles enable row level security;
alter table roles enable row level security;
alter table staff enable row level security;
alter table staff_invites enable row level security;

-- user_profiles: korisnik vidi samo svoj profil
create policy "Korisnik vidi svoj profil"
  on user_profiles for select using (auth.uid() = id);

create policy "Korisnik ažurira svoj profil"
  on user_profiles for update using (auth.uid() = id);

-- roles: vlasnik kreira i upravlja rolama svog restorana
create policy "Role su vidljive u restoranu"
  on roles for select
  using (
    auth.uid() = (select user_id from restaurants where id = restaurant_id)
    or
    auth.uid() in (select user_id from staff where restaurant_id = roles.restaurant_id)
  );

create policy "Vlasnik upravlja rolama"
  on roles for all
  using (auth.uid() = (select user_id from restaurants where id = restaurant_id));

-- staff: vlasnik i osoblje vide osoblje svog restorana
create policy "Vlasnik vidi osoblje"
  on staff for select
  using (auth.uid() = (select user_id from restaurants where id = restaurant_id));

create policy "Osoblje vidi sebe"
  on staff for select
  using (auth.uid() = user_id);

create policy "Vlasnik upravlja osobljem"
  on staff for all
  using (auth.uid() = (select user_id from restaurants where id = restaurant_id));

-- staff_invites
create policy "Vlasnik vidi pozivnice"
  on staff_invites for select
  using (auth.uid() = (select user_id from restaurants where id = restaurant_id));

create policy "Vlasnik kreira pozivnice"
  on staff_invites for insert
  with check (auth.uid() = (select user_id from restaurants where id = restaurant_id));
