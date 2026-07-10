
# Revoke Assessment — Plan

## Goal
Let Admins/Managers revoke any assessment (new, in-progress, completed, or buggy) so a fresh one can be assigned from the same template. Existing "revoke" only works on `new` assignments via the Template sheet — extend it to any state and expose it from the assessment detail + team list.

## Behavior

- **Who can revoke:** Admin always; Manager only for their team members. Employees cannot.
- **What gets revoked:**
  - `assessment_assignments` → `status = 'revoked'`, soft-deleted (`deleted_on`, `deleted_by`).
  - `assessments` → soft-deleted (`deleted_on`).
  - `assessment_attempts` for that assessment → soft-deleted (so list pages/scoring stop seeing them).
  - `attempt_answers`, `ai_evaluations`, `attempt_skill_scores`, `assessment_questions`, `manager_reviews` → left in place (already scoped by attempt/assessment id and hidden once parent is soft-deleted; no need to touch, keeps audit trail).
  - `notifications` referencing the assessment → left in place but the action link will 404 gracefully (existing behavior for deleted assessments).
- **After revoke:** the template's "already assigned" guard clears (revoked/soft-deleted rows are excluded from `ACTIVE_STATUSES` filter), so Admin can immediately re-assign the same template to the same employee.
- **Confirmation:** blocking `AlertDialog` — "Revoke this assessment? The employee will lose all progress and answers. This cannot be undone." with a required reason textarea (stored on the assignment as `revoke_reason`).
- **Audit:** reason + `deleted_by` + `deleted_on` captured on the assignment row; assessment/attempt keep `deleted_by`.

## DB change

One migration:
- Add `revoke_reason TEXT` to `assessment_assignments`.
- Extend the `status` check/enum to include `'revoked'` (currently: new, in_progress, evaluated, verified) — inspect current constraint, drop & recreate with `'revoked'` added.

## Code changes

- **`src/stores/assignmentStore.ts`**
  - Add `revokeAssessment(assignmentId, reason)` that:
    1. Loads the assignment, resolves `assessment_id`.
    2. Soft-deletes `assessment_attempts` for that assessment.
    3. Soft-deletes the `assessments` row.
    4. Updates the assignment: `status='revoked'`, `deleted_on/by`, `revoke_reason`.
    5. Updates local zustand state and calls `assessmentStore.softDeleteAssessment` equivalent to keep caches consistent.
  - Keep the existing `revokeAssignment` for the "not-yet-started" path (only removes the assignment) — or fold both into one. Simpler: single `revokeAssessment` handling both cases (skip attempt/assessment cleanup when no `assessment_id`).
  - Ensure `ACTIVE_STATUSES` excludes `'revoked'` (it already excludes anything not in the list — verify).

- **`src/pages/AssessmentDetailPage.tsx`**
  - Add a red "Revoke assessment" button in the header (admin/manager only, hidden for the assessment owner unless admin). Opens confirm dialog with reason textarea. On success → toast + navigate back to `/team-assessments`.

- **`src/pages/TeamAssessmentsPage.tsx`**
  - Add "Revoke" row action in the actions menu for every non-revoked row.

- **`src/components/templates/TemplateAssignmentsSheet.tsx`**
  - Route its existing Revoke button through the new `revokeAssessment` so it works for started attempts too. Update the visible label/tooltip: "Revoke (loses progress)" when `assessment_id` is set.

- **`src/stores/assessmentStore.ts` / `attemptStore.ts`**
  - No API changes needed; the soft-delete already filters via `deleted_on IS NULL`. Verify `fetchAttemptsForAssessment` filters on `deleted_on` — add the filter if missing so revoked attempts stop appearing.

## Cross-impact checks

1. **Re-assign flow** — `assignTemplate` guard uses `ACTIVE_STATUSES.includes(a.status)`; `'revoked'` isn't in it, so re-assignment succeeds. ✓
2. **Skill Registry** — reads assessment scores only from non-deleted attempts; revoke hides prior scores, so the employee's registry status reverts to "in progress / not assessed" for that skill until the new attempt completes. Confirm no store fetches ignore `deleted_on`.
3. **Manager Review queue** — filters by assessment `status` and non-deleted; revoked assessment disappears from the queue. ✓
4. **Notifications** — old notification links to a soft-deleted assessment. `AssessmentDetailPage` already renders NotFound when the row is missing. ✓
5. **Analytics/HR dashboard** — currently disabled (under construction), no impact.
6. **Audit** — reason + user captured; assessment_questions/answers rows remain in DB (not visible via app due to soft-delete filters) so audit history is preserved.
7. **Duplicate revokes** — action disabled if `status === 'revoked'` or `deleted_on IS NOT NULL`.

## Verification

- Manual: revoke a `new` assignment → template can be re-assigned. Revoke an `in_progress` assessment → detail page 404s for employee, assignment row shows revoked, re-assign works, new attempt starts clean. Revoke a `completed` assessment → registry no longer shows that score, re-assign works.
- SQL: after revoke, `SELECT * FROM assessments WHERE id=… ` has `deleted_on` set; attempts too; assignment shows `status='revoked'`.
- Regression: ensure `AssessmentsPage` (My Assessments) and `TeamAssessmentsPage` don't list revoked rows.

## Out of scope
- Undo/restore of revoked assessments.
- Bulk revoke.
- Re-using the same assignment row (we create a new assignment on re-assign — cleaner audit).
