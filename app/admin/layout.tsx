"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { PropertyProvider, useProperty } from "@/lib/property-context";
import { isSuperAdmin } from "@/lib/auth";
import type { Session } from "@supabase/supabase-js";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/settings", label: "Settings" },
];

// ── Inner shell: consumes property context for the selector ─────────────────
function AdminShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserClient();
  const { properties, selectedProperty, setSelectedProperty } = useProperty();

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Top Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {/* Left: logo + optional property selector */}
          <div className="flex items-center gap-4">
            <span className="text-lg font-medium text-gray-900">
              <span style={{ color: "#10BD91" }}>Reffie</span> Reviews
            </span>

            {/* Property selector — only shown when managing 2+ properties */}
            {properties.length > 1 && (
              <select
                value={selectedProperty?.id ?? ""}
                onChange={(e) => {
                  const found = properties.find((p) => p.id === e.target.value);
                  if (found) setSelectedProperty(found);
                }}
                className="text-sm rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20 text-gray-700"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Right: nav links + sign out */}
          <div className="flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`text-sm pb-0.5 border-b-2 transition-colors bg-transparent cursor-pointer ${
                  pathname === item.href
                    ? "border-[#10BD91] text-gray-900 font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {item.label}
              </button>
            ))}
            {isSuperAdmin(session.user.email) && (
              <button
                onClick={() => router.push("/admin/super")}
                className={`text-sm pb-0.5 border-b-2 transition-colors bg-transparent cursor-pointer ${
                  pathname === "/admin/super"
                    ? "border-[#10BD91] text-gray-900 font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Admin
              </button>
            )}
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

// ── Root admin layout: handles auth, then mounts provider + shell ───────────
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserClient();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (
        session &&
        session.user.app_metadata?.provider === "google" &&
        !session.user.email?.toLowerCase().endsWith("@reffie.me")
      ) {
        await supabase.auth.signOut();
        router.push("/admin?error=restricted");
        return;
      }
      setSession(session);
      setLoading(false);
      if (!session && pathname !== "/admin") {
        router.push("/admin");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (
        session &&
        session.user.app_metadata?.provider === "google" &&
        !session.user.email?.toLowerCase().endsWith("@reffie.me")
      ) {
        await supabase.auth.signOut();
        router.push("/admin?error=restricted");
        return;
      }
      setSession(session);
      if (!session && pathname !== "/admin") {
        router.push("/admin");
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router, supabase.auth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  // Login page — no nav, no provider needed
  if (pathname === "/admin") {
    return <>{children}</>;
  }

  if (!session) return null;

  // Authenticated — wrap with property context so all admin pages can use it
  return (
    <PropertyProvider session={session}>
      <AdminShell session={session}>{children}</AdminShell>
    </PropertyProvider>
  );
}
