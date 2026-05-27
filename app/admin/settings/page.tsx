"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";

const DEFAULT_REVIEW_PROMPT = "What did you enjoy most about your tour?";
const DEFAULT_NEGATIVE_PROMPT = "What could we do better?";
const DEFAULT_BRAND_COLOR = "#10BD91";

export default function SettingsPage() {
  const supabase = createBrowserClient();

  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [placeId, setPlaceId] = useState("");
  const [reviewPrompt, setReviewPrompt] = useState(DEFAULT_REVIEW_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE_PROMPT);
  const [optName, setOptName] = useState(false);
  const [optTourGuide, setOptTourGuide] = useState(false);
  const [optUnitType, setOptUnitType] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchProperty = async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .limit(1)
        .single();

      // PGRST116 = no rows found → create mode, not an error
      if (error?.code === "PGRST116" || !data) {
        setLoading(false);
        return;
      }

      if (error) {
        setLoading(false);
        return;
      }

      setPropertyId(data.id);
      setName(data.name);
      setSlug(data.slug);
      setLogoUrl(data.logo_url ?? "");
      setBrandColor(data.brand_color);

      // Extract Place ID from stored Google review URL
      const match = data.google_review_url.match(/placeid=([^&]+)/);
      setPlaceId(match ? match[1] : "");

      setReviewPrompt(data.review_prompt);
      setNegativePrompt(data.negative_prompt);

      const optFields = data.optional_fields as {
        name: boolean;
        tour_guide: boolean;
        unit_type: boolean;
      };
      setOptName(optFields.name ?? false);
      setOptTourGuide(optFields.tour_guide ?? false);
      setOptUnitType(optFields.unit_type ?? false);

      setLoading(false);
    };

    fetchProperty();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);

    const googleReviewUrl = placeId
      ? `https://search.google.com/local/writereview?placeid=${placeId}`
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
    };

    let errorMsg: string | null = null;

    if (propertyId) {
      const { error } = await supabase
        .from("properties")
        .update(payload)
        .eq("id", propertyId);
      if (error) errorMsg = error.message;
    } else {
      const { data, error } = await supabase
        .from("properties")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        errorMsg = error.message;
      } else if (data) {
        setPropertyId(data.id);
      }
    }

    setSaving(false);
    setSaveMsg(errorMsg ? `Error: ${errorMsg}` : "Settings saved.");
  };

  if (loading) {
    return (
      <div className="animate-pulse text-gray-400 py-8 text-sm">
        Loading settings...
      </div>
    );
  }

  const toggleStyle = (on: boolean) =>
    `w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${
      on ? "bg-[#10BD91]" : "bg-gray-200"
    }`;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        Property Settings
      </h1>

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
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
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
          <h2 className="text-sm font-semibold text-gray-700">
            Google Reviews
          </h2>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Google Place ID
            </label>
            <input
              type="text"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value.trim())}
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
        </div>

        {/* ── Review Prompts ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Review Prompts
          </h2>

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
              {
                label: "Reviewer Name",
                value: optName,
                set: setOptName,
              },
              {
                label: "Tour Guide Name",
                value: optTourGuide,
                set: setOptTourGuide,
              },
              {
                label: "Unit Type",
                value: optUnitType,
                set: setOptUnitType,
              },
            ] as const
          ).map(({ label, value, set }) => (
            <label
              key={label}
              className="flex items-center gap-3 cursor-pointer"
            >
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

        {saveMsg && (
          <p
            className={`text-xs px-3 py-2 rounded-lg ${
              saveMsg.startsWith("Error")
                ? "bg-red-50 text-red-600"
                : "bg-green-50 text-green-700"
            }`}
          >
            {saveMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
          style={{ background: "#10BD91" }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
