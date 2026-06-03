"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorParam] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("error")
      : null
  );
  const [sessionChecked, setSessionChecked] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push("/admin/dashboard");
      } else {
        setSessionChecked(true);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/admin/dashboard");
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: { hd: "reffie.me" },
        redirectTo: `${window.location.origin}/admin/dashboard`,
      },
    });
    if (error) setError(error.message);
  };

  if (!sessionChecked) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-center text-gray-900 mb-1">
          <span style={{ color: "#10BD91" }}>Reffie</span> Reviews
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Admin Dashboard
        </p>

        {errorParam === "restricted" && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded mb-4">
            Access restricted to Reffie team members.
          </p>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
            style={{ background: "#10BD91" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
          >
            Admin login
          </button>
        </div>
      </div>
    </div>
  );
}
