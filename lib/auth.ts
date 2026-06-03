/**
 * Returns true when the user's email belongs to the Reffie team (@reffie.me).
 *
 * @reffie.me accounts must only exist as Google OAuth users (no passwords),
 * so email-domain alone is the correct and sufficient check.
 *
 * Accepts a structural type so it works with both the Supabase User object
 * (client and server) without importing SDK types.
 */
export function isSuperAdmin(
  user: { email?: string | null } | null | undefined
): boolean {
  return (
    typeof user?.email === "string" &&
    user.email.toLowerCase().endsWith("@reffie.me")
  );
}
