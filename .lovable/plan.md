## Verified current state (All Registries vs Team Registry)

| Concern | Team Registry (working) | All Registries (broken) |
|---|---|---|
| Registry items source | `fetchItemsForRegistries(ids)` + `items` map from `skillRegistryStore` (chunks ids 100 at a time, pages with `.range()` at 1000 rows, and **writes an empty array for registries with no items**) — store lines 247-302 | Its own `supabase.from('skill_registry_items').select(...).in('registry_id', ids)` into local `allItems` state (`AllRegistriesPage.tsx` lines 160-176) — **no pagination, no empty-array backfill** |
| Metrics | `computeRegistryMetrics({ items: items.get(id), ... })` | `computeRegistryMetrics({ items: allItems[reg.id], ... })` |
| Status render | `metricsLoading ? Skeleton : <RegistryStatusBadge status={r.status} />` | same pattern (lines 567-570, 648) |

So the status *rule* is already shared and identical. The defect is in the **data feed**, confirmed by reading both files:

1. The page-local query returns at most 1000 `skill_registry_items` rows in one unpaginated request. Every registry whose items fall past that cap gets `allItems[reg.id] === undefined`.
2. `computeRegistryMetrics` treats `items === undefined` as `loading: true` (registryMetrics.ts line 55), so those rows render the Skeleton **forever** — nothing ever re-fetches.
3. A submitted registry with zero items also never gets a key in `allItems`, so it is permanently "loading" too (the store version explicitly backfills `[]` for those).
4. Where metrics do resolve but items were partially truncated, `ratedCount < totalSkills` → status resolves to **Incomplete** while Team Registry (fully paginated) resolves the same registry to **Review Pending** — the mismatch reported.

## Change (single atomic fix, All Registries only)

**`src/pages/AllRegistriesPage.tsx`**

- Pull `items` and `fetchItemsForRegistries` from `useSkillRegistryStore()` (already imported and used on this page for `registries`/`fetchRegistries`).
- Replace the `useEffect` at lines 160-176 with a call to `fetchItemsForRegistries(submittedRegistries.map(r => r.id))` — exactly what Team Registry does at line 138.
- Delete the local `allItems` state (line 137) and read items from the store map instead:
  - `metricsByRegistry`: `items: items.get(reg.id)`
  - `skillAggs` / `employeeAggs`: `const regItems = items.get(reg.id) ?? []`
  - update the three `useMemo` dependency arrays from `allItems` to `items`.
- Keep the existing Skeleton-while-`metricsLoading` rendering, the review-status fetch, the badge component, and all other logic untouched.

Nothing else changes: no store changes, no Team Registry changes, no `registryMetrics.ts` / `registryStatus.ts` changes, no schema or query-rule changes.

### Note (not changed in this step)

All Registries scopes to the **latest submitted** registry per employee; Team Registry uses the employee's latest registry overall. If someone has a newer *draft* on top of a submitted version, Team Registry will show Draft and All Registries will show Review Pending. Your stated expectation ("should not fall back to Draft when a valid submitted registry exists") matches the current All Registries behavior, so I am leaving it as-is and flagging it as a separate decision.

## Behavior after the fix

- No All Registries row stays in the Skeleton/Loading state once registry data has loaded — every submitted registry receives either its item rows or an explicit empty list.
- Completion (`x / y Rated`), average (/5), and the status pill for a given employee are computed from the same complete item set as Team Registry, so a registry showing **Review Pending** on Team Registry shows **Review Pending** on All Registries.
- Truncation-induced false **Incomplete** disappears organization-wide (the same class of bug already fixed for Team Registry and the dashboards).

## Issue coverage

- **Issue 22** — completes the All Registries side of cross-view status consistency.
- **Issues 17 / 18** — fully addressed on All Registries (completion counts and average ratings now come from the complete, shared-rule metric set), including the CSV export which reads the same values.

## Manual test steps (Admin)

1. Sign in as Admin, open **All Registries**, Employees view, filter = All domains. Wait for load: no row should keep a pill-shaped skeleton in the Status column.
2. Pick an employee with a submitted registry — note their status, `rated / total`, and average.
3. Open **Team Registry** (as the manager of that employee's domain, or the same employee's row) and compare: status label, rated/total, and average must match exactly.
4. Scroll a large domain (one with enough employees that total registry items exceed 1000 rows) and confirm the bottom rows resolve too — this is where the old 1000-row cap used to bite.
5. Export CSV and confirm the Status / Completion / Avg columns match what the table shows.
6. Switch to the Skills view, open a skill drawer, and confirm each employee's status chip matches their row in the Employees view.

## Suggested next prompt

"I have reviewed the previous change. Continue with Workstream 1 only. Next atomic fix: decide and unify which registry version each view selects (latest overall vs latest submitted) across My Registry, Team Registry, and All Registries."
