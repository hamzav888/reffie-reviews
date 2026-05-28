import { z } from "zod";

// Step 1: Star rating tap (creates partial review)
export const createPartialReviewSchema = z.object({
  property_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  honeypot: z.string().max(0).optional(), // must be empty
});

// Step 2: Complete the review (updates partial record)
export const completeReviewSchema = z.object({
  review_id: z.string().uuid(),
  comment: z.string().trim().max(1000).optional().default(""),
  reviewer_name: z.string().trim().max(100).optional().default(""),
  tour_guide: z.string().trim().max(100).optional().default(""),
  unit_type: z.string().trim().max(100).optional().default(""),
  ai_generated_comment: z.string().trim().max(1000).optional().default(""),
});

// Update Google tracking fields
export const updateGoogleStatusSchema = z.object({
  review_id: z.string().uuid(),
  google_prompt_shown: z.boolean().optional(),
  google_clicked: z.boolean().optional(),
  google_comment_copied: z.string().trim().max(1000).optional(),
  redirected_to_google: z.boolean().optional(),
});

// AI review generation request
export const generateReviewSchema = z.object({
  rating: z.number().int().min(4).max(5),
});

// Property types
export interface Property {
  id: string;
  created_at: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  google_review_url: string;
  review_prompt: string;
  negative_prompt: string;
  optional_fields: {
    name: boolean;
    tour_guide: boolean;
    unit_type: boolean;
  };
  review_flow_enabled: boolean;
}

export interface Review {
  id: string;
  created_at: string;
  property_id: string;
  stage: string;
  rating: number;
  comment: string | null;
  ai_generated_comment: string | null;
  reviewer_name: string | null;
  tour_guide: string | null;
  unit_type: string | null;
  redirected_to_google: boolean;
  google_prompt_shown: boolean;
  google_clicked: boolean;
  google_comment_copied: string | null;
  is_complete: boolean;
}
