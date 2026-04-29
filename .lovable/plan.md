## Problem

Clicking **Re-attempt** on the Assessment Detail page shows a toast: *"This assessment has already been submitted."* and does nothing — even though the assignment still has attempts available.

### Root cause

`handleStartRunner` in `src/pages/AssessmentDetailPage.tsx` is shared by **Start**, **Resume**, AND **Re-attempt**. It contains a guard:

```ts
const existing = getAttemptForAssessment(assessment.id);
if (existing && (existing.status === "evaluated" | "submitted" | "reviewed")) {
  toast.info("This assessment has already been submitted."); // ← blocks re-attempt
  return;
}
```

`getAttemptForAssessment` returns the **first** attempt found for the assessment (a terminal one, after submission). The Re-attempt button never reaches `startAttempt`. The guard exists to protect Start/Resume, but it incorrectly fires for Re-attempt too.

### Secondary issue: status sprawl

Status values are inconsistent across layers, which is what caused the confusion in the first place:


| Layer                           | Field          | Values seen                                                                      |
| ------------------------------- | -------------- | -------------------------------------------------------------------------------- |
| `assessments.status`            | overall        | `pending`, `in_progress`, `completed`, `evaluated`, `review_pending`, `approved` |
| `assessment_attempts.status`    | per attempt    | `in_progress`, `submitted`, `evaluated`, `reviewed`                              |
| `assessment_assignments.status` | per assignment | `new`, `in_progress`, `submitted`, `evaluated`, `verified`                       |


Three terminology sets for "done": `completed` vs `submitted` vs `evaluated` vs `approved` vs `verified` vs `reviewed`. UI labels in `assessmentStatusConfig` add another layer ("Submitted", "Verified", "Under Review"). Hard to reason about, easy to mismatch.

## Plan

### 1. Fix the Re-attempt bug (primary)

**File:** `src/pages/AssessmentDetailPage.tsx`

Add an explicit re-attempt path that bypasses the "already submitted" guard.

- Add a `forceNewAttempt` flag (or a separate `handleReattempt`) so the Re-attempt button starts a fresh attempt regardless of any prior terminal attempt.
- Re-attempt path:
  1. Re-check `canStartNewAttempt(assessment.id)` (already done by `reattemptGate`).
  2. Skip the `existing && terminal-status` early-return. Prevent only if Manager has reviewed and approved.
  3. Call `startAttempt(...)` — which inserts a new `assessment_attempts` row.
  4. Reset `assessments.status` back to `in_progress`.
  5. `await fetchAttempts()` then enter the runner.
- Wire the Re-attempt button (line ~502) to `handleReattempt` instead of `handleStartRunner`.

### 2. Make `getAttemptForAssessment` return the latest attempt

**File:** `src/stores/attemptStore.ts` (line 422)

```ts
// before: returns first match (arbitrary order)
get().attempts.find((a) => a.assessment_id === assessmentId)

// after: return the most recent attempt
get().attempts
  .filter((a) => a.assessment_id === assessmentId)
  .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
```

This makes detail-page status, results card, and runner all reflect the **current** attempt after a re-attempt is started, instead of an old terminal one.

### 3. Consolidate and simplify statuses (clean-up)

Define a single canonical vocabulary and align all three tables + UI to it. No DB schema migration required (status columns are free `text`); this is a code/data-mapping change plus a one-time data normalization for any in-flight rows.

**Canonical statuses (use everywhere):**


| Stage                                | Code           | UI label     |
| ------------------------------------ | -------------- | ------------ |
| Not yet started                      | `pending`      | Not Started  |
| Employee working on it               | `in_progress`  | In Progress  |
| Employee submitted, awaiting AI eval | `submitted`    | Submitted    |
| AI evaluation done, awaiting manager | `evaluated`    | Evaluated    |
| Manager reviewing                    | `under_review` | Under Review |
| Manager finalised                    | `approved`     | Approved     |


Apply to all three tables (`assessments`, `assessment_attempts`, `assessment_assignments`). Drop the synonyms: `completed`, `verified`, `reviewed`, `new`. Map them on read:

- `completed` → `submitted`
- `reviewed` / `verified` → `approved`
- `new` → `pending`

**Files to update:**

- `src/stores/assessmentStore.ts` — `assessmentStatusConfig`, `AssessmentStatus` type, `updateAssessmentStatus` callers.
- `src/stores/attemptStore.ts` — `AssessmentAttempt.status` union, any string literals.
- `src/stores/assignmentStore.ts` — `AssignmentStatus` type, `syncAssignmentForAttempt`/`syncAssignmentForReview` mappings, `canStartNewAttempt` checks (`new`/`in_progress` → `pending`/`in_progress`).
- `src/pages/AssessmentDetailPage.tsx`, `src/pages/AssessmentsPage.tsx`, `src/pages/TeamAssessmentsPage.tsx`, `src/pages/ReviewsPage.tsx` — any hard-coded comparisons against the dropped strings.
- `src/components/registry/registryHelpers.ts` — derived registry status labels stay as-is (separate concept), but verify mappings still line up.

**Data normalization (one-shot UPDATE migrations):**

- `UPDATE assessments SET status='submitted' WHERE status='completed'`
- `UPDATE assessment_assignments SET status='pending' WHERE status='new'`
- `UPDATE assessment_assignments SET status='approved' WHERE status='verified'`
- `UPDATE assessment_attempts SET status='approved' WHERE status='reviewed'`

### 4. User Guide update

Per project memory rules, update the User Guide page (`src/pages/UserGuidePage.tsx`) with:

- The Re-attempt flow (when the button appears, attempt counter, max-attempts limit).
- The canonical 6-status list above with one-line definitions.

## Out of scope

- No changes to evaluation logic, AI prompts, or scoring.
- No template/assignment max-attempts UI changes.
- No registry-status changes (`registryHelpers.ts` `EmployeeStatus` is a separate, derived concept).

## Files to edit

- `src/pages/AssessmentDetailPage.tsx`
- `src/stores/attemptStore.ts`
- `src/stores/assessmentStore.ts`
- `src/stores/assignmentStore.ts`
- `src/pages/AssessmentsPage.tsx`
- `src/pages/TeamAssessmentsPage.tsx`
- `src/pages/ReviewsPage.tsx`
- `src/pages/UserGuidePage.tsx`
- One data-only SQL migration to normalize existing status rows.