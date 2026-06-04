ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS require_name_positive BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS require_name_negative BOOLEAN NOT NULL DEFAULT true;
