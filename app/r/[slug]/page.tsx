"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Property } from "@/lib/validation";

type Screen = 1 | "2a" | "2b" | 3 | 4;

// ── Name behavior helper ─────────────────────────────────────────────────────

type NameBehavior = 'hidden' | 'optional' | 'required';

function getNameBehavior(requirement: string, rating: number): NameBehavior {
  if (requirement === 'hidden') return 'hidden';
  if (requirement === 'optional_all') return 'optional';
  if (requirement === 'required_all') return 'required';
  if (requirement === 'required_positive') return rating >= 4 ? 'required' : 'optional';
  if (requirement === 'required_negative') return rating <= 3 ? 'required' : 'optional';
  return 'required'; // safe fallback
}

// ── Google Prompt Screen ────────────────────────────────────────────────────
// Isolated component so its useEffect runs exactly once on mount
function GooglePromptScreen({
  reviewId,
  comment,
  googleReviewUrl,
  brandColor,
  onDone,
}: {
  reviewId: string;
  comment: string;
  googleReviewUrl: string;
  brandColor: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    // Auto-copy the submitted comment to clipboard
    const doCopy = async () => {
      try {
        await navigator.clipboard.writeText(comment);
        setCopied(true);
      } catch {
        // Silent fail — clipboard requires HTTPS; works on Vercel, not localhost
      }
    };
    doCopy();

    // Track that Google prompt was shown
    if (reviewId !== "honeypot") {
      fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_id: reviewId, google_prompt_shown: true }),
      }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShareOnGoogle = () => {
    if (reviewId !== "honeypot") {
      fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: reviewId,
          google_clicked: true,
          redirected_to_google: true,
        }),
      }).catch(() => {});
    }
    window.open(googleReviewUrl, "_blank", "noopener,noreferrer");
    setShowConfirmation(true);
  };

  const handleShareOutcome = (outcome: "confirmed" | "failed") => {
    if (reviewId !== "honeypot") {
      fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_id: reviewId, share_outcome: outcome }),
      }).catch(() => {});
    }
    onDone();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
      <div className="text-4xl mb-3">🎉</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        You&apos;re the best!
      </h2>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        It&apos;d really help our team if you shared this on Google too.
      </p>

      {comment && (
        <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left">
          <p className="text-sm text-gray-700 italic leading-relaxed">
            &ldquo;{comment}&rdquo;
          </p>
        </div>
      )}

      {copied ? (
        <p className="text-xs mb-4 flex items-center justify-center gap-1.5" style={{ color: "#10BD91" }}>
          <span>✓</span> Copied to clipboard
        </p>
      ) : (
        <p className="text-xs text-gray-400 mb-4">
          Just paste it when Google opens
        </p>
      )}

      {showConfirmation ? (
        <div className="space-y-3 mt-2">
          <p className="text-sm font-medium text-gray-700">
            Did your review post on Google?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleShareOutcome("confirmed")}
              className="flex-1 min-h-[48px] py-3 rounded-xl text-white font-semibold text-sm"
              style={{ backgroundColor: brandColor }}
            >
              Yes
            </button>
            <button
              onClick={() => handleShareOutcome("failed")}
              className="flex-1 min-h-[48px] py-3 rounded-xl text-gray-700 font-semibold text-sm bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={handleShareOnGoogle}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            className="w-full min-h-[48px] py-3 rounded-xl text-white font-bold text-sm mb-3 transition-opacity"
            style={{ backgroundColor: brandColor, opacity: btnHover ? 0.85 : 1 }}
          >
            Share on Google
          </button>

          <button
            onClick={onDone}
            className="w-full min-h-[48px] py-2 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
          >
            Maybe later
          </button>
        </>
      )}
    </div>
  );
}

