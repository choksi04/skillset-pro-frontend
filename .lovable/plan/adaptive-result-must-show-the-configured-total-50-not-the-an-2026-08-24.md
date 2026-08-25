# Adaptive result must show the configured total (50), not the answered count (15)

## What the data shows (verified)

Queried the most recent adaptive attempts. The failing one (submitted today 07:57 UTC):

- `adaptive_state.targetTotal` = 50, `quotas` = 10 skills x 5 = 50
- per-skill `history` lengths = 2,2,2,2,2,1,1,1,1,1 → **15 total**
- `attempt_answers` = 15, `ai_evaluations` = 15, `assessment_questions` = 15

So the skipped questions were never materialised for this attempt: history, question rows and evaluation rows all stopped at 15. A comparison attempt from 06:52 the same day answered all 50 and looks correct.

Reviewed: `src/stores/adaptiveEngineStore.ts` (`materializeSkippedQuestions`, `finalizeAdaptiveAttempt`, `reconstructEvaluationsFromHistory`, `getSkillQuota`/`getTargetTotal`), `src/components/assessment/AdaptiveRunner.tsx` (single `finalize()` used by manual submit and by timer auto-submit), `src/lib/assessmentStatus.ts`, `src/components/assessment/ResultSummaryCard.tsx`.

Two problems explain "still 15":

1. **Already-submitted attempts never get repaired.** Attempts finalised before the backfill existed (this one included) keep a 15-entry history forever. Nothing re-runs the backfill for an `evaluated` attempt, so every result screen keeps reading 15.
2. **Every result screen derives the total from the history/eval rows, not from `targetTotal`.** `getAchievedLevelFromAttempt` and `ResultSummaryCard` sum `history.length`. If backfill can only partially fill a skill (question bank shortfall), or fails silently on an insert, the displayed total silently drops below the configured 50 again. The authoritative number `targetTotal` is persisted but never read by the display layer.

This is therefore both a persistence gap (old attempts) and a display-mapping gap (total taken from rows instead of the configured total). Scoring already uses the quota denominator and is correct.

## The fix (smallest atomic change)

**1. Self-heal submitted attempts** — `src/stores/adaptiveEngineStore.ts`
- Export a `repairAdaptiveAttempt(attemptId, assessmentId)` that loads the state, and when `history total < targetTotal`, runs the existing `materializeSkippedQuestions()` and then re-writes `attempt_skill_scores` / `ai_evaluations` / `total_ai_score` using the same code path finalisation uses (extract the scoring block already in `finalizeAdaptiveAttempt` into a small internal function so both call it — no new architecture, no duplicated logic).
- `reconstructEvaluationsFromHistory` drops its "evaluations already exist → return false" early exit only in the case where the history is short of `targetTotal`, delegating to the repair path. Idempotent: once history reaches the target, a second call is a no-op.

**2. Trigger the repair where submitted adaptive results are opened** — `src/pages/AssessmentDetailPage.tsx`
- The page already calls `reconstructEvaluationsFromHistory` for adaptive attempts on load; that same effect now covers the short-history case, so opening an existing 15/50 result repairs it once and re-renders at 50.

**3. Make the configured total authoritative in the display** — `src/lib/assessmentStatus.ts` and `src/components/assessment/ResultSummaryCard.tsx`
- For adaptive attempts, total = `max(sum of history lengths, targetTotal)`; correct stays as counted. Any residual gap (bank shortfall) is reported as wrong/skipped rather than shrinking the assessment.
- `ResultSummaryCard` per-skill rows use `max(history.length, quota)` the same way, so "Correct / Total" reads `1 / 5` per skill and the header reads `50` attempted, `15` answered-correct-or-wrong, remainder wrong.
- Fixed assessments take neither branch (no `adaptive_state.skills`), so their behaviour is untouched.

## Result after the fix

| Value | Source |
| --- | --- |
| Total configured questions | `adaptive_state.targetTotal` (50) |
| Answered | `attempt_answers` / history entries without `skipped` (15) |
| Skipped / unanswered | history entries with `skipped: true` + any bank shortfall (35) |
| Incorrect | wrong answers + all skipped |
| Score denominator | 50 (per-skill quota sum) |

Manual submit and timer auto-submit both go through `finalize()` → `finalizeAdaptiveAttempt`, so they stay identical.

## Files to change
- `src/stores/adaptiveEngineStore.ts`
- `src/pages/AssessmentDetailPage.tsx`
- `src/lib/assessmentStatus.ts`
- `src/components/assessment/ResultSummaryCard.tsx`

## Manual test steps
1. Open the existing 07:57 attempt (answered 15 of 50) → after load it shows 50 total, 35 skipped, score out of 50; question list shows 50 rows with 35 "Skipped".
2. Reload that page → no duplicate questions or evaluation rows, same numbers.
3. New adaptive attempt for 50: answer 10, submit manually → 50 total.
4. New adaptive attempt: answer a few, let the timer expire → identical result shape.
5. Answer all 50 → unchanged from today.
6. Skill whose bank has fewer questions than its quota → total still shows the configured count, shortfall counted as wrong.
7. A Fixed assessment result → unchanged.
