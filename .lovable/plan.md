## Verification result: the badge already uses `metrics.status` — the remaining defect is a loading flash

Read after the previous change:

| Call site | Line | What it does today |
|---|---|---|
| `SkillRegistryDetailPage.tsx` (submitted view) | 465 | `<RegistryStatusBadge status={metrics.status} />` — already the shared helper, denominator already filtered to active domain skills (line 86-89) |
| `SkillRegistryPage.tsx` hero badge | 272 | `featuredStatus` = `featuredMetrics.status` — already the shared helper |
| `SkillRegistryPage.tsx` version-history rows | 384-402 | `rowMetrics.status` from the shared helper |

So item "verify the detail badge uses metrics.status" is **confirmed already true**. What is *not* handled is the loading state:

- Detail page: `items: itemsLoaded ? allItems : undefined` (line 405). While items are still fetching, `metrics.loading` is `true` and `ratedCount` is `0`, so `deriveRegistryStatus` returns **`incomplete`** for a submitted registry. The badge renders that immediately — the rest of the page correctly guards with `!itemsLoaded` (lines 510, 607), but the badge does not. Result: a submitted registry briefly shows **Incomplete** before settling on **Review Pending**.
- Landing page: `metricsLoading` is already computed (line 241) and used for the numeric tiles, but the hero badge (272) and the version rows (402) ignore it, producing the same transient wrong pill.

This is the same class of bug already fixed on Team Registry / All Registries / dashboards, which render a `Skeleton` while `metrics.loading`.

### Changes (badge display only)

1. **`src/pages/SkillRegistryDetailPage.tsx`**
   - Replace line 465 with a `metrics.loading ? <Skeleton className="h-6 w-28 rounded-full" /> : <RegistryStatusBadge status={metrics.status} />`.
   - Add the `Skeleton` import if not already present.

2. **`src/pages/SkillRegistryPage.tsx`**
   - Hero badge (272): render `<Skeleton className="h-6 w-28 rounded-full" />` when `metricsLoading`, otherwise the badge.
   - Version-history row status cell (401-403): render `<Skeleton className="h-5 w-24 rounded-full" />` when `rowMetrics.loading`, otherwise the badge.

No changes to `registryMetrics.ts`, `registryStatus.ts`, stores, All Registries, dashboards, or any assessment/review flow.

### Behavior after the fix

- A submitted registry never flashes **Incomplete** or **Draft** on My Registry (landing hero, version history, or detail) — it shows a skeleton until items load, then **Review Pending** / **Approved**, matching Team Registry for the same record.

### Issue coverage

- **Issue 22 (status differs across views)** — completes the My Registry side.
- **Issues 17 / 18** — indirectly, since the same guarded metrics object feeds the counts and averages.
- **Issue 21** — unchanged (rated-skill counts already run through the shared helper).

### Manual test steps (Employee)

1. Sign in as an employee with a submitted registry, hard-reload `/skill-registry`: the hero pill shows a skeleton, then **Review Pending** — never Incomplete.
2. Open the version history row: same behavior on each row pill.
3. Click into `/skill-registry/:id` and hard-reload: the header pill shows a skeleton until skills load, then matches the landing page and the manager's Team Registry row.
4. Throttle the network (DevTools "Slow 3G") and repeat step 3 to make the skeleton window observable.

### Remaining in Workstream 1

- Verify All Registries uses the latest submitted version per employee, organization-wide, with `metrics.status`.
