

# Fix: Allow Admin/Manager to Manage Assessment Questions Beyond "Pending" Status

## Problem
The assessment for Jagdish has 0 questions and status `in_progress`. The admin cannot see the Regenerate or Add/Remove question controls because `canManage` on line 75 requires `assessment.status === 'pending'`:

```typescript
const canManage = !isOwner && isAdmin && assessment?.status === 'pending';
```

Since the assessment transitioned to `in_progress`, the controls are hidden.

## Fix
Expand `canManage` to allow question management for any assessment that has not yet been submitted or evaluated. This means allowing it for statuses: `pending` and `in_progress`.

### Changes in `src/pages/AssessmentDetailPage.tsx`

**Line 75** — update the `canManage` condition:

```typescript
const canManage = !isOwner && isAdmin && ['pending', 'in_progress'].includes(assessment?.status ?? '');
```

This allows admins/managers to add questions, remove questions, and regenerate assessments that are still in progress (not yet submitted by the employee).

## Files Modified
- `src/pages/AssessmentDetailPage.tsx` — one line changed

