# Team Registry sorting: caret icons + remove Registry Subject sort

## Current state (verified)
- `src/pages/TeamRegistryPage.tsx` (lines ~347–376): all five column headers (Team Member, Registry Subject, Status, Completion, Avg Rating) are rendered from one config array as sortable buttons with lucide `ArrowUp` / `ArrowDown` / `ArrowUpDown` icons; `aria-sort` on the active header; Registry Subject is `sort.key === 'subject'`.
- `src/lib/teamRegistrySort.ts`: `TeamRegistrySortKey = 'member' | 'subject' | 'status' | 'completion' | 'rating'`; `nextSort` (new column → asc, same → toggle); `valueOf` maps `subject` → `domainName`.
- Sort state is component-local `useState(DEFAULT_TEAM_REGISTRY_SORT)` — it is **not persisted anywhere**, so no saved sort can currently reference `subject`. A defensive guard is still added as requested.
- No test currently exercises `subject` sorting.

## Changes

### 1. `src/lib/teamRegistrySort.ts`
- Remove `'subject'` from `TeamRegistrySortKey`.
- Remove the `case 'subject'` branch from `valueOf`.
- In `nextSort`, if the incoming key is not one of the four supported keys (defensive guard, e.g. a hypothetical saved sort referencing `subject`), return `DEFAULT_TEAM_REGISTRY_SORT` (Team Member ascending).

### 2. `src/pages/TeamRegistryPage.tsx`
- Replace icon imports: `ArrowUp, ArrowDown, ArrowUpDown` → lucide `ChevronUp, ChevronDown, ChevronsUpDown` (caret icons, same library).
- Remove `['subject', 'Registry Subject', ...]` from the header config array.
- Render "Registry Subject" as a plain `<TableHead>` (same styling as the others, plus "Actions"): no button, no click handler, no icon, no `aria-sort`, no keyboard sorting control.
- Icon mapping for the four sortable headers:
  - Inactive: `ChevronsUpDown` (stacked up/down carets), `opacity-70`, visible without hover.
  - Active ascending: `ChevronUp` highlighted (full opacity + `text-foreground`).
  - Active descending: `ChevronDown` highlighted.
- Keep size 14, existing `aria-sort`, `aria-label` (e.g. "Sort by Status, currently ascending"), focus ring, and `handleSort` behavior (reset to page 1) unchanged.

### 3. `src/lib/teamRegistrySort.test.ts`
- Add one test: `nextSort` on the removed `'subject'` key falls back to `DEFAULT_TEAM_REGISTRY_SORT`.
- Existing tests (member/status/completion/rating, toggle, missing-last, tie-breaker) keep passing unchanged.

## Not changed
- `nextSort` ordering rules, numeric/label comparisons, missing-values-last, `latestId` tie-breaker.
- Pagination, search, filters, CSV export (uses `sortedRows` order), role restrictions, table layout (`min-w-[720px]`).

## Verification
- Run the sort unit tests (`bunx vitest run src/lib/teamRegistrySort.test.ts`).
- Typecheck (TS errors will surface in the build log).
- Browser check via Playwright (Admin session): all four headers show caret icons, Team Member active-ascending on load, clicking Status/Cycle toggles with highlighted caret, Registry Subject header has no icon and does not sort, keyboard Tab+Enter works, pagination and CSV order follow the sort.

## Acceptance mapping
1. Carets replace arrows on Team Member, Status, Completion, Avg Rating — yes.
2. Active direction visible via highlighted single caret — yes.
3. Registry Subject plain header, no sorting — yes (key removed from type + handler).
4. Remaining columns sort both directions — existing logic unchanged.
5. Pagination and CSV export follow the sort — unchanged, they read `sortedRows`.
