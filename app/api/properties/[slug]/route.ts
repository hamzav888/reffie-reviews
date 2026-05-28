import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, name, slug, logo_url, brand_color, google_review_url, review_prompt, negative_prompt, optional_fields, review_flow_enabled"
    )
    .eq("slug", params.slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
