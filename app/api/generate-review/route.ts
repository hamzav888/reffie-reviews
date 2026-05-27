import { NextResponse } from "next/server";
import { generateReviewSchema } from "@/lib/validation";
import { fourStarReviews, fiveStarReviews } from "@/lib/review-pool";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = generateReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { rating } = parsed.data;
  const pool = rating === 5 ? fiveStarReviews : fourStarReviews;
  const comment = pool[Math.floor(Math.random() * pool.length)];

  return NextResponse.json({ comment });
}
