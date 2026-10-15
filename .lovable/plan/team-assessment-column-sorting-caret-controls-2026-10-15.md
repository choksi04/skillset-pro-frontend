# Team Assessment: column sorting (caret controls)

## What exists today
- The Team Assessment page loads every assessment in the user's scope (Admin: all; Manager: led domains + own domain), applies the archive filter, then search, format, status and verification filters (`filteredTeam`), then slices 10 per page. All of this runs in the browser over the full list, so sorting can go between filtering and paging.
- Each row's values come from shared helpers already used by the cells:
  - Employee: `getName(employee_id)` (user full name)
  - Assessment Details: `getAssessmentName(a)` (template name, or "Skill Registry Assessment")
  - Status: `getEffectiveStatus(...)` shown via `assessmentStatusConfig[status].label`
  - Achieved Level: `getAchievedLevelFromAttempt(...).level` (numeric; Fixed and Adaptive logic already inside)
  - Verified Level: `getVerifiedLevelFromReviews(...).level` (numeric; only from completed manager reviews)
- The page has no export, so there is nothing to keep in sync.

## Changes
1. New pure helper `src/lib/teamAssessmentSort.ts` (same shape as `teamRegistrySort.ts`):
   - Keys: `employee`, `assessment`, `status`, `achieved`, `verified`. Default Employee ascending.
   - `nextSort`: new column starts ascending, same column toggles; unknown key falls back to default.
   - Text compared case-insensitively and number-aware; levels compared numerically; 0 kept as a valid value; missing values (empty name, null level) last in both directions; tie-breaker by assessment ID.
2. `TeamAssessmentsPage.tsx`:
   - Sort state; build sortable values per row from the existing helpers (no new calculation), sort `filteredTeam`, then paginate.
   - Reset to page 1 when sort changes; sort stays when paging, searching or filtering.
   - The five headers become inner buttons (flex inside the cell, no change to cell display) with `ChevronsUpDown` / `ChevronUp` / `ChevronDown` at size 14, inactive at 70% opacity, active highlighted, `aria-sort` on the active header, `aria-label` + `title` describing the next action, no wrapping. Actions header unchanged.
3. Tests `src/lib/teamAssessmentSort.test.ts`: default, toggle, case-insensitive names, duplicate titles with ID tie-breaker, status by label, levels numeric with 0 valid and missing last both directions, achieved and verified sorted independently, unknown-key fallback.
4. User Guide: one line on Team Assessment sorting.

## Unchanged
My Assessment, Team Registry, assessment-taking, level calculations, filters, archive rules, role scope, pagination controls, footer layout and scrolling.

## Verification
Run unit tests; browser check as Admin: each column both directions across first/middle/last pages, with search, filters and Include archived, keyboard Tab+Enter, header alignment, footer position, desktop and mobile widths. Manager scope checked by code review (Microsoft sign-in only); results will state which checks were browser-verified.
