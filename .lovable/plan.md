## Goal

On the **My Assessment** detail page (employee viewing their own submitted assessment), show the list of attempted questions with **correct / wrong** results inline.

## Current behavior (verified)

- `EvalResults` already renders per-question results with right/wrong badges and AI feedback. It is rendered for both owner and manager when `attempt.status` is `evaluated` / `reviewed`.
- The user's current attempt (`61141411…`) has:
  - status = `evaluated`, `total_ai_score` = 13
  - **16 `attempt_answers` rows but 0 `ai_evaluations` rows**
- Reason: this adaptive attempt was finalized **before** the recent fix that writes `ai_evaluations` rows during `finalizeAdaptiveAttempt`. So `EvalResults` shows "Overall AI Score 13" but the per-question section is empty.
- The Assessment Questions table is currently gated `!isOwner` — owners never see the question list, only managers do.

## Plan

### 1. Backfill `ai_evaluations` for adaptive attempts missing them
Add a one-time, on-demand reconstruction helper invoked from `AssessmentDetailPage` when:
- `attempt.status` is `submitted` / `evaluated` / `reviewed`, AND
- `attempt.ai_evaluations.length === 0`, AND
- `attempt.adaptive_state` contains a `skills[].history` array with `{question_id, correct}` entries.

Behavior:
- For each history entry, insert an `ai_evaluations` row: `score = correct ? 100 : 0`, `feedback = "Correct answer." | "Incorrect — review the correct option."`, `confidence = 100`, `dimensions = []`.
- Recompute `attempt_skill_scores` (avg + level) and `assessment_attempts.total_ai_score` from those rows so the cards reflect reality (the current `13` is stale).
- Idempotent: skip if rows already exist.
- Triggered automatically once on detail-page load when the gap is detected; also exposed as a "Recompute results" button in the existing pending-evaluation strip for safety.

### 2. Show the question list to the owner on submitted assessments
Currently the **Assessment Questions** collapsible is `!isOwner && isAdmin`. Extend it so it also renders for the owner once the attempt is terminal (`submitted` / `evaluated` / `reviewed`). For owners:
- Hide the admin-only Action column and the "Add Question" button (no editing).
- Default `Collapsible` open so the user immediately sees the list of attempted questions.
- Keep the same columns: `#`, Question, Skill, Level, Type.

### 3. Per-question Result column for owners
Inside this owner-visible question list, add a **Result** column showing:
- `✓ Correct` (success) / `✗ Incorrect` (destructive) badge derived from the matching `ai_evaluations` row (`score >= 50` ⇒ correct for non-MCQ, MCQ uses score === 100).
- `—` if there is still no evaluation for that question.

This gives a quick scannable list. The full per-question breakdown (employee answer, correct option, AI feedback) remains available below in the existing `EvalResults` "Per-Question Results" section, which the backfill in step 1 will now populate.

### 4. Surface the question list section regardless of `isEvaluated`
The "Evaluation Results" `Collapsible` is already gated by `isEvaluated`. After the backfill runs, the existing attempt becomes properly populated and this section will work as designed for both owner and manager — no further change needed there.

## Files to touch

- `src/stores/adaptiveEngineStore.ts` — add `reconstructEvaluationsFromHistory(attemptId)` helper that performs the backfill described in step 1 (also recomputes `attempt_skill_scores` + `total_ai_score`).
- `src/pages/AssessmentDetailPage.tsx`
  - On mount / when attempt is loaded, detect the gap and call the helper, then `fetchAttempts()`.
  - Loosen the Assessment Questions gate so owners see it on terminal attempts (read-only) with a new `Result` column.
- No DB migration required (uses existing tables/columns).

## Out of scope

- Changing the AI evaluation pipeline for fixed (non-adaptive) assessments — that path already writes `ai_evaluations` correctly.
- Reworking the manager view (already updated in the previous turn).