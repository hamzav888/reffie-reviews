import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Server-side client with service role (bypasses RLS)
// Only use in API routes, never expose to client
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

// Client-side Supabase client (uses anon key, respects RLS)
// Singleton to prevent auth lock conflicts
let browserClient: SupabaseClient<Database> | null = null;

export function createBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  browserClient = createClient<Database>(url, key);
  return browserClient;
}

// Separate client for super admin Google OAuth verification.
// Uses a different storageKey so Google OAuth never touches the main
// email/password session. Each client stores its session and PKCE code
// verifier under its own key, so the two never interfere.
let superAdminClient: SupabaseClient<Database> | null = null;

export function createSuperAdminClient() {
  if (superAdminClient) return superAdminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  superAdminClient = createClient<Database>(url, key, {
    auth: { storageKey: "sb-super-admin-auth-token" },
  });
  return superAdminClient;
}
