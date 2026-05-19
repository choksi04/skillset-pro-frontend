import type { Assessment } from "@/stores/assessmentStore";
import type { AssessmentAttempt } from "@/stores/attemptStore";

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

/**
 * Shared "Achieved Level" derivation used by Assessment list, Team list, and
 * the detail Result Summary. Mirrors ResultSummaryCard exactly so the same
 * value is shown everywhere.
 *
 * Rule:
 *   - Prefer adaptive_state.skills[].history (max level among correct answers
 *     per skill, average across skills with ≥1 correct answer).
 *   - Fallback to attempt.skill_scores[].calculated_level (non-adaptive flow).
 *   - Returns null if no level can be derived.
 *
 * Also returns the underlying correct/total counts so the UI can show a
 * secondary "X / Y correct" label.
 */
export function getAchievedLevelFromAttempt(
  attempt: Pick<AssessmentAttempt, "skill_scores"> & { adaptive_state?: any } | null | undefined,
): { level: number | null; correct: number; total: number } {
  if (!attempt) return { level: null, correct: 0, total: 0 };

  const adaptive: any = (attempt as any).adaptive_state ?? {};
  const adaptiveSkills: any[] = Array.isArray(adaptive?.skills) ? adaptive.skills : [];

  if (adaptiveSkills.length > 0) {
    const perSkill = adaptiveSkills
      .filter((s) => Array.isArray(s.history) && s.history.length > 0)
      .map((s) => {
        const total = s.history.length;
        const correct = s.history.filter((h: any) => h.correct).length;
        const correctLevels = s.history
          .filter((h: any) => h.correct)
          .map((h: any) => h.level as number);
        const achieved = correctLevels.length ? Math.max(...correctLevels) : null;
        return { total, correct, achieved };
      });

    const totals = perSkill.reduce(
      (acc, b) => ({ correct: acc.correct + b.correct, total: acc.total + b.total }),
      { correct: 0, total: 0 },
    );
    const achievedLevels = perSkill
      .map((b) => b.achieved)
      .filter((l): l is number => typeof l === "number");
    const level = achievedLevels.length
      ? Math.round(achievedLevels.reduce((a, b) => a + b, 0) / achievedLevels.length)
      : null;

    return { level, correct: totals.correct, total: totals.total };
  }

  // Non-adaptive fallback (fixed runner) — use per-skill calculated_level.
  const ss = attempt.skill_scores ?? [];
  if (ss.length === 0) return { level: null, correct: 0, total: 0 };

  const totals = ss.reduce(
    (acc, s) => {
      const correct = Math.round((s.avg_score / 100) * s.question_count);
      return { correct: acc.correct + correct, total: acc.total + s.question_count };
    },
    { correct: 0, total: 0 },
  );
  const levels = ss.map((s) => s.calculated_level).filter((l): l is number => typeof l === "number");
  const level = levels.length
    ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
    : null;

  return { level, correct: totals.correct, total: totals.total };
}
