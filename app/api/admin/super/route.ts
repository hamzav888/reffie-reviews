import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isSuperAdmin } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

// ── Auth verification ────────────────────────────────────────────────────────
// Verify the caller's JWT (Bearer token) and confirm they are a super-admin.
// Passes the JWT directly to auth.getUser(token) — the correct server-side
// pattern in Supabase JS v2. Never trusts any email supplied by the client.
async function verifySuper(req: Request) {
  const raw = req.headers.get("Authorization") ?? "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw.trim();
  if (!token) return null;

  const supabase = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user || !isSuperAdmin(user.email)) return null;
  return user;
}

// ── Shared response helpers ──────────────────────────────────────────────────
function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data);
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

// ── GET ──────────────────────────────────────────────────────────────────────
// ?type=overview → all properties (with review counts + manager ids) + all users (with properties)
// ?type=reviews  → all reviews joined with property name, ordered newest first
export async function GET(req: Request) {
  if (!(await verifySuper(req))) return forbidden();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const supabase = createServiceClient();

  if (type === "reviews") {
    const { data, error } = await supabase
      .from("reviews")
      .select("*, properties(name, slug)")
      .order("created_at", { ascending: false });

    if (error) return serverError(error.message);
    return ok(data);
  }

  if (type === "overview") {
    // 1. All properties
    const { data: properties, error: propErr } = await supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: true });
    if (propErr) return serverError(propErr.message);

    // 2. All property_managers
    const { data: managers, error: mgErr } = await supabase
      .from("property_managers")
      .select("user_id, property_id");
    if (mgErr) return serverError(mgErr.message);

    // 3. All reviews (just property_id) — count in JS, single query
    const { data: allReviews, error: revErr } = await supabase
      .from("reviews")
      .select("property_id");
    if (revErr) return serverError(revErr.message);

    const reviewCountMap: Record<string, number> = {};
    for (const r of allReviews ?? []) {
      reviewCountMap[r.property_id] = (reviewCountMap[r.property_id] ?? 0) + 1;
    }

    // 4. All auth users
    const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers();
    if (userErr) return serverError(userErr.message);

    // Build property → manager_ids map
    const managersByProp: Record<string, string[]> = {};
    const propsByUser: Record<string, Array<{ id: string; name: string; slug: string }>> = {};

    for (const m of managers ?? []) {
      if (!managersByProp[m.property_id]) managersByProp[m.property_id] = [];
      managersByProp[m.property_id].push(m.user_id);

      if (!propsByUser[m.user_id]) propsByUser[m.user_id] = [];
      const prop = (properties ?? []).find((p) => p.id === m.property_id);
      if (prop) {
        propsByUser[m.user_id].push({ id: prop.id, name: prop.name, slug: prop.slug });
      }
    }

    const propertiesWithStats = (properties ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand_color: p.brand_color,
      created_at: p.created_at,
      review_count: reviewCountMap[p.id] ?? 0,
      manager_ids: managersByProp[p.id] ?? [],
      review_flow_enabled: p.review_flow_enabled,
    }));

    const usersWithProperties = users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      properties: propsByUser[u.id] ?? [],
    }));

    return ok({ properties: propertiesWithStats, users: usersWithProperties });
  }

  return badRequest("Missing or invalid ?type parameter. Use 'overview' or 'reviews'.");
}

// ── POST ─────────────────────────────────────────────────────────────────────
// Body must have an `action` field:
//   create_property — inserts a new property row
//   create_user     — creates a Supabase Auth user (email_confirm: true)
//   add_manager     — links a user to a property in property_managers
export async function POST(req: Request) {
  if (!(await verifySuper(req))) return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const supabase = createServiceClient();
  const { action } = body;

  if (action === "create_property") {
    const payload = {
      name: body.name as string,
      slug: body.slug as string,
      brand_color: (body.brand_color as string) ?? "#10BD91",
      google_review_url: (body.google_review_url as string) ?? "",
      logo_url: (body.logo_url as string | null) ?? null,
      review_prompt:
        (body.review_prompt as string) ?? "What did you enjoy most about your tour?",
      negative_prompt:
        (body.negative_prompt as string) ?? "What could we do better?",
      optional_fields: (body.optional_fields as Record<string, boolean>) ?? {
        name: false,
        tour_guide: false,
        unit_type: false,
      },
      review_flow_enabled: (body.review_flow_enabled as boolean) ?? true,
    };

    if (!payload.name || !payload.slug) {
      return badRequest("name and slug are required.");
    }

    const { data, error } = await supabase
      .from("properties")
      .insert(payload)
      .select("id")
      .single();

    if (error) return serverError(error.message);
    return ok({ ok: true, id: data.id });
  }

  if (action === "create_user") {
    const email = body.email as string;
    const password = body.password as string;
    if (!email || !password) return badRequest("email and password are required.");

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) return serverError(error.message);
    return ok({ ok: true, id: data.user.id });
  }

  if (action === "add_manager") {
    const user_id = body.user_id as string;
    const property_id = body.property_id as string;
    if (!user_id || !property_id) return badRequest("user_id and property_id are required.");

    const { error } = await supabase
      .from("property_managers")
      .insert({ user_id, property_id });

    if (error) return serverError(error.message);
    return ok();
  }

  return badRequest(`Unknown action: ${String(action)}`);
}

// ── PATCH ────────────────────────────────────────────────────────────────────
// Body: { id: string, ...fields } — updates a property row by id
export async function PATCH(req: Request) {
  if (!(await verifySuper(req))) return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const { id, ...fields } = body;
  if (typeof id !== "string" || !id) return badRequest("id is required.");

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("properties")
    .update(fields as Partial<Database["public"]["Tables"]["properties"]["Update"]>)
    .eq("id", id);

  if (error) return serverError(error.message);
  return ok();
}

// ── DELETE ───────────────────────────────────────────────────────────────────
// Body must have a `type` field:
//   property — deletes a property (CASCADE removes reviews + property_managers)
//   user     — deletes a Supabase Auth user
//   manager  — removes a single property_managers row
export async function DELETE(req: Request) {
  if (!(await verifySuper(req))) return forbidden();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const supabase = createServiceClient();
  const { type } = body;

  if (type === "property") {
    const id = body.id as string;
    if (!id) return badRequest("id is required.");

    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) return serverError(error.message);
    return ok();
  }

  if (type === "user") {
    const userId = body.userId as string;
    if (!userId) return badRequest("userId is required.");

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) return serverError(error.message);
    return ok();
  }

  if (type === "manager") {
    const userId = body.userId as string;
    const propertyId = body.propertyId as string;
    if (!userId || !propertyId) return badRequest("userId and propertyId are required.");

    const { error } = await supabase
      .from("property_managers")
      .delete()
      .eq("user_id", userId)
      .eq("property_id", propertyId);

    if (error) return serverError(error.message);
    return ok();
  }

  return badRequest(`Unknown type: ${String(type)}`);
}
