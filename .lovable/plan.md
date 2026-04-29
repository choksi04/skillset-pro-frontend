## Goal
1. In **My Assessments**, drop the "Skill Registry Assessment" fallback so only the actual template name appears (with domain as a quiet fallback when no template is linked).
2. Show **assigned date** and **assigned by** (assigner full name) on:
   - Each card in the My Assessments list
   - The Assessment Detail page header

## Data source
- `assessment_assignments` table holds `assigned_at` and `assigned_by` (text user id). Already exposed via `useAssignmentStore` with `getAssignmentByAssessmentId(assessmentId)` and `fetchAssignments()`.
- Assigner name resolved from `users.full_name` via a one-shot Supabase query keyed on the unique set of `assigned_by` ids.

## Changes

### `src/pages/AssessmentsPage.tsx` (My Assessments)
- Add imports: `useAssignmentStore`, `supabase`.
- Call `fetchAssignments()` in the existing init `useEffect`.
- Change `getAssessmentName(a)`:
  - If `template_id` matches a template → return template name.
  - Else → return the domain name (`domains.find(...)`) or empty string.
  - Remove the `'Skill Registry Assessment'` fallback entirely.
- After assessments load, build a `Set` of `assigned_by` ids from matching assignments and fetch `users.id, full_name` once → store in local `assignerNames` state map.
- In each card's secondary line, append:
  - `Assigned by {name} on {date}` (when assignment exists and `assigned_by` resolves)
  - `Assigned on {date}` (when assignment exists but no assigner — e.g. registry-generated)
  - Skip silently if no assignment record.

### `src/pages/AssessmentDetailPage.tsx`
- Replace the one-off `useAssignmentStore.getState().getAssignmentByAssessmentId(...)` call with a subscribed selector so the component re-renders when assignments load: `const { assignments, fetchAssignments, getAssignmentByAssessmentId } = useAssignmentStore();`
- Add `fetchAssignments()` to the init `useEffect`.
- Resolve assigner full name via a small Supabase lookup (mirrors current `employeeName` pattern at line ~86) when `assignment?.assigned_by` is present.
- In the header description block (around line 407–415), append a subtle line:
  - `Assigned by {assignerName} on {formattedDate}` when available
  - `Assigned on {formattedDate}` if assigner unknown
  - Omitted entirely when no assignment row exists.

## Out of scope
- No DB schema changes.
- No changes to Team Assessments list (assigner info isn't requested there).
- No changes to assignment creation logic.

## Files to edit
- `src/pages/AssessmentsPage.tsx`
- `src/pages/AssessmentDetailPage.tsx`
