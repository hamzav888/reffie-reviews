/**
 * Returns true when the user is a Reffie super-admin:
 *   - email ends with @reffie.me (case-insensitive)
 *   - the current session was created via Google OAuth
 *
 * Provider detection uses the identities array: the identity whose
 * last_sign_in_at matches the top-level last_sign_in_at is the one
 * used for this session. app_metadata.provider is NOT used because it
 * stores the original signup method, not the most recent sign-in.
 *
 * Accepts a structural type so it works with both the Supabase User object
 * (client and server) without importing SDK types.
 */
export function isSuperAdmin(
  user: {
    email?: string | null;
    last_sign_in_at?: string | null;
    identities?: Array<{ provider?: string; last_sign_in_at?: string }> | null;
    app_metadata?: { provider?: string; providers?: string[] };
  } | null | undefined
): boolean {
  return (
    typeof user?.email === "string" &&
    user.email.toLowerCase().endsWith("@reffie.me") &&
    Array.isArray(user.identities) &&
    user.identities.some(
      (id) => id.provider === "google" && id.last_sign_in_at === user.last_sign_in_at
    )
  );
}
