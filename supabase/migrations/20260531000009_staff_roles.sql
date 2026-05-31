-- ================================================================
-- Faza Z: staff_roles junction tabela (više rola po zaposleniku)
-- ================================================================

CREATE TABLE IF NOT EXISTS staff_roles (
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role_id  UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_roles_staff ON staff_roles(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_roles_role  ON staff_roles(role_id);

-- Popuni iz postojećeg staff.role_id (ne gubi se historija)
INSERT INTO staff_roles (staff_id, role_id)
SELECT id, role_id
FROM staff
WHERE role_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manages_staff_roles" ON staff_roles FOR ALL
  USING (
    staff_id IN (
      SELECT id FROM staff
      WHERE restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "staff_reads_own_roles" ON staff_roles FOR SELECT
  USING (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));
