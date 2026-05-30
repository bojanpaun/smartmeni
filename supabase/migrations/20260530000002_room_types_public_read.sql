-- Allow anonymous users to read active room types (needed for Hotel Landing Page)
CREATE POLICY "anon_read_active_room_types"
  ON room_types
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
