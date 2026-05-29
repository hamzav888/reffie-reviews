"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";
import type { Session } from "@supabase/supabase-js";

// ── Local types ──────────────────────────────────────────────────────────────

type Tab = "properties" | "users" | "reviews";

type PropertyWithStats = {
  id: string;
  name: string;
  slug: string;
  brand_color: string;
  created_at: string;
  review_count: number;
  manager_ids: string[];
  review_flow_enabled: boolean;
  google_review_url: string;
};

type UserWithProperties = {
  id: string;
  email: string;
  created_at: string;
  properties: Array<{ id: string; name: string; slug: string }>;
};

type ReviewWithProperty = Tables<"reviews"> & {
  properties: { name: string; slug: string } | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_BRAND_COLOR = "#10BD91";

function starStr(rating: number) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const supabase = createBrowserClient();

  // null = loading/checking, true = verified, false = verify screen, "denied" = wrong Google account
  const [verified, setVerified] = useState<boolean | "denied" | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Debug state — remove once OAuth flow is confirmed working
  const [debugHref, setDebugHref] = useState("");
  const [debugSessionEmail, setDebugSessionEmail] = useState<string | null>(null);
  const [debugSessionExists, setDebugSessionExists] = useState<boolean | null>(null);
  const [debugIdentities, setDebugIdentities] = useState<string | null>(null);
  const [debugLastEvent, setDebugLastEvent] = useState<string | null>(null);
  const [debugOAuthError, setDebugOAuthError] = useState<string | null>(null);

  // Tab state
  const [tab, setTab] = useState<Tab>("properties");

  // Data
  const [properties, setProperties] = useState<PropertyWithStats[]>([]);
  const [users, setUsers] = useState<UserWithProperties[]>([]);
  const [reviews, setReviews] = useState<ReviewWithProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step-up Google OAuth verification ──────────────────────────────────────
  // Access is granted only when the active Supabase session has a linked Google
  // identity AND the account email ends with @reffie.me.
  //
  // onAuthStateChange is subscribed FIRST so we don't miss the SIGNED_IN event
  // that fires after Supabase finishes processing the OAuth callback and linking
  // the Google identity. getSession() on mount may still see the old session
  // state before identity linking completes, so it alone is not enough for the
  // post-OAuth case. getSession() handles the returning-visit case where the
  // Google identity is already present from a previous OAuth flow.
  useEffect(() => {
    setDebugHref(window.location.href);

    // ── Shared verification logic ──────────────────────────────────────────
    // Called from both onAuthStateChange and getSession() so the same check
    // runs regardless of which path delivers the updated session first.
    const runVerification = (session: Session | null, eventName: string) => {
      setDebugLastEvent(eventName);
      setDebugSessionExists(session !== null);
      setDebugSessionEmail(session?.user.email ?? null);
      setDebugIdentities(
        JSON.stringify(session?.user.identities?.map((i) => i.provider) ?? [])
      );

      if (!session) {
        // No session — redirect to the admin login page
        window.location.replace("/admin");
        return;
      }

      // Use identities[] instead of app_metadata.provider — the latter keeps
      // the original provider and does not update when a Google OAuth identity
      // is linked to an existing email/password account. identities[] lists ALL
      // linked providers, so hasGoogleIdentity is true as long as Google OAuth
      // has ever been used to link this account, even if the current session was
      // started with email/password. Accounts with both "email" and "google"
      // identities (auto-linked by Supabase when emails match) are correctly
      // detected here — .some() returns true if any identity is "google".
      const hasGoogleIdentity =
        session.user.identities?.some((i) => i.provider === "google") ?? false;
      const isReffieEmail =
        session.user.email?.endsWith("@reffie.me") ?? false;

      if (hasGoogleIdentity && isReffieEmail) {
        // Google identity + @reffie.me — grant access
        localStorage.setItem("super_admin_verified", "true");
        setToken(session.access_token);
        setVerified(true);
      } else if (hasGoogleIdentity && !isReffieEmail) {
        // Has Google identity but wrong email — deny
        localStorage.removeItem("super_admin_verified");
        setVerified("denied");
      } else {
        // No Google identity — show verify screen (must sign in with Google first)
        localStorage.removeItem("super_admin_verified");
        setVerified(false);
      }
    };

    // ── Subscribe first ────────────────────────────────────────────────────
    // Catches the SIGNED_IN event that fires once Supabase has fully processed
    // the OAuth callback and the Google identity is linked on the session object.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        runVerification(session, event);
      }
    });

    // ── Then check the current session ────────────────────────────────────
    // Handles returning visits where a Google identity is already present —
    // no new OAuth redirect happened, so SIGNED_IN won't fire. If getSession()
    // returns a verified Google session, access is granted immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      runVerification(session, "getSession");
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const apiFetch = async (
    method: string,
    urlOrParams: string,
    body?: unknown
  ) => {
    const url =
      method === "GET"
        ? `/api/admin/super?${urlOrParams}`
        : "/api/admin/super";
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  };

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("GET", "type=overview");
      setProperties(data.properties ?? []);
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("GET", "type=reviews");
      setReviews(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (verified !== true || !token) return;
    if (tab === "reviews") {
      loadReviews();
    } else {
      loadOverview();
    }
  }, [verified, token, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading / guard states ─────────────────────────────────────────────────
  if (verified === null) {
    return (
      <div className="animate-pulse text-gray-400 py-8 text-sm">
        Loading...
      </div>
    );
  }

  if (verified === "denied") {
    return (
      <div className="max-w-sm mx-auto py-16 text-center">
        <p className="text-sm text-red-600 mb-6">
          Access denied. A @reffie.me Google account is required.
        </p>
        <a
          href="/admin/dashboard"
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Go back
        </a>
      </div>
    );
  }

  if (verified === false) {
    return (
      <div className="max-w-sm mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Super Admin Access
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Verify your identity with a @reffie.me Google account to continue.
        </p>
        <button
          onClick={async () => {
            setDebugOAuthError(null);
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: window.location.origin + "/admin/super",
                scopes: "email",
              },
            });
            if (error) setDebugOAuthError(error.message);
          }}
          className="w-full py-2.5 rounded-xl text-white font-semibold text-sm mb-4 cursor-pointer border-0"
          style={{ background: "#10BD91" }}
        >
          Verify with Google
        </button>
        <a
          href="/admin/dashboard"
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Go back
        </a>

        {/* Debug display — remove once OAuth flow is confirmed working */}
        <div className="mt-8 text-left bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-500 space-y-1 break-all">
          <p>
            <span className="font-semibold">href:</span> {debugHref}
          </p>
          <p>
            <span className="font-semibold">session exists:</span>{" "}
            {debugSessionExists === null ? "checking…" : String(debugSessionExists)}
          </p>
          <p>
            <span className="font-semibold">session email:</span>{" "}
            {debugSessionEmail ?? "none"}
          </p>
          <p>
            <span className="font-semibold">identities:</span>{" "}
            {debugIdentities ?? "none"}
          </p>
          <p>
            <span className="font-semibold">event:</span>{" "}
            {debugLastEvent ?? "none"}
          </p>
          {debugOAuthError && (
            <p className="text-red-500">
              <span className="font-semibold">oauth error:</span>{" "}
              {debugOAuthError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const tabClass = (t: Tab) =>
    `text-sm pb-0.5 border-b-2 transition-colors bg-transparent cursor-pointer ${
      tab === t
        ? "border-[#10BD91] text-gray-900 font-medium"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Admin</h1>

      {/* Tab bar */}
      <div className="flex items-center gap-6 border-b border-gray-200 mb-6">
        {(["properties", "users", "reviews"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tabClass(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 animate-pulse py-8">
          Loading…
        </div>
      ) : tab === "properties" ? (
        <PropertiesTab
          properties={properties}
          users={users}
          token={token!}
          onRefresh={loadOverview}
        />
      ) : tab === "users" ? (
        <UsersTab
          users={users}
          allProperties={properties}
          token={token!}
          onRefresh={loadOverview}
        />
      ) : (
        <ReviewsTab reviews={reviews} />
      )}
    </div>
  );
}

// ── Properties Tab ────────────────────────────────────────────────────────────

function PropertiesTab({
  properties,
  users,
  token,
  onRefresh,
}: {
  properties: PropertyWithStats[];
  users: UserWithProperties[];
  token: string;
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const apiFetch = async (method: string, body?: unknown) => {
    const res = await fetch("/api/admin/super", {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  };

  const handleDelete = async (p: PropertyWithStats) => {
    if (
      !window.confirm(
        `Delete "${p.name}"? This will permanently remove all its reviews and manager links.`
      )
    )
      return;
    try {
      await apiFetch("DELETE", { type: "property", id: p.id });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  // Resolve manager emails for display
  const managerEmails = (managerIds: string[]) =>
    managerIds
      .map((id) => users.find((u) => u.id === id)?.email ?? id.slice(0, 8) + "…")
      .join(", ") || "—";

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingId(null);
            setShowCreate((v) => !v);
          }}
          className="px-4 py-2 rounded-xl text-white text-sm font-medium"
          style={{ background: "#10BD91" }}
        >
          {showCreate ? "Cancel" : "+ New Property"}
        </button>
      </div>

      {/* Inline create form */}
      {showCreate && (
        <PropertyForm
          initial={null}
          token={token}
          onSave={() => {
            setShowCreate(false);
            onRefresh();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {properties.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            No properties yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Slug</th>
                  <th className="px-4 py-3 text-left font-medium">Color</th>
                  <th className="px-4 py-3 text-left font-medium">Flow</th>
                  <th className="px-4 py-3 text-left font-medium">Reviews</th>
                  <th className="px-4 py-3 text-left font-medium">Managers</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <>
                    <tr
                      key={p.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors align-top"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                        /r/{p.slug}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block w-4 h-4 rounded-full border border-gray-200"
                          style={{ background: p.brand_color }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {p.review_flow_enabled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            On
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                            Off
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {p.review_count}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">
                        {managerEmails(p.manager_ids)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setEditingId(editingId === p.id ? null : p.id)
                            }
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 bg-transparent cursor-pointer"
                          >
                            {editingId === p.id ? "Close" : "Edit"}
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="text-xs px-2 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 bg-transparent cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === p.id && (
                      <tr key={`${p.id}-edit`} className="bg-gray-50/50">
                        <td colSpan={8} className="px-4 py-4">
                          <PropertyForm
                            initial={p}
                            token={token}
                            onSave={() => {
                              setEditingId(null);
                              onRefresh();
                            }}
                            onCancel={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Property inline form (create + edit) ─────────────────────────────────────

function PropertyForm({
  initial,
  token,
  onSave,
  onCancel,
}: {
  initial: PropertyWithStats | null;
  token: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [brandColor, setBrandColor] = useState(
    initial?.brand_color ?? DEFAULT_BRAND_COLOR
  );
  const [googleUrlMode, setGoogleUrlMode] = useState<"place_id" | "direct_url">(() => {
    if (!initial?.google_review_url) return "place_id";
    return initial.google_review_url.includes("placeid=") ? "place_id" : "direct_url";
  });
  const [googlePlaceId, setGooglePlaceId] = useState(() => {
    if (!initial?.google_review_url) return "";
    const match = initial.google_review_url.match(/placeid=([^&]+)/);
    return match ? match[1] : "";
  });
  const [googleDirectUrl, setGoogleDirectUrl] = useState(() => {
    if (!initial?.google_review_url) return "";
    if (!initial.google_review_url.includes("placeid=")) return initial.google_review_url;
    return "";
  });
  const [reviewFlowEnabled, setReviewFlowEnabled] = useState(
    initial?.review_flow_enabled ?? true
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const activeGoogleInput =
      googleUrlMode === "place_id" ? googlePlaceId : googleDirectUrl;
    const googleReviewUrl = activeGoogleInput
      ? googleUrlMode === "place_id"
        ? `https://search.google.com/local/writereview?placeid=${activeGoogleInput}`
        : activeGoogleInput
      : undefined; // keep existing value when left blank

    try {
      if (initial) {
        const body: Record<string, unknown> = {
          id: initial.id,
          name,
          slug,
          brand_color: brandColor,
          review_flow_enabled: reviewFlowEnabled,
        };
        if (activeGoogleInput) body.google_review_url = googleReviewUrl;

        const res = await fetch("/api/admin/super", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Update failed");
      } else {
        const res = await fetch("/api/admin/super", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create_property",
            name,
            slug,
            brand_color: brandColor,
            google_review_url: googleReviewUrl ?? "",
            review_flow_enabled: reviewFlowEnabled,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Create failed");
      }
      onSave();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 max-w-lg"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Sunrise Apartments"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Slug
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
            }
            required
            placeholder="sunrise-apartments"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">
          Brand Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-2 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
          />
        </div>
      </div>

      {/* Google Review URL */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-600">
            Google Review URL
          </label>
          <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setGoogleUrlMode("place_id")}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                googleUrlMode === "place_id"
                  ? "bg-[#10BD91] text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              Place ID
            </button>
            <button
              type="button"
              onClick={() => setGoogleUrlMode("direct_url")}
              className={`px-2.5 py-1 text-xs font-medium transition-colors border-l border-gray-200 ${
                googleUrlMode === "direct_url"
                  ? "bg-[#10BD91] text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              Direct URL
            </button>
          </div>
          {initial && (
            <span className="text-xs text-gray-400">leave blank to keep</span>
          )}
        </div>
        <input
          type="text"
          value={googleUrlMode === "place_id" ? googlePlaceId : googleDirectUrl}
          onChange={(e) =>
            googleUrlMode === "place_id"
              ? setGooglePlaceId(e.target.value.trim())
              : setGoogleDirectUrl(e.target.value.trim())
          }
          placeholder={
            googleUrlMode === "place_id"
              ? "ChIJN1t_tDeuEmsRUsoyG83frY4"
              : "https://g.page/r/..."
          }
          className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20 ${
            googleUrlMode === "place_id" ? "font-mono" : ""
          }`}
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <button
          type="button"
          role="switch"
          aria-checked={reviewFlowEnabled}
          onClick={() => setReviewFlowEnabled(!reviewFlowEnabled)}
          className={`relative inline-flex items-center w-11 h-6 rounded-full flex-shrink-0 border-0 p-0 cursor-pointer transition-colors ${
            reviewFlowEnabled ? "bg-[#10BD91]" : "bg-[#D1D5DB]"
          }`}
        >
          <span
            style={{
              position: "absolute",
              top: "2px",
              left: "2px",
              width: "20px",
              height: "20px",
              borderRadius: "9999px",
              background: "white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transition: "transform 150ms",
              transform: reviewFlowEnabled ? "translateX(20px)" : "translateX(0px)",
            }}
          />
        </button>
        <span className="text-xs text-gray-600">Enable review flow</span>
      </label>

      {err && (
        <p className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">
          {err}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
          style={{ background: "#10BD91" }}
        >
          {saving ? "Saving…" : initial ? "Save Changes" : "Create Property"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-gray-600 text-sm border border-gray-200 hover:bg-gray-50 bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({
  users,
  allProperties,
  token,
  onRefresh,
}: {
  users: UserWithProperties[];
  allProperties: PropertyWithStats[];
  token: string;
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);

  const apiFetch = async (method: string, body: unknown) => {
    const res = await fetch("/api/admin/super", {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  };

  const handleDeleteUser = async (u: UserWithProperties) => {
    if (!window.confirm(`Delete user "${u.email}"? This cannot be undone.`))
      return;
    try {
      await apiFetch("DELETE", { type: "user", userId: u.id });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  const handleRemoveManager = async (userId: string, propertyId: string) => {
    try {
      await apiFetch("DELETE", {
        type: "manager",
        userId,
        propertyId,
      });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Remove failed.");
    }
  };

  const handleAddManager = async (userId: string, propertyId: string) => {
    try {
      await apiFetch("POST", { action: "add_manager", user_id: userId, property_id: propertyId });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Add failed.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 rounded-xl text-white text-sm font-medium"
          style={{ background: "#10BD91" }}
        >
          {showCreate ? "Cancel" : "+ New User"}
        </button>
      </div>

      {/* Inline create form */}
      {showCreate && (
        <CreateUserForm
          token={token}
          onSave={() => {
            setShowCreate(false);
            onRefresh();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {users.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            No users found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Properties</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isManaging = managingId === u.id;
                  const assignedIds = new Set(u.properties.map((p) => p.id));
                  const unassigned = allProperties.filter(
                    (p) => !assignedIds.has(p.id)
                  );
                  return (
                    <>
                      <tr
                        key={u.id}
                        className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors align-top"
                      >
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {u.email || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {u.properties.length === 0
                            ? "—"
                            : u.properties.map((p) => p.name).join(", ")}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setManagingId(isManaging ? null : u.id)
                              }
                              className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 bg-transparent cursor-pointer"
                            >
                              {isManaging ? "Close" : "Manage"}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="text-xs px-2 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 bg-transparent cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isManaging && (
                        <tr key={`${u.id}-manage`} className="bg-gray-50/50">
                          <td colSpan={4} className="px-4 py-4">
                            <div className="space-y-3 max-w-md">
                              <p className="text-xs font-medium text-gray-600">
                                Assigned properties
                              </p>
                              {u.properties.length === 0 ? (
                                <p className="text-xs text-gray-400">None</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {u.properties.map((p) => (
                                    <span
                                      key={p.id}
                                      className="inline-flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1"
                                    >
                                      {p.name}
                                      <button
                                        onClick={() =>
                                          handleRemoveManager(u.id, p.id)
                                        }
                                        className="text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer text-sm leading-none"
                                        title="Remove"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                              {unassigned.length > 0 && (
                                <AddManagerSelect
                                  userId={u.id}
                                  unassigned={unassigned}
                                  onAdd={handleAddManager}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Small sub-component to avoid stale closure on select value
function AddManagerSelect({
  userId,
  unassigned,
  onAdd,
}: {
  userId: string;
  unassigned: PropertyWithStats[];
  onAdd: (userId: string, propertyId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(unassigned[0]?.id ?? "");

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="text-sm rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20 text-gray-700"
      >
        {unassigned.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => selectedId && onAdd(userId, selectedId)}
        className="text-xs px-3 py-1.5 rounded-lg text-white font-medium"
        style={{ background: "#10BD91" }}
      >
        Add
      </button>
    </div>
  );
}

// ── Create user form ──────────────────────────────────────────────────────────

function CreateUserForm({
  token,
  onSave,
  onCancel,
}: {
  token: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/super", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "create_user", email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      onSave();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 max-w-sm"
    >
      <p className="text-xs font-semibold text-gray-700">Create New User</p>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="admin@example.com"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
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
          minLength={8}
          placeholder="Min 8 characters"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
        />
      </div>
      {err && (
        <p className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">
          {err}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
          style={{ background: "#10BD91" }}
        >
          {saving ? "Creating…" : "Create User"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-gray-600 text-sm border border-gray-200 hover:bg-gray-50 bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Reviews Tab ───────────────────────────────────────────────────────────────

function ReviewsTab({ reviews }: { reviews: ReviewWithProperty[] }) {
  if (reviews.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center text-sm text-gray-400">
        No reviews yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Property</th>
              <th className="px-4 py-3 text-left font-medium">Rating</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Comment</th>
              <th className="px-4 py-3 text-left font-medium">Google</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr
                key={r.id}
                className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors align-top"
              >
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {r.properties?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-sm font-medium"
                    style={{ color: r.rating >= 4 ? "#10BD91" : "#F59E0B" }}
                  >
                    {starStr(r.rating)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                  {r.reviewer_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                  {r.comment ? (
                    <span className="block leading-relaxed">{r.comment}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.google_clicked ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 whitespace-nowrap">
                      Shared
                    </span>
                  ) : r.google_prompt_shown ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 whitespace-nowrap">
                      Prompted
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
