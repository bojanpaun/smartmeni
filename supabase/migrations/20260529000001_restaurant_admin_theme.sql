-- Dodaje admin_theme kolonu na restaurants tabelu.
-- Čuva ime palete (npr. 'green', 'blue') bez moda — mod je lična preferencija.

alter table restaurants
  add column if not exists admin_theme text not null default 'green';
