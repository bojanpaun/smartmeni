-- =============================================
-- SMARTMENI baza podataka
-- Kopiraj i pokreni u Supabase SQL Editor
-- =============================================

-- Restorani
create table restaurants (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  description text,
  location text,
  phone text,
  hours text,
  logo_url text,
  color text default '#0d7a52',
  created_at timestamp with time zone default now()
);

-- Kategorije menija
create table categories (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,
  name_en text,
  icon text default '🍽️',
  sort_order int default 0,
  created_at timestamp with time zone default now()
);

-- Stavke menija
create table menu_items (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references restaurants(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  name text not null,
  name_en text,
  description text,
  description_en text,
  price decimal(10,2) not null,
  image_url text,
  emoji text default '🍽️',
  allergens text,
  calories int,
  prep_time text,
  is_visible boolean default true,
  is_special boolean default false,
  tags text[] default '{}',
  sort_order int default 0,
  created_at timestamp with time zone default now()
);

-- Zahtjevi konobara (realtime)
create table waiter_requests (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references restaurants(id) on delete cascade,
  table_number text not null,
  request_type text not null,
  status text default 'new',
  created_at timestamp with time zone default now()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table restaurants enable row level security;
alter table categories enable row level security;
alter table menu_items enable row level security;
alter table waiter_requests enable row level security;

-- Restorani: vlasnik može sve, svi mogu čitati
create policy "Restorani su javni za čitanje"
  on restaurants for select using (true);

create policy "Vlasnik upravlja restoranom"
  on restaurants for all
  using (auth.uid() = user_id);

-- Kategorije: javne za čitanje, vlasnik upravlja
create policy "Kategorije su javne"
  on categories for select using (true);

create policy "Vlasnik upravlja kategorijama"
  on categories for all
  using (
    auth.uid() = (
      select user_id from restaurants where id = restaurant_id
    )
  );

-- Stavke menija: vidljive su javne
create policy "Vidljive stavke su javne"
  on menu_items for select
  using (is_visible = true);

create policy "Vlasnik vidi sve stavke"
  on menu_items for select
  using (
    auth.uid() = (
      select user_id from restaurants where id = restaurant_id
    )
  );

create policy "Vlasnik upravlja stavkama"
  on menu_items for all
  using (
    auth.uid() = (
      select user_id from restaurants where id = restaurant_id
    )
  );

-- Zahtjevi: svi mogu kreirati, vlasnik čita
create policy "Gosti mogu slati zahtjeve"
  on waiter_requests for insert
  with check (true);

create policy "Vlasnik čita zahtjeve"
  on waiter_requests for select
  using (
    auth.uid() = (
      select user_id from restaurants where id = restaurant_id
    )
  );

create policy "Vlasnik ažurira zahtjeve"
  on waiter_requests for update
  using (
    auth.uid() = (
      select user_id from restaurants where id = restaurant_id
    )
  );

-- =============================================
-- STORAGE za slike
-- =============================================

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true);

create policy "Slike su javne"
  on storage.objects for select
  using (bucket_id = 'menu-images');

create policy "Autorizovani korisnici mogu upload"
  on storage.objects for insert
  with check (
    bucket_id = 'menu-images'
    and auth.role() = 'authenticated'
  );

create policy "Vlasnik može brisati slike"
  on storage.objects for delete
  using (
    bucket_id = 'menu-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================
-- DEMO podaci (opcionalno)
-- =============================================

-- Omogući realtime za waiter_requests
alter publication supabase_realtime add table waiter_requests;
