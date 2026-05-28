"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useProperty } from "@/lib/property-context";
import type { Tables } from "@/lib/database.types";

type ReviewRow = Tables<"reviews">;

export default function ReviewsPage() {
  const supabase = createBrowserClient();
  const { selectedProperty, loading: propertyLoading } = useProperty();

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const [archiveView, setArchiveView] = useState<"active" | "archived">("active");
  const [filterRating, setFilterRating] = useState<number | "all">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Re-fetch whenever the selected property changes
  useEffect(() => {
    if (!selectedProperty) return;

    const fetchReviews = async () => {
      setReviewsLoading(true);
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("property_id", selectedProperty.id)
        .order("created_at", { ascending: false });

      setReviews(data ?? []);
      setReviewsLoading(false);
    };

    fetchReviews();
  }, [selectedProperty, supabase]);

  const filteredReviews = useMemo(() => {
    return reviews
      .filter((r) =>
        archiveView === "active" ? !r.is_archived : r.is_archived
      )
      .filter((r) => filterRating === "all" || r.rating === filterRating)
      .filter(
        (r) =>
          !filterDateFrom ||
          new Date(r.created_at) >= new Date(filterDateFrom)
      )
      .filter(
        (r) =>
          !filterDateTo ||
          new Date(r.created_at) <= new Date(filterDateTo + "T23:59:59")
      );
  }, [reviews, archiveView, filterRating, filterDateFrom, filterDateTo]);

  const viewTotal = useMemo(
    () =>
      reviews.filter((r) =>
        archiveView === "active" ? !r.is_archived : r.is_archived
      ).length,
    [reviews, archiveView]
  );

  const hasFilters =
    filterRating !== "all" || filterDateFrom !== "" || filterDateTo !== "";

  const clearFilters = () => {
    setFilterRating("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const handleArchive = async (id: string) => {
    await supabase
      .from("reviews")
      .update({ is_archived: true })
      .eq("id", id);
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_archived: true } : r))
    );
  };

  const handleUnarchive = async (id: string) => {
    await supabase
      .from("reviews")
      .update({ is_archived: false })
      .eq("id", id);
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_archived: false } : r))
    );
  };

  if (propertyLoading) {
    return (
      <div className="animate-pulse text-gray-400 py-8 text-sm">
        Loading...
      </div>
    );
  }

  if (!selectedProperty) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm mb-3">No property selected.</p>
        <a href="/admin/settings" className="text-[#10BD91] text-sm underline">
          Go to Settings →
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Reviews — {selectedProperty.name}
        </h1>

        {/* Active / Archived pill toggle */}
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setArchiveView("active")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              archiveView === "active"
                ? "bg-[#10BD91] text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setArchiveView("archived")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 ${
              archiveView === "archived"
                ? "bg-[#10BD91] text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Rating
          </label>
          <select
            value={filterRating}
            onChange={(e) =>
              setFilterRating(
                e.target.value === "all" ? "all" : Number(e.target.value)
              )
            }
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
          >
            <option value="all">All ratings</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} star{r !== 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            From
          </label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            To
          </label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10BD91]/20"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 bg-transparent border border-gray-200 rounded-lg cursor-pointer transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-3">
        Showing {filteredReviews.length} of {viewTotal} {archiveView} review
        {viewTotal !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {reviewsLoading ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400 animate-pulse">
            Loading reviews...
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            {viewTotal === 0
              ? archiveView === "active"
                ? "No active reviews yet."
                : "No archived reviews."
              : "No reviews match your filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Rating</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Comment</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Tour Guide
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Unit Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Google</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviews.map((review) => (
                  <tr
                    key={review.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 align-top transition-colors ${
                      review.is_archived ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(review.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: review.rating >= 4 ? "#10BD91" : "#F59E0B",
                        }}
                      >
                        {"★".repeat(review.rating)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {review.reviewer_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                      {review.comment ? (
                        <span className="block leading-relaxed">
                          {review.comment}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {review.tour_guide ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {review.unit_type ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {review.google_clicked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 whitespace-nowrap">
                          Shared
                        </span>
                      ) : review.google_prompt_shown ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 whitespace-nowrap">
                          Prompted
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {review.is_archived ? (
                        <button
                          onClick={() => handleUnarchive(review.id)}
                          className="text-xs text-[#10BD91] hover:text-[#0da578] bg-transparent border-none cursor-pointer transition-colors whitespace-nowrap"
                        >
                          Unarchive
                        </button>
                      ) : (
                        <button
                          onClick={() => handleArchive(review.id)}
                          className="text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer transition-colors whitespace-nowrap"
                        >
                          Archive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
