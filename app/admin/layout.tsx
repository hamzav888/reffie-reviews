"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/settings", label: "Settings" },
];

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session && pathname !== "/admin") {
        router.push("/admin");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

  // Login page doesn't get the nav
  if (pathname === "/admin") {
    return <>{children}</>;
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Top Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-medium text-gray-900">
            <span style={{ color: '#10BD91' }}>Reffie</span> Reviews
          </span>
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
