"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { useProperty } from "@/lib/property-context";
import { Toggle } from "@/lib/components/Toggle";
import type { Tables } from "@/lib/database.types";

type PropertyRow = Tables<"properties">;

const DEFAULT_REVIEW_PROMPT = "What did you enjoy most about your tour?";
const DEFAULT_NEGATIVE_PROMPT = "What could we do better?";
const DEFAULT_BRAND_COLOR = "#10BD91";

// ── Shared form component (create and edit) ─────────────────────────────────
function PropertyForm({
  initial,
  onSave,
  onCancel,
  showCancel,
}: {
  initial: PropertyRow | null; // null = create mode
  onSave: () => void;
  onCancel: () => void;
  showCancel: boolean;
}) {
  const supabase = createBrowserClient();

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? "");
  const [brandColor, setBrandColor] = useState(
    initial?.brand_color ?? DEFAULT_BRAND_COLOR
  );
  const [googleUrlMode, setGoogleUrlMode] = useState<"place_id" | "direct_url">(() => {
    if (!initial?.google_review_url) return "place_id";
    return initial.google_review_url.includes("placeid=") ? "place_id" : "direct_url";
  });
  const [googleInput, setGoogleInput] = useState(() => {
    if (!initial?.google_review_url) return "";
    const match = initial.google_review_url.match(/placeid=([^&]+)/);
    if (match) return match[1];
    return initial.google_review_url;
  });
  const [reviewPrompt, setReviewPrompt] = useState(
    initial?.review_prompt ?? DEFAULT_REVIEW_PROMPT
  );
  const [negativePrompt, setNegativePrompt] = useState(
    initial?.negative_prompt ?? DEFAULT_NEGATIVE_PROMPT
  );

  const optFields = initial?.optional_fields as
    | { name: boolean; tour_guide: boolean; unit_type: boolean }
    | null;
  const [optName, setOptName] = useState(optFields?.name ?? false);
  const [optTourGuide, setOptTourGuide] = useState(
    optFields?.tour_guide ?? false
  );
  const [optUnitType, setOptUnitType] = useState(optFields?.unit_type ?? false);
  const [reviewFlowEnabled, setReviewFlowEnabled] = useState(
    initial?.review_flow_enabled ?? true
  );

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const googleReviewUrl = googleInput
      ? googleUrlMode === "place_id"
        ? `https://search.google.com/local/writereview?placeid=${googleInput}`
        : googleInput
      : "";

    const payload = {
      name,
      slug,
      logo_url: logoUrl || null,
      brand_color: brandColor,
      google_review_url: googleReviewUrl,
      review_prompt: reviewPrompt,
      negative_prompt: negativePrompt,
      optional_fields: {
        name: optName,
        tour_guide: optTourGuide,
        unit_type: optUnitType,
      },
      review_flow_enabled: reviewFlowEnabled,
    };

    if (initial) {
      // Edit mode
      const { error } = await supabase
        .from("properties")
        .update(payload)
        .eq("id", initial.id);
      if (error) {
        setErrorMsg(error.message);
        setSaving(false);
        return;
      }
    } else {
      // Create mode: insert property then link to current user
      const { data, error } = await supabase
        .from("properties")
        .insert(payload)
        .select("id")
        .single();

      if (error || !data) {
        setErrorMsg(error?.message ?? "Failed to create property.");
        setSaving(false);
        return;
      }

      // Link the new property to the current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error: pmError } = await supabase
          .from("property_managers")
          .insert({ user_id: user.id, property_id: data.id });
        if (pmError) {
          setErrorMsg(pmError.message);
          setSaving(false);
          return;
        }
      }
    }

    setSaving(false);
    onSave();
  };

  const toggleStyle = (on: boolean) =>
    `w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${
      on ? "bg-[#10BD91]" : "bg-gray-200"
    }`;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-xl">
      {/* ── Property Info ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Property Info</h2>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Property Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Sunrise Apartments"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Slug (URL path)
          </label>
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#10BD91]/20">
            <span className="px-3 py-2.5 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 select-none">
              /r/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                )
              }
              required
              placeholder="sunrise-apartments"
              className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-transparent"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Logo URL{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Brand Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              placeholder="#10BD91"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
            />
          </div>
        </div>
      </div>

      {/* ── Google Reviews ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Google Reviews</h2>

        {/* Mode selector */}
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => { setGoogleUrlMode("place_id"); setGoogleInput(""); }}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              googleUrlMode === "place_id"
                ? "bg-[#10BD91] text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            Place ID
          </button>
          <button
            type="button"
            onClick={() => { setGoogleUrlMode("direct_url"); setGoogleInput(""); }}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 ${
              googleUrlMode === "direct_url"
                ? "bg-[#10BD91] text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            Direct URL
          </button>
        </div>

        {googleUrlMode === "place_id" ? (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Google Place ID
            </label>
            <input
              type="text"
              value={googleInput}
              onChange={(e) => setGoogleInput(e.target.value.trim())}
              placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Find your Place ID at{" "}
              <a
                href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#10BD91] underline"
              >
                developers.google.com
              </a>
            </p>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Google Review URL
            </label>
            <input
              type="url"
              value={googleInput}
              onChange={(e) => setGoogleInput(e.target.value.trim())}
              placeholder="https://g.page/r/..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Paste any Google review link directly.
            </p>
          </div>
        )}
      </div>

      {/* ── Review Prompts ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Review Prompts</h2>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Positive Review Prompt{" "}
            <span className="font-normal text-gray-400">(4–5 stars)</span>
          </label>
          <input
            type="text"
            value={reviewPrompt}
            onChange={(e) => setReviewPrompt(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Negative Feedback Prompt{" "}
            <span className="font-normal text-gray-400">(1–3 stars)</span>
          </label>
          <input
            type="text"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
          />
        </div>
      </div>

      {/* ── Optional Fields ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">
            Optional Fields
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose which fields to collect from renters during the review.
          </p>
        </div>

        {(
          [
            { label: "Reviewer Name", value: optName, set: setOptName },
            { label: "Tour Guide Name", value: optTourGuide, set: setOptTourGuide },
            { label: "Unit Type", value: optUnitType, set: setOptUnitType },
          ] as const
        ).map(({ label, value, set }) => (
          <label key={label} className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={value}
              onClick={() => set(!value)}
              className={toggleStyle(value)}
            >
              <span
                className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  value ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        ))}
      </div>

      {/* ── Review Flow ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Review Flow</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Disable to show a &quot;unavailable&quot; message instead of the review form.
          </p>
        </div>
        <Toggle
          checked={reviewFlowEnabled}
          onChange={setReviewFlowEnabled}
          label="Enable review flow for this property"
        />
      </div>

      {errorMsg && (
        <p className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600">
          Error: {errorMsg}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
          style={{ background: "#10BD91" }}
        >
          {saving ? "Saving..." : initial ? "Save Changes" : "Create Property"}
        </button>

        {showCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-gray-600 font-medium text-sm border border-gray-200 hover:bg-gray-50 bg-white"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ── Settings page ────────────────────────────────────────────────────────────
type View = "list" | "form";

export default function SettingsPage() {
  const router = useRouter();
  const { properties, loading, refetch } = useProperty();

  const [view, setView] = useState<View>("list");
  const [editingProperty, setEditingProperty] = useState<PropertyRow | null>(
    null
  );

  // Single-property shortcut: skip the list and go straight to the edit form
  useEffect(() => {
    if (!loading && properties.length === 1) {
      setEditingProperty(properties[0]);
      setView("form");
    }
  }, [loading, properties]);

  const handleSave = async () => {
    await refetch();
    if (properties.length <= 1) {
      // Single-property user: go to dashboard after saving
      router.push("/admin/dashboard");
    } else {
      setView("list");
    }
  };

  const handleCancel = () => {
    setView("list");
    setEditingProperty(null);
  };

  if (loading) {
    return (
      <div className="animate-pulse text-gray-400 py-8 text-sm">
        Loading...
      </div>
    );
  }

  // ── List view ──
  if (view === "list") {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Properties</h1>
          <button
            onClick={() => {
              setEditingProperty(null);
              setView("form");
            }}
            className="px-4 py-2 rounded-xl text-white text-sm font-medium"
            style={{ background: "#10BD91" }}
          >
            + New Property
          </button>
        </div>

        {properties.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <p className="text-gray-500 text-sm mb-4">
              No properties yet. Create your first one to get started.
            </p>
            <button
              onClick={() => {
                setEditingProperty(null);
                setView("form");
              }}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-medium"
              style={{ background: "#10BD91" }}
            >
              Create Property
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {properties.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-6 py-4 ${
                  i < properties.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    /r/{p.slug}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingProperty(p);
                    setView("form");
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 bg-transparent cursor-pointer"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Form view (create or edit) ──
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        {editingProperty ? "Edit Property" : "New Property"}
      </h1>
      <PropertyForm
        initial={editingProperty}
        onSave={handleSave}
        onCancel={handleCancel}
        showCancel={properties.length !== 1}
      />
    </div>
  );
}
