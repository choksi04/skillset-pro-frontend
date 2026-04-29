## Problem

Two issues with the "Re-attempt" flow:

1. **No confirmation** — clicking Re-attempt immediately starts a new attempt with no warning that it creates a fresh attempt and consumes one of the remaining attempts.
2. **Re-attempt does not actually start a new attempt** — after clicking Re-attempt the UI briefly shows "Creating assessment" and then jumps straight to the completed/evaluated result screen, as if the assessment was already done.

### Root cause for issue 2

`useAttemptStore.startAttempt` (in `src/stores/attemptStore.ts`) short-circuits if **any** attempt already exists for the assessment:

```ts
const existing = get().attempts.find((a) => a.assessment_id === assessmentId);
if (existing) return existing.id;
```

So when an employee clicks Re-attempt, no new `assessment_attempts` row is inserted. The existing terminal attempt (`status = evaluated`) is reused, the assignment counter never increments, and the runner immediately renders the previous evaluated result instead of a fresh empty attempt.

Additionally, `AssessmentDetailPage.handleStartRunner` only calls `startAttempt` and then sets `runnerActive = true`, but it does **not** pass any "force new attempt" hint into the store, and the runner uses `getAttemptForAssessment` which (correctly) returns the most recent attempt — which is still the old terminal one.

## Plan

### 1. Add a confirmation dialog for Re-attempt

In `src/pages/AssessmentDetailPage.tsx`:

- Add a new state `confirmReattempt: boolean`.
- The "Re-attempt" button no longer calls `handleReattempt` directly; it opens the confirmation dialog.
- The dialog shows:
  - Title: "Start a new attempt?"
  - Description: explains that this creates a fresh attempt from scratch (previous answers and results stay on record but a new evaluation will replace the displayed result), it will count as attempt `N+1` of `max_attempts`, and the timer restarts.
  - Cancel / "Start New Attempt" actions.
- Confirming calls `handleReattempt()` which calls `handleStartRunner(true)`.

Reuse the existing `<AlertDialog>` component already imported in this file — no new dependencies.

### 2. Make Re-attempt actually create a new attempt row

In `src/stores/attemptStore.ts`:

- Change `startAttempt` signature to accept an optional `forceNew` flag:
  ```ts
  startAttempt: (assessmentId, tenantId, employeeId, forceNew?: boolean) => Promise<string>
  ```
- Behavior:
  - If `forceNew` is **false/undefined**: keep current behavior — if there is an **active** (`in_progress`) attempt, return it (resume). Do **not** return terminal attempts; if the only existing attempts are terminal, fall through to insert a new row. (This also hardens the normal start path.)
  - If `forceNew` is **true**: always insert a new `assessment_attempts` row with `status = 'in_progress'`, fresh `started_at`, empty answers, no `paused_at`, no `remaining_seconds`, no evaluations.
- Update the local Zustand state to append the new attempt so `getAttemptForAssessment` (which sorts by `started_at` desc) immediately surfaces the new in-progress row to the runner.

### 3. Wire the flag through the page

In `src/pages/AssessmentDetailPage.tsx` `handleStartRunner(forceNewAttempt)`:

- Pass `forceNewAttempt` into `startAttempt(...)` so re-attempts insert a brand-new row.
- After `startAttempt`, call `fetchAttempts()` (already done) so the local cache reflects the new attempt id, then enter the runner.
- Keep the existing guard that blocks re-attempts when the manager has already approved the review.

### 4. Make sure the assignment attempt counter increments correctly

`assignmentStore.updateStatusForAssessment` already increments `attempt_count` when transitioning into `in_progress` from a non-`in_progress` state. After the fix:

- A terminal assignment (e.g. `evaluated`) will transition to `in_progress` when the new attempt starts, so `attempt_count` increments by 1.
- The "Attempt N/Max" label next to the Re-attempt button will reflect the new count after `fetchAssignments()` runs (already triggered by `syncAssignmentForAttempt` inside `startAttempt`).

### 5. Runner behavior

No changes needed in `FixedRunner` / `AdaptiveRunner`. They read the current attempt via `getAttemptForAssessment(assessment.id)` which already returns the most recent attempt. Once a fresh `in_progress` row exists, the runner will render an empty assessment with a fresh timer — exactly like a first attempt — while the old terminal attempt and its evaluations remain in the database for history.

## Files to change

- `src/stores/attemptStore.ts` — extend `startAttempt` with `forceNew` and only short-circuit on an in-progress attempt.
- `src/pages/AssessmentDetailPage.tsx` — add `confirmReattempt` state + `<AlertDialog>`, route the Re-attempt button through it, and pass `forceNewAttempt` into `startAttempt`.

No DB schema changes are required — the existing `assessment_attempts` table already supports multiple rows per assessment, and `assessment_assignments.attempt_count` / `max_attempts` already track quotas.

## Out of scope

- Showing per-attempt history in the UI (older terminal attempts will continue to exist in the DB but are not surfaced; only the latest attempt drives the result view, matching today's behavior).
- Changing the status vocabulary (already unified in the previous task).
