## Root cause (verified against the database)

The registries themselves are fine. I checked the data: the submitted registries in question have `rated = total_active_skills` (e.g. 21 of 21), so the correct status is **Review Pending** — which is exactly what the Employee view shows.

The difference is in **how many registry items each view actually loads**:

- **My Registry (Employee)** loads items for one employee's few registries → complete data → correct status.
- **Team Registry (Manager)** and **All Registries (Admin)** call `fetchItemsForRegistries()` with hundreds of registry IDs in a single `.in(...)` query. There are **5,970 rows** in `skill_registry_items`, and the backend caps an unpaginated query at **1,000 rows**. Every registry beyond that cap comes back with zero or partial items, so `ratedCount < totalSkills` and the shared helper correctly (but on wrong data) derives **Incomplete**.

A second, smaller contributor: `computeRegistryMetrics` returns `loading: true` while items are missing, but still returns a `status`, and the list pages render that badge immediately — so an unloaded registry briefly (or permanently) shows "Incomplete" instead of a placeholder.

## The atomic fix

Two small changes, no new architecture, no file moves.

1. **`src/stores/skillRegistryStore.ts` — paginate `fetchItemsForRegistries`**
   - Chunk the registry IDs (e.g. 100 per request) and, within each chunk, page through results with `.range()` until fewer than the page size come back.
   - Keep the existing cache/skip-already-fetched behaviour, the same grouping logic, and the same "empty array for registries with no items" fallback.
   - This is the same pagination pattern already used elsewhere in the stores.

2. **Status badge respects the loading flag (display only)**
   - In `src/pages/TeamRegistryPage.tsx` and `src/pages/AllRegistriesPage.tsx`, when `metrics.loading` is true, render the existing skeleton in the status cell (the numeric cells already do this) instead of a status badge.
   - No change to `registryStatus.ts` or `registryMetrics.ts` rules — the derivation stays the single source of truth.

## Expected behavior after the fix

A submitted, fully-rated registry shows **Review Pending** identically in My Registry, Team Registry, and All Registries. "Incomplete" appears only when the registry is genuinely submitted with unrated active domain skills (e.g. the one registry with 3 of 21 rated).

## Manual test steps

- **Employee:** open My Registry → submitted registry shows Review Pending (unchanged).
- **Manager:** open Team Registry → the same employee row shows Review Pending, and `rated/total` matches the detail page.
- **Admin:** open All Registries → same status and same `rated/total`; scroll/filter to employees far down the list (previously the ones broken by the row cap) and confirm they are no longer Incomplete.
- Confirm the genuinely partial registry still shows Incomplete in all three views.
- Hard-reload each page: status shows a skeleton first, never a wrong badge.

## Scope guard

Only the two list pages and the one store fetcher change. No refactors to unrelated code, no status-rule changes, no new files.
