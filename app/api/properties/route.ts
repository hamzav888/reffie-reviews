import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(req: Request) {
  const raw = req.headers.get("Authorization") ?? "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw.trim();
  if (!token) return unauthorized();

  const supabase = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const baseSlug = body.slug as string;
  if (!body.name || !baseSlug) return badRequest("name and slug are required.");

  // Collision resolution
  let candidate = baseSlug;
  let suffix = 2;
  while (true) {
    const { data } = await supabase
      .from("properties")
      .select("id")
      .eq("slug", candidate);
    if (!data?.length) break;
    candidate = `${baseSlug}-${suffix++}`;
  }

  const payload = {
    name: body.name as string,
    slug: candidate,
    logo_url: (body.logo_url as string | null) ?? null,
    brand_color: (body.brand_color as string) ?? "#10BD91",
    google_review_url: (body.google_review_url as string) ?? "",
    review_prompt:
      (body.review_prompt as string) ?? "What did you enjoy most about your tour?",
    negative_prompt: (body.negative_prompt as string) ?? "What could we do better?",
    optional_fields: (body.optional_fields as Record<string, boolean>) ?? {
      name: false,
      tour_guide: false,
      unit_type: false,
    },
    review_flow_enabled: (body.review_flow_enabled as boolean) ?? true,
    name_requirement: (body.name_requirement as string) ?? "required_all",
  };

  const { data: property, error: propError } = await supabase
    .from("properties")
    .insert(payload)
    .select("id")
    .single();

  if (propError || !property) return serverError(propError?.message ?? "Insert failed.");

  const { error: pmError } = await supabase
    .from("property_managers")
    .insert({ user_id: user.id, property_id: property.id });

  if (pmError) return serverError(pmError.message);

  return NextResponse.json({ id: property.id, slug: candidate });
}
