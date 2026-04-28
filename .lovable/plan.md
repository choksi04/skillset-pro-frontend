## Goals

Fix the post-submission assessment view so employees and managers can see meaningful per-question results, enable re-attempts, and clean up the manager review UI.

Remove the confidence level from the system, we don't need this as of MVP.

When Assessment questions are not generated yet, it is showing zero questions on the assessment card when user is opening the "My Assessment" page. It is showing wrong details as questions are not yet finalized.

---

## Root cause analysis

**Why "0 questions evaluated" / empty Per-Question Results:**

The assessment in question is **adaptive**. Adaptive MCQs are graded locally inside `adaptiveEngineStore.recordAnswer` / `finalizeAdaptiveAttempt` and the attempt is marked `evaluated` directly — but **no rows are ever written to `ai_evaluations**`. `EvalResults.tsx` iterates `attempt.ai_evaluations` to render the overall AI score, dimension averages, and the Per-Question Results section, so all three appear empty.

The fixed (non-adaptive) flow uses `evaluate-assessment` Edge Function, which DOES write `ai_evaluations`, so it works there.

**Why no Re-attempt button:** `AssessmentDetailPage` only shows Start (when `pending`) or Resume (when `in_progress`). It never renders a Re-attempt CTA when the attempt is `evaluated` or `submitted`, even though `canStartNewAttempt()` and `assignment.max_attempts` already support multiple attempts.

---

## Changes

### A. Adaptive engine — write per-question evaluations

`src/stores/adaptiveEngineStore.ts` › `finalizeAdaptiveAttempt`:

- For each entry in `skill.history`, insert an `ai_evaluations` row with:
  - `question_id`, `attempt_id`
  - `score`: 100 if `correct`, else 0
  - `feedback`: "Correct answer." / "Incorrect — selected option did not match the correct answer."
  - `dimensions`: `[]` (MCQ — no rubric dimensions, matches existing EvalResults handling that hides dimensions for MCQ)
- Update `useAttemptStore` local state with these evaluations so the UI reflects them without a full refetch.
- Recompute `total_ai_score` from these evaluations (currently it's an average of skill avg_scores — keep behaviour but also expose the per-question detail).

This makes adaptive results render identically to fixed results in `EvalResults` (Overall AI Score, Per-Question Results grouped by skill, with right/wrong badges via the existing MCQ correctness rendering).

### B. Re-attempt button on the detail page

`src/pages/AssessmentDetailPage.tsx`:

- After the attempt is `evaluated`/`submitted`/`reviewed`, if `canStartNewAttempt(assessment.id).allowed === true` AND `isOwner`, render a **"Re-attempt"** button (`RotateCcw` icon) alongside the existing CTAs.
- Clicking it calls the existing `handleStartRunner()` (which already handles assignment increment + status reset).
- Show a small helper line: `Attempt {attempt_count}/{max_attempts}` from the assignment.

### C. Manager review UI cleanup

`src/components/assessment/ManagerReviewPanel.tsx`:

- **Remove** the "View AI Feedback Details" toggle block (lines 238–266). The Per-Question Results from `EvalResults` already provides this information and is now shared between owner and manager views.
- Wrap the **Skill Review Table**, **Verify Section**, and **Manager Notes** in shadcn `Accordion` items so each section is collapsible. Default open: Skill Review Table.

`src/pages/AssessmentDetailPage.tsx`:

- Wrap the **Assessment Questions admin table** (lines 480–547) in a `Collapsible`, default **closed** when the assessment status is `completed`/`evaluated`/`approved` (manager viewing a submitted assessment). Default open when `pending`/`in_progress`.
- Wrap the **Skills list** line (lines 404–409) and **EvalResults** block in `Collapsible`s with sensible defaults (EvalResults open by default).

### D. Shared EvalResults usage (managers see same per-question results)

`EvalResults` is already rendered for both owner and manager (line 550 of AssessmentDetailPage gates only on `isEvaluated`). After change A, managers automatically get the same Per-Question Results with right/wrong badges and feedback. No changes needed there beyond what A delivers.

---

## Files to touch

- `src/stores/adaptiveEngineStore.ts` — write `ai_evaluations` rows in `finalizeAdaptiveAttempt`; update local attempt cache.
- `src/pages/AssessmentDetailPage.tsx` — add Re-attempt button; wrap admin question table and EvalResults in collapsibles.
- `src/components/assessment/ManagerReviewPanel.tsx` — remove "View AI Feedback Details" block; wrap sections in Accordion.

## Out of scope

- Routing the results into a separate URL/page — the detail page already IS a dedicated route (`/assessments/:id`, `/team-assessments/:id`). Per-question results stay on this page in the now-richer EvalResults section. (If a fully separate `/assessments/:id/results` route is desired, please confirm — current scope keeps results on the dedicated detail page.)
- Re-running AI evaluation on existing already-finalized adaptive attempts retroactively. The fix applies to new submissions; existing ones can be backfilled with a one-shot script if needed.