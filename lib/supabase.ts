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
