-- =============================================
-- SMARTMENI v4 — Orders sistem
-- Pokreni u Supabase SQL Editor
-- =============================================

-- Dodaj digital_ordering toggle na restaurants
alter table restaurants
  add column if not exists digital_ordering boolean default false,
  add column if not exists table_count int default 10;

-- Narudžbe
create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  restaurant_id uuid references restaurants(id) on delete cascade,
  table_number text not null,
  status text default 'received'
    check (status in ('received','preparing','ready','served','closed')),
  note text,
  total decimal(10,2) default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Stavke narudžbe
create table if not exists order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,
  price decimal(10,2) not null,
  quantity int default 1,
  note text,
  status text default 'pending'
    check (status in ('pending','preparing','ready')),
  created_at timestamp with time zone default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at
  before update on orders
  for each row execute procedure update_updated_at();

-- =============================================
-- RLS za orders
-- =============================================

alter table orders enable row level security;
alter table order_items enable row level security;

-- Gosti mogu kreirati narudžbe (anonimno)
create policy "Gosti kreiraju narudzbe"
  on orders for insert
  with check (true);

-- Gosti mogu vidjeti svoje narudžbe (po session ili table)
create policy "Javno citanje narudzbi"
  on orders for select
  using (true);

-- Vlasnik i osoblje upravljaju narudžbama
create policy "Vlasnik upravlja narudzbama"
  on orders for update
  using (
    auth.uid() = (select user_id from restaurants where id = restaurant_id)
    or
    auth.uid() in (select user_id from staff where restaurant_id = orders.restaurant_id and is_active = true)
  );

-- Order items
create policy "Gosti kreiraju stavke"
  on order_items for insert
  with check (true);

create policy "Javno citanje stavki"
  on order_items for select
  using (true);

create policy "Osoblje upravlja stavkama"
  on order_items for update
  using (
    auth.uid() = (select user_id from restaurants where id = restaurant_id)
    or
    auth.uid() in (select user_id from staff where restaurant_id = order_items.restaurant_id and is_active = true)
  );

-- =============================================
-- REALTIME za orders
-- =============================================
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table waiter_requests;
