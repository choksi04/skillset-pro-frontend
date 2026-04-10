

# Convert Question Coverage Readiness Check from Error to Warning

## Problem
1. The readiness check for "Sufficient published questions" shows as a **red error** (destructive styling) even though it already doesn't block activation (line 802 excludes it).
2. There's also a **bug**: line 181 compares `q.competency_level` (now a UUID after migration) against `levelName` (a string like "Beginner"), so the match **always fails**, making every skill/level/type combo appear as a gap — inflating the error list.

## Changes

### `src/pages/ReviewCyclesPage.tsx`

**Fix the competency_level comparison (line 168-181)**:
- Use `getLevelToIdMap(levels)` instead of `getLevelToCompetencyMap(levels)` so the comparison matches UUID-to-UUID.

**Add a `type` field to readiness checks** to distinguish errors vs warnings:
- Change the check type to include `type: 'error' | 'warning'`
- Mark "Sufficient published questions" as `type: 'warning'`
- Mark "No other cycle currently active" as `type: 'warning'`
- All others remain `type: 'error'`

**Update the readiness UI rendering (lines 758-785)**:
- Warnings: amber/yellow styling (`bg-amber-50`, `text-amber-600`, warning icon)
- Errors: keep current red destructive styling
- Only errors block the "Proceed to Activate" button (already mostly correct, just clean up the disabled logic to use `type` field)

### Files Modified
- `src/pages/ReviewCyclesPage.tsx` — warning styling + UUID fix

