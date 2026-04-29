import type { Assessment } from "@/stores/assessmentStore";

/**
 * Canonical, attempt-aware status derivation for an assessment.
 *
 * Priority (the LATEST attempt is authoritative — old reviews from a prior
 * attempt must never override a fresh in-progress re-attempt):
 *
 *   1. No attempt yet                              → assessment.status
 *   2. Latest attempt is in_progress               → "in_progress"
 *   3. Latest attempt is submitted                 → "submitted"
 *   4. Review exists for THIS attempt:
 *        - review.status === "completed"           → "approved"
 *        - review pending / in_progress            → "under_review"
 *   5. Latest attempt is evaluated, no review yet  → "evaluated"
 *   6. Fallback                                    → assessment.status
 *
 * Returns canonical keys (`submitted`, `under_review`) — `assessmentStatusConfig`
 * also maps the legacy aliases (`completed`, `review_pending`).
 */
export function getEffectiveStatus(
  assessment: Pick<Assessment, "status">,
  attempt: { id: string; status: string } | null | undefined,
  reviews: Array<{ attempt_id?: string; assessment_id?: string; status: string }> = [],
): string {
  if (!attempt) return assessment.status;

  if (attempt.status === "in_progress") return "in_progress";
  if (attempt.status === "submitted") return "submitted";

  // Match the review to THIS attempt only. Reviews from older attempts on the
  // same assessment must not bleed into the current attempt's status.
  const review = reviews.find((r) => r.attempt_id === attempt.id);

  if (review) {
    if (review.status === "completed") return "approved";
    return "under_review";
  }

  if (attempt.status === "evaluated") return "evaluated";
  if (attempt.status === "reviewed") return "approved";

  return assessment.status;
}
