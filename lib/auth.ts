/**
 * Returns true if the given email belongs to a configured super-admin.
 *
 * Super-admin emails are stored in NEXT_PUBLIC_SUPER_ADMIN_EMAILS as a
 * comma-separated list (e.g. "alice@example.com,bob@example.com").
 * The NEXT_PUBLIC_ prefix makes the value available client-side so the
 * nav link can be shown/hidden without an extra API call.
 *
 * Comparison is case-insensitive.
 */
export function isSuperAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  const allowed = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
