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
  optional_fields JSONB NOT NULL DEFAULT '{"name": true, "tour_guide": false, "unit_type": false}'
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
  honeypot TEXT
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

-- Only authenticated users can modify properties
CREATE POLICY "Authenticated users can manage properties"
  ON properties FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Reviews can be inserted by anyone (public form)
-- but only through the API (service role), not directly
CREATE POLICY "Service role can manage reviews"
  ON reviews FOR ALL
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read all reviews
CREATE POLICY "Authenticated users can read reviews"
  ON reviews FOR SELECT
  USING (auth.role() = 'authenticated');