// ── Star Row ────────────────────────────────────────────────────────────────
function StarRow({
  rating,
  isNegative,
  brandColor,
}: {
  rating: number;
  isNegative: boolean;
  brandColor: string;
}) {
  return (
    <div className="flex justify-center gap-1 mb-3">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className="text-2xl"
          style={{
            color: s <= rating ? (isNegative ? "#F59E0B" : brandColor) : "#E5E7EB",
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ── Optional Fields ──────────────────────────────────────────────────────────
function OptionalFields({
  reviewerName,
  onReviewerNameChange,
  tourGuide,
  onTourGuideChange,
  unitType,
  onUnitTypeChange,
  brandColor,
  showTourGuide,
  showUnitType,
  nameBehavior,
}: {
  reviewerName: string;
  onReviewerNameChange: (v: string) => void;
  tourGuide: string;
  onTourGuideChange: (v: string) => void;
  unitType: string;
  onUnitTypeChange: (v: string) => void;
  brandColor: string;
  showTourGuide: boolean;
  showUnitType: boolean;
  nameBehavior: NameBehavior;
}) {
  return (
    <>
      {nameBehavior !== 'hidden' && (
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Your Name{nameBehavior === 'optional' && (
              <span className="font-normal text-gray-400"> (optional)</span>
            )}
          </label>
          <input
            type="text"
            value={reviewerName}
            onChange={(e) => onReviewerNameChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none"
            onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${brandColor}33`)}
            onBlur={(e) => (e.target.style.boxShadow = "")}
          />
        </div>
      )}

      {showTourGuide && (
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Tour Guide Name{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={tourGuide}
            onChange={(e) => onTourGuideChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none"
            onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${brandColor}33`)}
            onBlur={(e) => (e.target.style.boxShadow = "")}
          />
        </div>
      )}

      {showUnitType && (
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Unit Type{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={unitType}
            onChange={(e) => onUnitTypeChange(e.target.value)}
            placeholder="e.g. 1BR, Studio"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none"
            onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${brandColor}33`)}
            onBlur={(e) => (e.target.style.boxShadow = "")}
          />
        </div>
      )}
    </>
  );
}

// ── Main Review Page ────────────────────────────────────────────────────────
export default function ReviewPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [screen, setScreen] = useState<Screen>(1);

  // Property
  const [property, setProperty] = useState<Property | null>(null);
  const [propertyLoading, setPropertyLoading] = useState(true);
  const [propertyError, setPropertyError] = useState<string | null>(null);

  // Review state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [suggestedComment, setSuggestedComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [reviewerName, setReviewerName] = useState("");
  const [tourGuide, setTourGuide] = useState("");
  const [unitType, setUnitType] = useState("");
  const [honeypot, setHoneypot] = useState(""); // must stay empty

  // UI state
  const [starSubmitting, setStarSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitBtnHover, setSubmitBtnHover] = useState(false);

  // Fetch property on mount
  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const res = await fetch(`/api/properties/${slug}`);
        if (!res.ok) {
          setPropertyError("Property not found.");
          return;
        }
        const data: Property = await res.json();
        setProperty(data);
      } catch {
        setPropertyError("Something went wrong loading this page.");
      } finally {
        setPropertyLoading(false);
      }
    };
    fetchProperty();
  }, [slug]);

  const handleStarTap = async (star: number) => {
    if (starSubmitting || !property) return;
    setRating(star);
    setSubmitError(null);

    const behavior = getNameBehavior(property.name_requirement, star);

    if (behavior === 'required') {
      // Skip partial save — navigate directly to the form screen
      if (star >= 4) {
        setScreen("2a");
        setCommentLoading(true);
        try {
          const genRes = await fetch("/api/generate-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rating: star }),
          });
          if (genRes.ok) {
            const { comment: suggested } = await genRes.json();
            setSuggestedComment(suggested);
          }
        } catch {
          // Silent fail — renter can type their own comment
        } finally {
          setCommentLoading(false);
        }
      } else {
        setScreen("2b");
      }
      return; // reviewId stays null
    }

    // Name NOT required — create partial review row immediately
    setStarSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: property.id, rating: star }),
      });

      if (!res.ok) {
        setSubmitError("Something went wrong. Please try again.");
        setRating(0);
        return;
      }

      const { reviewId: id } = await res.json();
      setReviewId(id);

      if (star >= 4) {
        setScreen("2a");
        setCommentLoading(true);
        try {
          const genRes = await fetch("/api/generate-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rating: star }),
          });
          if (genRes.ok) {
            const { comment: suggested } = await genRes.json();
            setSuggestedComment(suggested);
          }
        } catch {
          // Silent fail — renter can type their own comment
        } finally {
          setCommentLoading(false);
        }
      } else {
        setScreen("2b");
      }
    } catch {
      setSubmitError("Something went wrong. Please try again.");
      setRating(0);
    } finally {
      setStarSubmitting(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || submitting) return;

    const behavior = getNameBehavior(property.name_requirement, rating);

    if (behavior === 'required' && !reviewerName.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      let res: Response;

      if (reviewId) {
        // Partial row exists — update it
        res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            review_id: reviewId,
            comment,
            reviewer_name: reviewerName,
            tour_guide: tourGuide,
            unit_type: unitType,
            ai_generated_comment: suggestedComment,
          }),
        });
      } else {
        // No partial row — create complete review in one shot
        res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_id: property.id,
            rating,
            comment,
            reviewer_name: reviewerName,
            tour_guide: tourGuide,
            unit_type: unitType,
            ai_generated_comment: suggestedComment,
            honeypot,
          }),
        });
        if (res.ok) {
          const { reviewId: id } = await res.json();
          setReviewId(id); // needed for Google tracking on screen 3
        }
      }

      if (!res.ok) {
        setSubmitError("Something went wrong. Please try again.");
        return;
      }

      setScreen(rating >= 4 ? 3 : 4);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const brandColor = property?.brand_color ?? "#10BD91";

  // ── Loading / Error states ──
  if (propertyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (propertyError || !property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <p className="text-sm text-gray-500">
          {propertyError ?? "Property not found."}
        </p>
      </div>
    );
  }

  // ── Review flow disabled ──
  if (!property.review_flow_enabled) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          {property.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={property.logo_url}
              alt={property.name}
              className="h-12 mx-auto mb-4 object-contain"
            />
          )}
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {property.name}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Reviews are currently unavailable for this property. Please check
            back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-sm">
        {/* ── Screen 1: Star Rating ── */}
        {screen === 1 && (
          <>
            <div className="text-center mb-8">
              {property.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={property.logo_url}
                  alt={property.name}
                  className="h-12 mx-auto mb-3 object-contain"
                />
              )}
              <h1 className="text-lg font-semibold text-gray-900">
                {property.name}
              </h1>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                How was your tour?
              </h2>
              <p className="text-sm text-gray-500 mb-8">
                We&apos;d love to hear about your experience.
              </p>

              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleStarTap(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    disabled={starSubmitting}
                    className="text-5xl leading-none transition-transform active:scale-90 disabled:opacity-50 bg-transparent border-none cursor-pointer p-1 touch-manipulation"
                    style={{
                      color:
                        star <= (hoverRating || rating)
                          ? brandColor
                          : "#D1D5DB",
                      opacity:
                        hoverRating > 0 && star <= hoverRating ? 0.6 : 1,
                    }}
                    aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                  >
                    ★
                  </button>
                ))}
              </div>

              {!starSubmitting && (
                <p className="text-xs text-gray-400">
                  Tap a star to rate
                </p>
              )}

              {starSubmitting && (
                <p className="text-xs text-gray-400 animate-pulse">
                  Saving...
                </p>
              )}

              {submitError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                  {submitError}
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Screen 2a: Positive Review (4–5 stars) ── */}
        {screen === "2a" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="text-center mb-6">
              <StarRow rating={rating} isNegative={false} brandColor={brandColor} />
              <h2 className="text-lg font-semibold text-gray-900">
                Glad you had a great experience!
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Here&apos;s a review to get you started — feel free to edit.
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  {property.review_prompt}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={commentLoading}
                  placeholder={
                    commentLoading
                      ? "Loading suggestion..."
                      : suggestedComment || "Edit or keep this review as-is..."
                  }
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm resize-none focus:outline-none placeholder:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  onFocus={(e) =>
                    (e.target.style.boxShadow = `0 0 0 2px ${brandColor}33`)
                  }
                  onBlur={(e) => (e.target.style.boxShadow = "")}
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  A little more detail helps Google reviewers
                </p>
              </div>

              <OptionalFields
                reviewerName={reviewerName}
                onReviewerNameChange={setReviewerName}
                tourGuide={tourGuide}
                onTourGuideChange={setTourGuide}
                unitType={unitType}
                onUnitTypeChange={setUnitType}
                brandColor={brandColor}
                showTourGuide={property.optional_fields.tour_guide}
                showUnitType={property.optional_fields.unit_type}
                nameBehavior={getNameBehavior(property.name_requirement, rating)}
              />

              {/* Honeypot — hidden from real users, must stay empty */}
              <input
                type="text"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ display: "none" }}
              />

              {submitError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || commentLoading}
                onMouseEnter={() => !submitting && !commentLoading && setSubmitBtnHover(true)}
                onMouseLeave={() => setSubmitBtnHover(false)}
                className="w-full min-h-[48px] py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{
                  backgroundColor: brandColor,
                  opacity: submitBtnHover && !submitting && !commentLoading ? 0.85 : 1,
                }}
              >
                {submitting ? "Submitting..." : "Submit review"}
              </button>
            </form>
          </div>
        )}

        {/* ── Screen 2b: Negative Review (1–3 stars) ── */}
        {screen === "2b" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="text-center mb-6">
              <StarRow rating={rating} isNegative={true} brandColor={brandColor} />
              <h2 className="text-lg font-semibold text-gray-900">
                We appreciate your honesty
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Help us understand how we can improve.
              </p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  {property.negative_prompt}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What could we do better?"
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>

              <OptionalFields
                reviewerName={reviewerName}
                onReviewerNameChange={setReviewerName}
                tourGuide={tourGuide}
                onTourGuideChange={setTourGuide}
                unitType={unitType}
                onUnitTypeChange={setUnitType}
                brandColor={brandColor}
                showTourGuide={property.optional_fields.tour_guide}
                showUnitType={property.optional_fields.unit_type}
                nameBehavior={getNameBehavior(property.name_requirement, rating)}
              />

              {/* Honeypot — hidden from real users, must stay empty */}
              <input
                type="text"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ display: "none" }}
              />

              {submitError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                onMouseEnter={() => !submitting && setSubmitBtnHover(true)}
                onMouseLeave={() => setSubmitBtnHover(false)}
                className="w-full min-h-[48px] py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{
                  backgroundColor: brandColor,
                  opacity: submitBtnHover && !submitting ? 0.85 : 1,
                }}
              >
                {submitting ? "Submitting..." : "Submit feedback"}
              </button>
              <p className="text-xs text-center text-gray-400">
                Your feedback stays private with our team.
              </p>
            </form>
          </div>
        )}

        {/* ── Screen 3: Google Prompt ── */}
        {screen === 3 && reviewId && (
          <GooglePromptScreen
            reviewId={reviewId}
            comment={comment}
            googleReviewUrl={property.google_review_url}
            brandColor={brandColor}
            onDone={() => setScreen(4)}
          />
        )}

        {/* ── Screen 4: Thank You ── */}
        {screen === 4 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Thank you!
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Your feedback means a lot to us.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
