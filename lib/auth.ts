/**
 * Returns true if the given email belongs to a configured super-admin.
 *
 * NOTE: This function is no longer used to gate nav links or page access.
 * Super-admin access is now gated by Google OAuth step-up verification
 * (a @reffie.me email is required) at the page level and in the API route.
 * NEXT_PUBLIC_SUPER_ADMIN_EMAILS is no longer needed and has been removed
 * from .env.local. This function is retained in case it is referenced
 * elsewhere but does not gate anything in the current codebase.
 */
export function isSuperAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  const allowed = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
