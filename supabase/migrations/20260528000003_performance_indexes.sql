-- Performance indexes for high-traffic queries

-- Guests module
create index if not exists idx_guests_restaurant on guests(restaurant_id);
create index if not exists idx_guest_visits_guest on guest_visits(guest_id);
create index if not exists idx_guest_visits_restaurant on guest_visits(restaurant_id);

-- Orders
create index if not exists idx_orders_restaurant on orders(restaurant_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_table_number on orders(table_number);
create index if not exists idx_order_items_order on order_items(order_id);

-- Inventory
create index if not exists idx_inventory_items_restaurant on inventory_items(restaurant_id);
create index if not exists idx_inventory_movements_restaurant on inventory_movements(restaurant_id);
create index if not exists idx_inventory_movements_created on inventory_movements(created_at desc);

-- Staff / HR
create index if not exists idx_staff_restaurant on staff(restaurant_id);
create index if not exists idx_attendance_staff on attendance(staff_id);
create index if not exists idx_attendance_entries_staff on attendance_entries(staff_id);

-- Reservations
create index if not exists idx_reservations_restaurant on reservations(restaurant_id);
create index if not exists idx_reservations_date on reservations(date);

-- Menu
create index if not exists idx_menu_items_restaurant on menu_items(restaurant_id);
create index if not exists idx_categories_restaurant on categories(restaurant_id);
