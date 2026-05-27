# Reffie Reviews — Project Handoff Document

## What is Reffie Reviews?

A review collection tool for property management companies. Renters take tours, receive a link, rate their experience, and if they rate 4-5 stars, they're guided to post a Google Review with an AI-generated comment auto-copied to their clipboard. Negative reviews (1-3 stars) stay internal.

**Branded as:** Reffie Reviews (our product, not white-labeled)
**Goal:** Maximize Google review conversion rate for property managers.

---

## Current Status

**Working locally at** `C:\Projects\PMHappy`
**Run with:** `npm run dev` → `http://localhost:3000`

### What's built and working:
- Renter flow: star rating → review form → Google prompt → thank you
- Star ratings captured immediately on tap (partial reviews saved to DB)
- Comments and reviewer names saving correctly
- Google redirect with clipboard auto-copy
- Admin login (Supabase Auth)
- Admin dashboard with stats cards and review table
- Admin settings page (property name, slug, logo, brand color, Google Place ID, optional fields, prompts)
- Shareable review link with copy button
- Honeypot anti-spam on the renter form
- Rate limiting on the reviews API (in-memory, per IP)

### What's NOT built yet:
- Review comment pool (pre-written reviews to replace AI generation — see below)
- Vercel deployment
- Mobile testing
- Session persistence for renter flow (reviewId, step, rating — low priority, pre-launch)

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Hosting:** Vercel (not yet deployed)
- **Database:** Supabase (Postgres) — project exists, schema deployed
- **Auth:** Supabase Auth (admin only)
- **Styling:** Tailwind CSS
- **Validation:** Zod

---

## Review Comment Pool

Positive reviewers (4-5 stars) are shown a pre-written comment pre-filled in an editable textarea. This comment is picked at random from a static pool of human-quality reviews stored in `lib/review-pool.ts`. The renter can edit or replace it before submitting.

**Why a pool instead of AI generation at runtime:**
- Instant — no API call, no spinner, comment appears immediately on screen
- No cost, no API key, no failure modes
- Quality is fully controlled — every review in the pool is human-approved

**How the pool was created:**
- AI (Claude) was used to generate the pool in bulk, offline, as a one-time task
- Each generated review was reviewed and curated for tone, naturalness, and variety
- The pool lives in the codebase as a static array — no external dependency at runtime

**Pool structure (`lib/review-pool.ts`):**
- Two buckets: `fourStarReviews` (~50 reviews) and `fiveStarReviews` (~50 reviews)
- 4-star reviews: warm but measured tone, may hint at minor things to improve
- 5-star reviews: enthusiastic but not over-the-top, specific to apartment touring
- All reviews are generic enough to fit any property (no property name, no specific amenities)
- Varied phrasing, length (1-3 sentences), and focus (staff, unit, neighborhood, process)
- No duplicate or near-duplicate phrasing across the pool

**At runtime:**
- When a renter taps 4-5 stars, `POST /api/generate-review` picks a random comment from the matching bucket
- The comment is pre-filled in the textarea — renter can edit freely before submitting
- What they actually submit is stored in `reviews.comment`; the original pool comment is stored in `reviews.ai_generated_comment` for comparison

**Maintenance:**
- To add or improve reviews, edit `lib/review-pool.ts` and redeploy
- Google's spam detection watches for identical reviews from the same property — the pool size (100) plus renter edits provides enough variation at V1 volumes; monitor if a property scales to high traffic

---

## Google Review URL Setup

The "Share on Google" flow depends on a correctly formatted Google Review URL. The admin must configure this in Settings.

**URL format:**
```
https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID
```

**How it works:**
- The admin enters their Google Place ID in the admin settings page
- The app constructs the full review URL from the Place ID
- When a renter gives a 4-5 star review, they're shown the "Share on Google" screen
- The AI-generated comment is copied to clipboard and the renter is redirected to the Google review page

