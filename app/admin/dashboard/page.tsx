"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useProperty } from "@/lib/property-context";
import type { Tables } from "@/lib/database.types";

type ReviewRow = Tables<"reviews">;

export default function DashboardPage() {
  const supabase = createBrowserClient();
  const { selectedProperty, loading: propertyLoading } = useProperty();

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  type SortColumn = "date" | "rating" | "name" | "comment" | "google";
  type SortDirection = "asc" | "desc";
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Re-fetch reviews whenever the selected property changes
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

  // Separate active and archived — must be before early returns
  const activeReviews = useMemo(
    () => reviews.filter((r) => !r.is_archived),
    [reviews]
  );

  const archivedReviews = useMemo(
    () => reviews.filter((r) => r.is_archived),
    [reviews]
  );

  const sortedReviews = useMemo(() => {
    const sorted = [...activeReviews];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "date":
          cmp =
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime();
          break;
        case "rating":
          cmp = a.rating - b.rating;
          break;
        case "name": {
          const aName = a.reviewer_name ?? "";
          const bName = b.reviewer_name ?? "";
          if (!aName && !bName) { cmp = 0; break; }
          if (!aName) { cmp = 1; break; }
          if (!bName) { cmp = -1; break; }
          cmp = aName.localeCompare(bName);
          break;
        }
        case "comment": {
          const aComment = a.comment ?? "";
          const bComment = b.comment ?? "";
          if (!aComment && !bComment) { cmp = 0; break; }
          if (!aComment) { cmp = 1; break; }
          if (!bComment) { cmp = -1; break; }
          cmp = aComment.localeCompare(bComment);
          break;
        }
        case "google":
          cmp =
            (a.redirected_to_google ? 0 : 1) -
            (b.redirected_to_google ? 0 : 1);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [activeReviews, sortColumn, sortDirection]);

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
        <p className="text-gray-500 text-sm mb-3">
          No property configured yet.
        </p>
        <a href="/admin/settings" className="text-[#10BD91] text-sm underline">
          Go to Settings to set up your property →
        </a>
      </div>
    );
  }

  const shareableLink = `${
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "")
  }/r/${selectedProperty.slug}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Silent fail
    }
  };

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const sortIndicator = (col: SortColumn) => {
    if (sortColumn !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>;
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

  // Stats — based only on active reviews
  const totalReviews = activeReviews.length;
  const positiveCount = activeReviews.filter((r) => r.rating >= 4).length;
  const positivePercent =
    totalReviews > 0 ? Math.round((positiveCount / totalReviews) * 100) : 0;
  const googleCount = activeReviews.filter((r) => r.redirected_to_google).length;
  const googlePercent =
    totalReviews > 0 ? Math.round((googleCount / totalReviews) * 100) : 0;

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {selectedProperty.name}
        </h1>

        {/* Shareable link */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <span className="text-xs text-gray-500 font-mono truncate max-w-[180px]">
            /r/{selectedProperty.slug}
          </span>
          <button
            onClick={handleCopyLink}
            className="text-xs font-medium px-2 py-1 rounded-lg bg-transparent border-none cursor-pointer"
            style={{ color: "#10BD91" }}
          >
            {linkCopied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">Total Reviews</p>
          <p className="text-3xl font-bold text-gray-900">{totalReviews}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">4–5 Star</p>
          <p className="text-3xl font-bold text-gray-900">{positiveCount}</p>
          {totalReviews > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {positivePercent}% of total
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">Google Shares</p>
          <p className="text-3xl font-bold text-gray-900">{googleCount}</p>
          {totalReviews > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {googlePercent}% of total
            </p>
          )}
        </div>
      </div>

      {/* Active reviews table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Recent Reviews
          </h2>
        </div>

        {reviewsLoading ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400 animate-pulse">
            Loading reviews...
          </div>
        ) : activeReviews.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            No reviews yet. Share your link to start collecting feedback.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th
                    className="px-6 py-3 text-left font-medium cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort("date")}
                  >
                    Date{sortIndicator("date")}
                  </th>
                  <th
                    className="px-6 py-3 text-left font-medium cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort("rating")}
                  >
                    Rating{sortIndicator("rating")}
                  </th>
                  <th
                    className="px-6 py-3 text-left font-medium cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort("name")}
                  >
                    Name{sortIndicator("name")}
                  </th>
                  <th
                    className="px-6 py-3 text-left font-medium cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort("comment")}
                  >
                    Comment{sortIndicator("comment")}
                  </th>
                  <th
                    className="px-6 py-3 text-left font-medium cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort("google")}
                  >
                    Google{sortIndicator("google")}
                  </th>
                  <th className="px-6 py-3 text-left font-medium" />
                </tr>
              </thead>
              <tbody>
                {sortedReviews.map((review) => (
                  <tr
                    key={review.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(review.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className="text-sm"
                        style={{
                          color: review.rating >= 4 ? "#10BD91" : "#F59E0B",
                        }}
                      >
                        {"★".repeat(review.rating)}
                        <span className="text-gray-200">
                          {"★".repeat(5 - review.rating)}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {review.reviewer_name ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600 max-w-xs">
                      {review.comment
                        ? review.comment.length > 80
                          ? review.comment.slice(0, 80) + "…"
                          : review.comment
                        : "—"}
                    </td>
                    <td className="px-6 py-3">
                      {review.share_outcome === "confirmed" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          Posted ✓
                        </span>
                      ) : review.share_outcome === "failed" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                          Didn&apos;t post
                        </span>
                      ) : review.google_clicked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          Shared
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleArchive(review.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer transition-colors"
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Archived reviews collapsible */}
      {archivedReviews.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowArchived((s) => !s)}
            className="w-full px-6 py-4 flex items-center justify-between text-left border-none bg-transparent cursor-pointer hover:bg-gray-50/50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-500">
              Archived Reviews ({archivedReviews.length})
            </span>
            <span className="text-xs text-gray-400">
              {showArchived ? "▲ Hide" : "▼ Show"}
            </span>
          </button>

          {showArchived && (
            <div className="border-t border-gray-100 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                    <th className="px-6 py-3 text-left font-medium">Date</th>
                    <th className="px-6 py-3 text-left font-medium">Rating</th>
                    <th className="px-6 py-3 text-left font-medium">Name</th>
                    <th className="px-6 py-3 text-left font-medium">Comment</th>
                    <th className="px-6 py-3 text-left font-medium">Google</th>
                    <th className="px-6 py-3 text-left font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {archivedReviews.map((review) => (
                    <tr
                      key={review.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors opacity-60"
                    >
                      <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(review.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className="text-sm"
                          style={{
                            color: review.rating >= 4 ? "#10BD91" : "#F59E0B",
                          }}
                        >
                          {"★".repeat(review.rating)}
                          <span className="text-gray-200">
                            {"★".repeat(5 - review.rating)}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        {review.reviewer_name ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 max-w-xs">
                        {review.comment
                          ? review.comment.length > 80
                            ? review.comment.slice(0, 80) + "…"
                            : review.comment
                          : "—"}
                      </td>
                      <td className="px-6 py-3">
                        {review.google_clicked ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            Shared
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => handleUnarchive(review.id)}
                          className="text-xs text-[#10BD91] hover:text-[#0da578] bg-transparent border-none cursor-pointer transition-colors"
                        >
                          Unarchive
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
