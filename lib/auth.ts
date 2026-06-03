/**
 * Returns true when the user is a Reffie super-admin:
 *   - email ends with @reffie.me (case-insensitive)
 *   - session was created via Google OAuth (not email/password)
 *
 * Accepts a structural type so it works with both the Supabase User object
 * (client and server) without importing SDK types.
 */
export function isSuperAdmin(
  user: { email?: string | null; app_metadata?: { provider?: string } } | null | undefined
): boolean {
  return (
    typeof user?.email === "string" &&
    user.email.toLowerCase().endsWith("@reffie.me") &&
    user.app_metadata?.provider === "google"
  );
}
