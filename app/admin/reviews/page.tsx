"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";

type ReviewRow = Tables<"reviews">;

export default function ReviewsPage() {
  const supabase = createBrowserClient();

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterRating, setFilterRating] = useState<number | "all">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data: propData } = await supabase
        .from("properties")
        .select("id")
        .limit(1)
        .single();

      if (!propData) {
        setLoading(false);
        return;
      }

      const { data: reviewData } = await supabase
        .from("reviews")
        .select("*")
        .eq("property_id", propData.id)
        .order("created_at", { ascending: false });

      setReviews(reviewData ?? []);
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const filteredReviews = useMemo(() => {
    return reviews
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
  }, [reviews, filterRating, filterDateFrom, filterDateTo]);

  const hasFilters =
    filterRating !== "all" || filterDateFrom !== "" || filterDateTo !== "";

  const clearFilters = () => {
    setFilterRating("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  if (loading) {
    return (
      <div className="animate-pulse text-gray-400 py-8 text-sm">
        Loading reviews...
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        All Reviews
      </h1>

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
        Showing {filteredReviews.length} of {reviews.length} review
        {reviews.length !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filteredReviews.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            {reviews.length === 0
              ? "No reviews yet."
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
                </tr>
              </thead>
              <tbody>
                {filteredReviews.map((review) => (
                  <tr
                    key={review.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 align-top transition-colors"
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