**Finding the Place ID:**
- The admin can look up their Place ID at: https://developers.google.com/maps/documentation/places/web-service/place-id
- Place IDs look like: `ChIJN1t_tDeuEmsRUsoyG83frY4`
- The admin settings UI links directly to the Place ID Finder tool

**Storage:**
- The full constructed URL is stored in `properties.google_review_url` (TEXT NOT NULL)
- The settings page extracts/reconstructs the Place ID for display
- The renter flow uses the stored URL as-is for the redirect

---

## Database Schema (Supabase)

### `properties` table
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | auto-generated |
| created_at | TIMESTAMPTZ | default now() |
| name | TEXT NOT NULL | e.g. "Sunrise Apartments" |
| slug | TEXT NOT NULL UNIQUE | URL-friendly, e.g. "sunrise-apartments" |
| logo_url | TEXT (nullable) | |
| brand_color | TEXT NOT NULL | default "#2563EB" |
| google_review_url | TEXT NOT NULL | constructed from Place ID |
| review_prompt | TEXT NOT NULL | default "What did you enjoy most about your tour?" |
| negative_prompt | TEXT NOT NULL | default "What could we do better?" |
| optional_fields | JSONB NOT NULL | `{ name: bool, tour_guide: bool, unit_type: bool }` |

### `reviews` table
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | auto-generated |
| created_at | TIMESTAMPTZ | default now() |
| property_id | UUID (FK) | references properties, ON DELETE CASCADE |
| stage | TEXT NOT NULL | "tour" (v1) or "tenant" (future), default "tour" |
| rating | INT NOT NULL | 1-5 (CHECK constraint) |
| comment | TEXT (nullable) | renter's comment |
| ai_generated_comment | TEXT (nullable) | the AI-generated version |
| reviewer_name | TEXT (nullable) | optional |
| tour_guide | TEXT (nullable) | optional |
| unit_type | TEXT (nullable) | optional |
| redirected_to_google | BOOLEAN | default false |
| google_prompt_shown | BOOLEAN | default false |
| google_clicked | BOOLEAN | default false |
| google_comment_copied | TEXT (nullable) | what was copied to clipboard |
| is_complete | BOOLEAN | default false |
| honeypot | TEXT (nullable) | spam detection field |

### Indexes
- `reviews_property_id_idx` — reviews(property_id)
- `reviews_created_at_idx` — reviews(created_at DESC)
- `reviews_rating_idx` — reviews(rating)
- `properties_slug_idx` — properties(slug)

### Row Level Security
- Properties: public read, authenticated users can manage
- Reviews: service role can manage (public inserts go through API), authenticated users can read

---

## Pages & Routes

### Public (Renter-Facing)
- **`/r/[slug]`** — Review flow page (mobile-first, single-page component)
  - Step 1: Star rating (one tap)
  - Step 2a (4-5 stars): AI-generated comment shown, editable → submit
  - Step 2b (1-3 stars): Empty comment field + optional fields → submit
  - Step 3 (4-5 stars only): Google prompt with auto-copy + redirect
  - Step 4: Thank you screen

### Admin (Dashboard)
- **`/admin`** — Login page (Supabase Auth)
- **`/admin/dashboard`** — Property overview, review stats, shareable link
- **`/admin/reviews`** — Review log with filters (rating, date)
- **`/admin/settings`** — Property settings (name, slug, logo, brand color, Google Place ID, optional fields, prompts)

---

## API Routes

### `POST /api/reviews`
- **Step 1 (star tap):** Creates a partial record with just property_id, rating, stage. Returns the review ID.
- **Step 2 (form submit):** Updates the existing record with comment, name, tour guide, etc. Uses PATCH semantics on the returned review ID.
- **Google tracking:** Updates google_prompt_shown, google_clicked, redirected_to_google, google_comment_copied fields.
- This two-step approach ensures we capture the star rating even if the renter drops off.
- Includes honeypot spam check and in-memory rate limiting.

