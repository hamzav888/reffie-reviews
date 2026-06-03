/**
 * Returns true if the given email belongs to the Reffie team (@reffie.me).
 *
 * Used client-side (nav visibility, page guards) and server-side (API route auth).
 * Comparison is case-insensitive.
 */
export function isSuperAdmin(email: string | undefined | null): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith("@reffie.me");
}
