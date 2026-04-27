# Attempt & Evaluation Flow — Hardening Plan

## Current State (already implemented)

The four-step flow you described is largely in place. Quick audit:

| Step | Status | Where |
|---|---|---|
| **1. Attempt** — start, auto-save on navigation, pause/resume | ✅ Done | `attemptStore.startAttempt`, `saveAnswer`, `pauseAttempt`, `resumeAttempt`; `AssessmentExecPage` saves on every `goTo` |
| **2. Submission** — lock answers, increment count | ✅ / ⚠️ Partial | `submitAttempt` blocks re-submit; `assignmentStore.updateStatusForAssessment` increments `attempt_count` on first transition only |
| **3. Evaluation** — MCQ auto, AI for coding/scenario | ✅ Done | `supabase/functions/evaluate-assessment` splits MCQ (local `evaluateMCQ`) vs AI batch |
| **4. Failure → pending evaluation** | ⚠️ Weak | On error attempt stays `submitted` (UI labels it "Pending Evaluation") but no error reason, no user toast, no failure flag |

## Gaps to Fix

### 1. Failure handling is silent
Today, if `supabase.functions.invoke('evaluate-assessment')` fails or returns 429/402, `submitAttempt` swallows the error in a `console.error` and the user sees a generic "Pending Evaluation" badge with no idea what went wrong.

**Fix:**
- In `attemptStore.submitAttempt`, surface the error: throw it from the function (or return an error object) so `AssessmentExecPage.doSubmit` can show a `toast.error` with the actual reason ("AI credits exhausted", "Rate limit", "Network error", etc.).
- Store the last evaluation error on the attempt row (new column `evaluation_error TEXT NULL`) so the "Pending Evaluation" badge can show a tooltip with the reason and the user/admin knows whether to retry now or later.
- Update the badge in `AssessmentExecPage` and `AssessmentDetailPage` to expose the error message (tooltip or inline).

### 2. Retry path needs resilience
`retryEvaluation` already exists. We'll:
- Clear `evaluation_error` when retry starts.
- Keep the same submit pipeline (no duplicate code path).
- Toast success/failure on completion.

### 3. Attempt count on re-attempt (template flow)
`updateStatusForAssessment` only increments when transitioning `new → in_progress`. For template assignments with `max_attempts > 1`, when an employee re-attempts after a previous evaluated/verified attempt, the counter doesn't move.

**Fix:**
- In `assignmentStore.updateStatusForAssessment`, increment `attempt_count` whenever transitioning *into* `in_progress` from any terminal state (`evaluated`, `verified`) as well as from `new`.
- Guard against incrementing past `max_attempts` — if the assignment is already at the cap, surface a toast and block the new attempt before `startAttempt` runs.

### 4. Confirm lock semantics
`submitAttempt` already early-returns when status is `submitted` or `evaluated`. We'll add the same guard to `saveAnswer` so any in-flight auto-save after submit can't sneak through and mutate a locked attempt.

## Technical Changes

**Migration** (`supabase/migrations/...add_evaluation_error.sql`):
```sql
ALTER TABLE public.assessment_attempts
  ADD COLUMN evaluation_error TEXT NULL;
```

**`src/stores/attemptStore.ts`:**
- `saveAnswer`: early-return if attempt status ≠ `in_progress`.
- `submitAttempt`: on AI failure, persist `evaluation_error`, leave status as `submitted`, and re-throw so the caller can toast. On success, clear `evaluation_error`.
- `retryEvaluation`: clear `evaluation_error` before retrying; let errors propagate.
- Extend `AssessmentAttempt` type with `evaluation_error?: string | null`.

**`src/stores/assignmentStore.ts`:**
- `updateStatusForAssessment`: increment `attempt_count` on `* → in_progress` from any non-`in_progress` state (so re-attempts count).
- Add a `canStartNewAttempt(assignmentId)` helper that returns false when `attempt_count >= max_attempts` and the prior attempt is terminal.

**`src/pages/AssessmentExecPage.tsx`:**
- `doSubmit`: wrap `submitAttempt` in try/catch, show `toast.error(err.message)` on failure, `toast.success` on success.
- "Pending Evaluation" badge: show a tooltip with `attempt.evaluation_error` when present.
- Before `startAttempt`, call `canStartNewAttempt`; if false, toast and return.

**`src/pages/AssessmentDetailPage.tsx`** (manager view): mirror the same pending-evaluation tooltip so admins/managers can see *why* a result is stuck.

## Out of Scope
- No changes to the `evaluate-assessment` edge function (already handles MCQ vs AI split correctly and returns proper 429/402 codes).
- No changes to the adaptive runner (grades MCQs locally; not affected).
- No changes to scoring or skill-level math.

## Files Touched
- `supabase/migrations/<timestamp>_add_evaluation_error.sql` (new)
- `src/stores/attemptStore.ts`
- `src/stores/assignmentStore.ts`
- `src/pages/AssessmentExecPage.tsx`
- `src/pages/AssessmentDetailPage.tsx`
