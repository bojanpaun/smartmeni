-- Dodaj preostale tabele u supabase_realtime publikaciju i postavi REPLICA IDENTITY FULL.
-- Preduslov za postgres_changes subscriptions u ReceptionView, SpaView, useRooms,
-- FrontDeskPage (guest_requests) i useReservationCounts.

ALTER TABLE hotel_reservations  REPLICA IDENTITY FULL;
ALTER TABLE rooms               REPLICA IDENTITY FULL;
ALTER TABLE spa_appointments    REPLICA IDENTITY FULL;
ALTER TABLE guest_requests      REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE hotel_reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE spa_appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE guest_requests;
