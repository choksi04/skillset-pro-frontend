## Problem

After clicking **Re-attempt** and going back to the assessments list (or detail page), the assessment shows **"Under Review"** instead of **"In Progress"**. The new attempt is correctly created, but the displayed status is wrong everywhere.

## Root cause

The status shown in the UI is computed by a helper called `getEffectiveStatus(...)`. It is **duplicated** in two places with the same logic:

- `src/pages/AssessmentsPage.tsx` (lines 17–24)
- `src/pages/AssessmentDetailPage.tsx` (lines 57–64)

```ts
function getEffectiveStatus(assessment, attempt, review) {
  if (review?.status === "completed") return "approved";
  if (review)                          return "review_pending"; // ← bug
  if (attempt?.status === "evaluated") return "evaluated";
  if (attempt?.status === "submitted") return "completed";
  if (attempt?.status === "in_progress" || assessment.status === "in_progress")
                                       return "in_progress";
  return assessment.status;
}
```

Two issues:

1. **Review check happens before attempt check.** A `manager_reviews` row created against the **previous** attempt still exists in the DB. After a re-attempt is started, the new attempt is `in_progress`, but the old review row makes `getEffectiveStatus` return `"review_pending"` → label "Under Review".
2. **Reviews are not matched to the current attempt.** The lookup is `reviews.find(r => r.assessment_id === assessment.id)`. Since `manager_reviews.attempt_id` exists in the schema, the review should be matched to the **current** (latest) attempt, not just the assessment.

There is also an inconsistency in the unified status vocabulary: the helpers still emit legacy values (`completed`, `review_pending`) instead of the canonical `submitted` / `under_review` already declared in `assessmentStatusConfig`.

Assignment status (`assessment_assignments.status`) is fine — `syncAssignmentForAttempt` already flips it back to `in_progress` when a re-attempt starts. The bug is purely in the UI's effective-status derivation.

## Plan

### 1. Centralise `getEffectiveStatus`

Create `src/lib/assessmentStatus.ts` exporting one helper used by every page/component. Delete the duplicates in `AssessmentsPage.tsx` and `AssessmentDetailPage.tsx`.

### 2. Fix the precedence and attempt-scoping

New logic, in priority order (latest attempt is authoritative; old reviews never override an active new attempt):

```text
1. If there is no attempt yet:
   → return assessment.status (pending / in_progress / …)

2. If the latest attempt is in_progress:
   → "in_progress"     (always — ignore any old review row)

3. If the latest attempt is submitted (awaiting AI):
   → "submitted"

4. Look up the review for THIS attempt only
   (reviews.find(r => r.attempt_id === attempt.id)):
     - review.status === "completed"  → "approved"
     - review exists (pending / in_progress) → "under_review"

5. If the latest attempt is evaluated (no review yet):
   → "evaluated"

6. Fallback:
   → assessment.status
```

This guarantees:
- A fresh re-attempt (in_progress) shows **"In Progress"** even though a review row from the prior attempt still exists.
- "Under Review" only appears when the **current** attempt actually has a manager review.
- "Approved" only appears when the review for the **current** attempt is completed.

### 3. Use canonical status keys

Return `submitted` and `under_review` (not the legacy `completed` / `review_pending`). `assessmentStatusConfig` in `src/stores/assessmentStore.ts` already maps both new and legacy keys, so badge colours/labels stay consistent across the app.

### 4. Update all call sites

Replace the local helpers in:
- `src/pages/AssessmentsPage.tsx` — list page (this is the screen the user reported).
- `src/pages/AssessmentDetailPage.tsx` — detail page; also update the `canManage` guard which reads `assessment.status` directly so it continues to work.
- `src/pages/TeamAssessmentsPage.tsx` — verify it uses the same helper (will be updated to import the centralised one).

### 5. Touch-up the detail page guard

In `AssessmentDetailPage.tsx`, `canManage` currently allows admin actions when `assessment.status` is `pending` or `in_progress`. After re-attempt the row’s `status` is already set to `in_progress` (we call `updateAssessmentStatus(..., 'in_progress')`), so this still works. No change needed beyond swapping the helper.

### 6. Status vocabulary reference (final, single source of truth)

| UI status      | When it shows                                                    | Source                          |
|----------------|------------------------------------------------------------------|---------------------------------|
| Not Started    | No attempt yet, assessment.status = pending                      | assessment row                  |
| In Progress    | Latest attempt is `in_progress` (covers re-attempts)             | latest attempt row              |
| Submitted      | Latest attempt is `submitted` (AI evaluation pending)            | latest attempt row              |
| Evaluated      | Latest attempt is `evaluated`, no review yet for this attempt    | attempt + review-by-attempt_id  |
| Under Review   | Review exists for the **current** attempt, not yet completed     | review-by-attempt_id            |
| Approved       | Review for the **current** attempt is `completed`                | review-by-attempt_id            |

### 7. No DB / schema changes

`manager_reviews.attempt_id` is already populated. `assessment_attempts.started_at` ordering is already used by `getAttemptForAssessment` to surface the latest attempt. Old review rows are kept untouched (history preserved).

## Files to change

- **New**: `src/lib/assessmentStatus.ts` — single `getEffectiveStatus(assessment, latestAttempt, reviews)` helper.
- `src/pages/AssessmentsPage.tsx` — import the new helper, drop the local copy, pass the full `reviews` array (so the helper can match by `attempt_id`).
- `src/pages/AssessmentDetailPage.tsx` — same replacement; remove the local copy.
- `src/pages/TeamAssessmentsPage.tsx` — align if it derives status the same way.

## Out of scope

- Per-attempt history UI (older attempts and their reviews remain in the DB but aren’t surfaced — same as today).
- Changing `assessment_assignments.status` mapping — already correct.
- Changing the canonical status labels in `assessmentStatusConfig` — already unified in a previous task.
