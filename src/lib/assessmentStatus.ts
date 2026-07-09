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
 * Per-skill error cap.
 *
 * When more than 50% of answers for a skill are wrong (avg_score < 50), the
 * calculated level for that skill is capped at `max(1, target_level - 1)` so
 * a barely-passing user can't inflate to the level the assessment targeted.
 * If `target_level` isn't known, we fall back to `max(1, calculated - 1)`.
 *
 * Adaptive attempts already respect this naturally (streaks) — we only apply
 * the cap on the fixed-runner code path.
 */
function applySkillErrorCap(s: {
  avg_score: number;
  calculated_level: number;
  target_level?: number;
}): number {
  const raw = Number(s.calculated_level) || 1;
  const errorRate = 1 - (Number(s.avg_score) || 0) / 100;
  if (errorRate <= 0.5) return raw;
  const target = Number(s.target_level) || 0;
  const ceiling = target > 0 ? target - 1 : raw - 1;
  return Math.max(1, Math.min(raw, ceiling));
}

/**
 * Shared "Achieved Level" derivation used by Assessment list, Team list, and
 * the detail Result Summary. Mirrors ResultSummaryCard exactly so the same
 * value is shown everywhere.
 *
 * Rule:
 *   - Prefer adaptive_state.skills[].history (max level among correct answers
 *     per skill, average across skills with ≥1 correct answer).
 *   - Fallback to attempt.skill_scores[].calculated_level (non-adaptive flow),
 *     with a >50%-wrong error cap applied per skill.
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

  // Non-adaptive fallback (fixed runner) — use per-skill calculated_level with error cap.
  const ss = attempt.skill_scores ?? [];
  if (ss.length === 0) return { level: null, correct: 0, total: 0 };

  const totals = ss.reduce(
    (acc, s) => {
      const correct = Math.round((s.avg_score / 100) * s.question_count);
      return { correct: acc.correct + correct, total: acc.total + s.question_count };
    },
    { correct: 0, total: 0 },
  );
  const cappedLevels = ss.map((s) => applySkillErrorCap(s));
  const level = cappedLevels.length
    ? Math.round(cappedLevels.reduce((a, b) => a + b, 0) / cappedLevels.length)
    : null;

  return { level, correct: totals.correct, total: totals.total };
}

/**
 * Verified Level derivation — the manager-approved final level.
 *
 * Returns the rounded average of `skill_reviews[].verified_level` from the
 * completed review for the given attempt. When the underlying attempt is
 * provided, each skill's verified level is additionally capped by the same
 * >50%-wrong error rule so a manager can only *reduce* — never inflate past
 * the evidence.
 *
 * Returns `{ level: null }` if no completed review exists for that attempt.
 */
export function getVerifiedLevelFromReviews(
  reviews: Array<{
    attempt_id?: string;
    status: string;
    skill_reviews?: Array<{ skill_id?: string; verified_level?: number | null }>;
  }>,
  attemptId: string | null | undefined,
  attempt?: Pick<AssessmentAttempt, "skill_scores"> | null,
): { level: number | null } {
  if (!attemptId) return { level: null };
  const review = reviews.find(
    (r) => r.attempt_id === attemptId && r.status === "completed",
  );
  if (!review) return { level: null };

  const capBySkill = new Map<string, number>();
  (attempt?.skill_scores ?? []).forEach((s) => {
    capBySkill.set(s.skill_id, applySkillErrorCap(s));
  });

  const lvls = (review.skill_reviews ?? [])
    .map((sr) => {
      if (typeof sr.verified_level !== "number") return null;
      const cap = sr.skill_id ? capBySkill.get(sr.skill_id) : undefined;
      return typeof cap === "number" ? Math.min(sr.verified_level, cap) : sr.verified_level;
    })
    .filter((l): l is number => typeof l === "number");
  if (lvls.length === 0) return { level: null };
  return { level: Math.round(lvls.reduce((a, b) => a + b, 0) / lvls.length) };
}
