ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS name_requirement TEXT NOT NULL DEFAULT 'required_all'
  CHECK (name_requirement IN ('required_all','required_positive','required_negative','optional_all','hidden'));

UPDATE properties SET name_requirement = CASE
  WHEN require_name_positive AND require_name_negative     THEN 'required_all'
  WHEN require_name_positive AND NOT require_name_negative THEN 'required_positive'
  WHEN NOT require_name_positive AND require_name_negative THEN 'required_negative'
  ELSE 'optional_all'
END;

ALTER TABLE properties DROP COLUMN IF EXISTS require_name_positive;
ALTER TABLE properties DROP COLUMN IF EXISTS require_name_negative;
