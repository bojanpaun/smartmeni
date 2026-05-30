-- Faza Y: Customizabilni sajtovi — landing_pages tabela

CREATE TABLE IF NOT EXISTS landing_pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  page_type       TEXT NOT NULL CHECK (page_type IN ('hotel', 'restaurant')),
  blocks          JSONB DEFAULT '[]',
  seo_title       TEXT,
  seo_description TEXT,
  custom_domain   TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (restaurant_id, page_type)
);

ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for public landing pages)
CREATE POLICY "public_read_landing_pages"
  ON landing_pages FOR SELECT
  TO anon, authenticated
  USING (true);

-- Tenant staff and owners can manage their landing pages
CREATE POLICY "tenant_insert_landing_pages"
  ON landing_pages FOR INSERT
  TO authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
      UNION
      SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_update_landing_pages"
  ON landing_pages FOR UPDATE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
      UNION
      SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
      UNION
      SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_delete_landing_pages"
  ON landing_pages FOR DELETE
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
      UNION
      SELECT restaurant_id FROM staff WHERE user_id = auth.uid()
    )
  );
