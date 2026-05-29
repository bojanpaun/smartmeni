ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS show_booking_button  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS booking_checkin_time  TEXT DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS booking_checkout_time TEXT DEFAULT '11:00',
  ADD COLUMN IF NOT EXISTS booking_page_title    TEXT,
  ADD COLUMN IF NOT EXISTS booking_page_desc     TEXT;
