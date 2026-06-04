-- Reffie Reviews Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROPERTIES TABLE
-- ============================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  brand_color TEXT NOT NULL DEFAULT '#10BD91',
  google_review_url TEXT NOT NULL,
  review_prompt TEXT NOT NULL DEFAULT 'What did you enjoy most about your tour?',
  negative_prompt TEXT NOT NULL DEFAULT 'What could we do better?',
  optional_fields JSONB NOT NULL DEFAULT '{"name": true, "tour_guide": false, "unit_type": false}',
  review_flow_enabled BOOLEAN NOT NULL DEFAULT true,
  name_requirement TEXT NOT NULL DEFAULT 'required_all'
    CHECK (name_requirement IN ('required_all','required_positive','required_negative','optional_all','hidden'))
);

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'tour',
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  ai_generated_comment TEXT,
  reviewer_name TEXT,
  tour_guide TEXT,
  unit_type TEXT,
  redirected_to_google BOOLEAN NOT NULL DEFAULT false,
  google_prompt_shown BOOLEAN NOT NULL DEFAULT false,
  google_clicked BOOLEAN NOT NULL DEFAULT false,
  google_comment_copied TEXT,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  honeypot TEXT,
  share_outcome TEXT CHECK (share_outcome IN ('confirmed', 'failed'))
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX reviews_property_id_idx ON reviews(property_id);
CREATE INDEX reviews_created_at_idx ON reviews(created_at DESC);
CREATE INDEX reviews_rating_idx ON reviews(rating);
CREATE INDEX properties_slug_idx ON properties(slug);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public can read properties by slug (needed for review form)
CREATE POLICY "Public can read properties"
  ON properties FOR SELECT
  USING (true);

-- Authenticated users can create new properties
CREATE POLICY "Authenticated users can insert properties"
  ON properties FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Assigned managers OR @reffie.me super admins can update a property
CREATE POLICY "Managers and super admins can update properties"
  ON properties FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM property_managers
      WHERE property_managers.property_id = properties.id
        AND property_managers.user_id = auth.uid()
    )
    OR (auth.jwt() ->> 'email') ILIKE '%@reffie.me'
  );

-- Assigned managers OR @reffie.me super admins can delete a property
CREATE POLICY "Managers and super admins can delete properties"
  ON properties FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM property_managers
      WHERE property_managers.property_id = properties.id
        AND property_managers.user_id = auth.uid()
    )
    OR (auth.jwt() ->> 'email') ILIKE '%@reffie.me'
  );

-- Reviews can be inserted by anyone (public form)
-- but only through the API (service role), not directly
CREATE POLICY "Service role can manage reviews"
  ON reviews FOR ALL
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read reviews for properties they manage
CREATE POLICY "Authenticated users can read reviews"
  ON reviews FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- PROPERTY MANAGERS TABLE
-- ============================================
CREATE TABLE property_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);

CREATE INDEX property_managers_user_id_idx ON property_managers(user_id);
CREATE INDEX property_managers_property_id_idx ON property_managers(property_id);

ALTER TABLE property_managers ENABLE ROW LEVEL SECURITY;

-- Users can only see their own manager rows
CREATE POLICY "Users can read own manager rows"
  ON property_managers FOR SELECT
  USING (user_id = auth.uid());

-- Users can only insert rows for themselves
CREATE POLICY "Users can insert own manager rows"
  ON property_managers FOR INSERT
  WITH CHECK (user_id = auth.uid());