### `POST /api/generate-review`
- Receives: star rating
- Picks a random comment from the pre-written review pool (`lib/review-pool.ts`)
- Pool is bucketed by rating tier: 4-star pool and 5-star pool
- Returns the selected comment text
- No external API call, no latency, no cost

### `GET /api/properties/[slug]`
- Returns public property info (id, name, slug, logo_url, brand_color, google_review_url, review_prompt, negative_prompt, optional_fields)
- No auth required (public page needs this)

---

## Renter Flow Detail (Mobile-First)

### Screen 1: Star Rating
- Property logo + name at top
- "How was your tour?" heading
- 5 large tappable stars
- **On tap: immediately POST to /api/reviews with just the rating (creates partial record)**
- Record ID stored in client state for later update
- Single tap advances to next screen
- One universal link per property: `/r/[slug]` (domain TBD — using Vercel subdomain for beta)

### Screen 2a: Positive Review (4-5 stars)
- "Glad you had a great experience!"
- Pre-written comment (from review pool) pre-filled in editable textarea
- "What did you enjoy most about your tour?" prompt above
- Optional fields (if admin enabled): name, tour guide, unit type
- "Submit Review" button

### Screen 2b: Negative Review (1-3 stars)
- "We appreciate your honesty."
- Empty textarea with prompt: "What could we do better?"
- Optional fields (if admin enabled)
- "Submit Feedback" button
- Goes directly to Thank You (no Google prompt)

### Screen 3: Google Prompt (4-5 stars only, after submit)
- "You're the best! It'd really help our team if you shared this on Google too."
- Comment shown (what they submitted)
- Auto-copies comment to clipboard on screen load
- "Copied to clipboard" confirmation
- Big "Share on Google" button (opens Google review URL in new tab)
- Subtle "Maybe later" link → goes to Thank You

### Screen 4: Thank You
- "Thank you! Your feedback means a lot."
- Simple, clean. Done.

---

## Project Structure

```
Reffie Reviews/
├── app/
│   ├── globals.css
│   ├── layout.tsx                    # Root layout (Inter font, metadata)
│   ├── page.tsx                      # Redirects to /admin/dashboard
│   ├── r/
│   │   └── [slug]/
│   │       └── page.tsx              # Renter review flow (mobile-first, all screens)
│   ├── admin/
│   │   ├── layout.tsx                # Admin nav + auth guard
│   │   ├── page.tsx                  # Login page
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Dashboard with stats + review table
│   │   ├── reviews/
│   │   │   └── page.tsx              # Review log with filters
│   │   └── settings/
│   │       └── page.tsx              # Property settings form
│   └── api/
│       ├── reviews/
│       │   └── route.ts              # POST review (create/update/google tracking)
│       ├── generate-review/
│       │   └── route.ts              # POST AI review generation
│       └── properties/
│           └── [slug]/
│               └── route.ts          # GET property info (public)
├── lib/
│   ├── supabase.ts                   # Supabase client (browser + server)
│   ├── review-pool.ts                # Pre-written review comments (4-star + 5-star pools)
│   └── validation.ts                 # Zod schemas + TypeScript interfaces
├── supabase/
│   └── schema.sql                    # Full DB schema with RLS policies
├── tailwind.config.ts
├── package.json
└── .env.local                        # API keys (not committed)
```

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## V1 Scope Boundaries
- ✅ Single property/company
- ✅ Tour reviews (stage "tour") only
- ✅ Pre-written review comment pool (4-star + 5-star buckets, editable by renter)
- ✅ Copy-to-clipboard + Google redirect
- ✅ Admin dashboard with review log
- ✅ Configurable optional fields
- ✅ Shareable review link
- ❌ No SMS/email sending (decoupled — admin copies link)
- ❌ No tenant reviews yet (stage "tenant" — future)
- ❌ No analytics/reporting (future)
- ❌ No multi-property support (future)
- ❌ No QR code generation (future)
- ❌ No session persistence for renter flow (pre-launch, mobile testing phase)
