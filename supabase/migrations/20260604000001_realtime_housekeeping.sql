-- Dodaj housekeeping_tasks i maintenance_requests u supabase_realtime publikaciju
-- Bez ovoga postgres_changes subscriptions ne primaju events ni za admin ni za staff portal.
-- REPLICA IDENTITY FULL je već postavljen (20260603000003), ovo je drugi obavezni uslov.

ALTER PUBLICATION supabase_realtime ADD TABLE housekeeping_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_requests;
