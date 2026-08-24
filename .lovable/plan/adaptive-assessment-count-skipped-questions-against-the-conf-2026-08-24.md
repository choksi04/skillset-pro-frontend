# Adaptive Assessment: count skipped questions against the configured total

## What QA saw
An adaptive assessment configured for 50 questions, submitted after only 10 answers, is
reported and scored as if it were a 10-question assessment. The other 40 disappear.

## What the code does today (verified)

- `adaptiveEngineStore.finalizeAdaptiveAttempt` builds every result artefact from
  `adaptive_state.skills[].history` — and history only receives an entry inside `recordAnswer`.
  So per-skill `question_count`, `avg_score`, the `ai_evaluations` rows and `total_ai_score`
  all use the *answered* count as the denominator.
- Questions never delivered are never written to `assessment_questions`, so the detail page
  lists only the delivered ones.
- The authoritative size of the attempt already exists in `adaptive_state.targetTotal`
  (with per-skill `quotas`), written at init — nothing at submit time reads it.
- Fixed assessments behave differently only because *all* their questions are materialised
  into `assessment_questions` upfront; the detail page already renders unanswered ones with
  the existing "Skipped" badge, and achieved level is evidence-based (max target level among
  questions scoring >= 50).

So the root cause is: adaptive submission derives the total from answers instead of from the
already-persisted `targetTotal`, and never materialises the undelivered questions.

## The fix (adaptive only, mirroring the Fixed structure)

At finalisation, bring the attempt up to its configured size before scoring.

1. **Materialise the remaining questions** (`finalizeAdaptiveAttempt`, before scoring)
   - For each skill, compute `quota - delivered`. Pull that many published MCQs for the skill
     (excluding `excludedQuestionIds`), using the same eligibility query the engine already
     uses for delivery, and insert them into `assessment_questions` exactly as delivery does.
   - Append them to that skill's `history` with `correct: false` and a `skipped: true` marker,
     then persist `adaptive_state` once. No `attempt_answers` rows are created, so nothing is
     duplicated and the detail page shows them with the existing "Skipped"/"Not answered" badge.
   - If the bank cannot supply enough questions, fall back to counting the shortfall as wrong
     without a question row (score denominator still uses `targetTotal`).

2. **Score against the full total** (same function, unchanged shape)
   - `question_count` per skill becomes the quota; `avg_score` = correct / quota.
   - `ai_evaluations` gains a score-0 row per skipped question with feedback
     "Not answered — counted as incorrect", matching how Fixed represents a zero-scored answer.
   - `calculated_level` stays "max level among correct answers" — skipping lowers the score,
     never inflates the level, which is the same evidence-based rule Fixed uses.

3. **One submit path**
   - Manual submit and timer auto-submit in `AdaptiveRunner` both already call `finalize()`,
     which calls `finalizeAdaptiveAttempt`. Fixing the store fixes both; no runner change is
     needed beyond the counter label reading `targetTotal` (already the case).

Result display components (`ResultSummaryCard`, `getAchievedLevelFromAttempt`, listings) need
no change: they read `history` and `ai_evaluations`, which now cover all 50.

## Files to change
- `src/stores/adaptiveEngineStore.ts` — materialise remaining questions + score against
  `targetTotal` inside `finalizeAdaptiveAttempt` (and the same denominator in
  `reconstructEvaluationsFromHistory` so backfilled attempts agree).

Fixed Assessment code paths (`attemptStore.submitAttempt`, `FixedRunner`) are untouched.

## Manual test steps
1. Adaptive template configured for 50 questions: answer 10, submit → summary shows
   50 total, 40 wrong/skipped, score ~20%, detail page lists 50 questions with 40 marked skipped.
2. Same setup but let the timer expire at 10 answers → identical result.
3. Answer all 50 → results identical to today (no skipped rows, no duplicates).
4. Re-open the submitted attempt → no extra questions appended on a second finalise.
5. A Fixed assessment submitted partially → behaves exactly as before.
