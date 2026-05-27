import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  createPartialReviewSchema,
  completeReviewSchema,
  updateGoogleStatusSchema,
} from "@/lib/validation";

// In-memory rate limiting (per serverless instance; resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── Step 1: Create partial review (star tap) ──────────────────────────────
  if ("property_id" in body) {
    // Honeypot check BEFORE Zod — silently succeed so bots get no signal
    if (body.honeypot) {
      return NextResponse.json({ reviewId: "honeypot" }, { status: 200 });
    }

    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = createPartialReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        property_id: parsed.data.property_id,
        rating: parsed.data.rating,
        stage: "tour",
        is_complete: false,
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to create review" },
        { status: 500 }
      );
    }

    return NextResponse.json({ reviewId: data.id });
  }

  // ── Step 2: Complete review (form submit) ─────────────────────────────────
  if ("comment" in body) {
    const parsed = completeReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      review_id,
      comment,
      reviewer_name,
      tour_guide,
      unit_type,
      ai_generated_comment,
    } = parsed.data;

    const { error } = await supabase
      .from("reviews")
      .update({
        comment: comment || null,
        reviewer_name: reviewer_name || null,
        tour_guide: tour_guide || null,
        unit_type: unit_type || null,
        ai_generated_comment: ai_generated_comment || null,
        is_complete: true,
      })
      .eq("id", review_id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update review" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  // ── Google tracking update ────────────────────────────────────────────────
  if ("review_id" in body) {
    const parsed = updateGoogleStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      review_id,
      google_prompt_shown,
      google_clicked,
      redirected_to_google,
      google_comment_copied,
    } = parsed.data;

    // Only include fields that were actually sent
    const updateFields: {
      google_prompt_shown?: boolean;
      google_clicked?: boolean;
      redirected_to_google?: boolean;
      google_comment_copied?: string;
    } = {};
    if (google_prompt_shown !== undefined)
      updateFields.google_prompt_shown = google_prompt_shown;
    if (google_clicked !== undefined)
      updateFields.google_clicked = google_clicked;
    if (redirected_to_google !== undefined)
      updateFields.redirected_to_google = redirected_to_google;
    if (google_comment_copied !== undefined)
      updateFields.google_comment_copied = google_comment_copied;

    const { error } = await supabase
      .from("reviews")
      .update(updateFields)
      .eq("id", review_id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update tracking" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown request shape" }, { status: 400 });
}
