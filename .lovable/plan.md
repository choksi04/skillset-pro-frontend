## Problem

On **Team Registry** and **Team Assessments** listing pages, after the skeleton disappears the rows briefly show the raw `employee_id` (a UUID-like string) before flashing to the actual employee name.

Root cause: both pages fetch user names in a separate `useEffect` *after* the registries/assessments resolve. Until that second query returns, the render falls back to the raw ID:

- `TeamRegistryPage.tsx` → `userNames[empId] || empId`
- `TeamAssessmentsPage.tsx` → `getName(id)` returns `userNames[id] || id`

## Fix

Treat the user-name lookup as part of the initial-load gate, and never render a raw ID as a fallback.

### `src/pages/TeamRegistryPage.tsx`

1. Add a `namesLoading` state, defaulting to `true` whenever there are employee IDs to resolve.
2. In the `useEffect` that fetches users:
   - If `employeeIds.length === 0` → set `namesLoading` to `false` immediately.
   - Otherwise, set `namesLoading` to `true` before the query, and `false` in the `.then(...)` after `userNames` is set (including on error).
3. Extend the skeleton condition from `loading && !initialized` to `(loading && !initialized) || namesLoading`. This keeps the existing skeleton rows visible until the names are ready, so users never see a row appear with a raw ID.
4. Replace the fallback `userNames[empId] || empId` with `userNames[empId] || '—'` as a safety net (the gate above means this should rarely render, but if a user record is missing we show a neutral placeholder instead of a UUID).

### `src/pages/TeamAssessmentsPage.tsx`

1. Add the same `namesLoading` state, managed inside the existing `useEffect` that fetches users by `assessments.map(a => a.employee_id)`.
2. Extend the skeleton condition from `loading && !initialized` to `(loading && !initialized) || namesLoading`.
3. Update `getName` to return `userNames[id] || '—'` instead of `userNames[id] || id`.

### Notes

- No store changes — the fix is local to the two pages.
- Skeleton visuals remain identical; only their dismiss timing changes.
- Subsequent refreshes (after assessments/registries already loaded once) won't re-trigger the skeleton because `initialized` stays true; the small `namesLoading` window only occurs when new employee IDs appear, which is acceptable and doesn't show raw IDs.

## Files to edit

- `src/pages/TeamRegistryPage.tsx`
- `src/pages/TeamAssessmentsPage.tsx`

## Out of scope

- Other listing pages (already handled in earlier skeleton work and don't show user IDs).
- Refactoring user-name resolution into a shared store/hook (could be a follow-up but is not needed for this fix).
