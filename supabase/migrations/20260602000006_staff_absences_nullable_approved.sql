-- staff_absences.approved: false → NULL za "na čekanju"
-- NULL = na čekanju, TRUE = odobreno, FALSE = odbijeno

ALTER TABLE staff_absences ALTER COLUMN approved DROP DEFAULT;
ALTER TABLE staff_absences ALTER COLUMN approved DROP NOT NULL;

-- Postojeće "na čekanju" zapise (approved=false) pretvaramo u NULL
UPDATE staff_absences SET approved = NULL WHERE approved = false;
