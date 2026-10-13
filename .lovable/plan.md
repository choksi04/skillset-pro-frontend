# Team Registry: column sorting

## What exists today
- The Team Registry list loads all registries in the user's permitted scope (Admin: all; Manager: led domains + own domain), groups to the latest version per employee, and builds rows with shared metrics (`computeRegistryMetrics`) and shared status (`registryStatusConfig`).
- Search and filters run on that full list (`filteredRows`), then pagination slices 10 per page. All filtering and paging is in the browser over the full matching list, so sorting can be applied to the full list before paging — never just the visible page.
- No existing sort pattern or table-sort library in the project; icons come from lucide-react.
- CSV export receives `filteredRows` but then re-sorts by name inside the export helper, so it would ignore any table sort.

## Changes
1. New small helper `src/lib/teamRegistrySort.ts` (pure, testable):
   - Keys: `member` (displayed name), `subject` (domain name), `status` (displayed label from `registryStatusConfig`), `completion` (`completionPct`), `rating` (`avgOnFive`).
   - Text: case-insensitive `localeCompare` (numeric-aware). Numbers: numeric compare; 0 is valid.
   - Missing values (empty name, null rating, metrics still loading) always last in both directions.
   - Tie-breaker: registry ID ascending, so order is stable across pages.
2. `TeamRegistryPage.tsx`:
   - Sort state, default Team Member ascending. New column starts ascending; clicking the active column toggles.
   - Pipeline: authorization scope -> search/filters -> sort -> pagination.
   - Changing sort resets to page 1; sort is kept when paging or changing search/filters.
   - The five headers become buttons (keyboard focusable, Enter/Space work natively) with `aria-sort` on the active header and an icon (ArrowUp / ArrowDown for active, ArrowUpDown muted for inactive). Header widths unchanged — no new overflow.
   - Export passes the sorted list.
3. `src/lib/teamRegistryExport.ts`: keep the incoming registry order instead of re-sorting by name (skills within each employee stay grouped by category -> skill as today). Format, columns, escaping, filename, data retrieval unchanged.
4. Tests `src/lib/teamRegistrySort.test.ts`: default A–Z, mixed case, 9 before 80, zero vs missing, missing last both directions, status by label, duplicate-value tie-breaker stability across page slices.
5. User Guide: one line on sorting and that export follows the selected sort.

## Unchanged
Pagination, role scoping, latest-version selection, status/metrics rules, Export button placement, CSV format.

## Verification
Run unit tests and typecheck; browser check via app-level sign-in as an admin user (as done for the export check) to sort each column both ways across pages, with search/domain filter, and compare a downloaded CSV's employee order to the table. Manager scope check by code review plus a manager-user session if available.

## Limitation
Authorization remains client-side (database is allow-all), unchanged by this work.
