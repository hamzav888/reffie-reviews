ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS share_outcome TEXT CHECK (share_outcome IN ('confirmed', 'failed'));
