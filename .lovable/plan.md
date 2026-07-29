## Workstream 1 — First atomic fix

### What I verified in the code (current state)

The four issues (17, 18, 21, 22) all come from **one root cause: every registry view computes its own metrics with different rules**. Confirmed by reading the pages:

| Rule | My Registry (`SkillRegistryPage.tsx`) | My Registry detail (`SkillRegistryDetailPage.tsx`) | Team Registry list (`TeamRegistryPage.tsx`) | Team Registry detail (`TeamRegistryDetailPage.tsx`) |
|---|---|---|---|---|
| Total skills (denominator) | mapped skills filtered to `status === 'active'` (line 107-109) | same (line 83-86) | **raw mapping count, no active filter** (line 144) | mapped ∩ active (line 109-112) |
| Rated count | all items in the registry (line 240) | all items (line 404) | all items (line 146) | **only items whose skill is in the domain** (line 135) |
| Average shown | **raw level average** `computeAvg`, e.g. 3.0 (line 54, 319) | scaled to /5 (line 406) | scaled to /5 (line 148-149) | scaled to /5 (line 138-140) |
| Items still loading | not handled — renders 0 / 0% | not handled | not handled | not handled |

Because `deriveRegistryStatus()` (in `src/lib/registryStatus.ts`) takes `ratedCount` and `totalSkills` as inputs, the different denominators also produce **different status badges** for the same registry — that is issue 22, and it is a symptom, not a separate bug.

### The first (and only) fix in this step

Add a single shared metrics helper and make all four registry views consume it. No other behaviour, layout, store, or DB change.

**New file: `src/lib/registryMetrics.ts`**

```ts
computeRegistryMetrics({
  registry,            // SkillRegistry | null
  items,               // SkillRegistryItem[] | undefined  (undefined = not loaded yet)
  domainSkills,        // Skill[]  active skills mapped to the registry's domain
  maxLevel,            // active competency level count
}) => {
  loading: boolean;        // true while items are undefined
  totalSkills: number;     // active, non-deleted domain-mapped skills
  ratedCount: number;      // items with a self_score AND skill in domainSkills
  completionPct: number;
  avgRaw: number | null;   // null when no ratings (never 0.0)
  avgOnFive: number | null;
  staleItemCount: number;  // rated items no longer mapped to the domain (reported, not counted)
  status: RegistryStatus;  // via existing deriveRegistryStatus
}
```

Canonical rules baked in (matching what the plan doc recommends for the safe first pass):
- Denominator = **current active domain-mapped skills**.
- Numerator = rated items **restricted to that same skill set** (stale/out-of-domain items excluded from both, surfaced via `staleItemCount`).
- Average = **null when there are no ratings** (no more `0.0`).
- Status = existing `deriveRegistryStatus`, now always fed identical inputs.

**Edits (metric/display lines only):**
- `src/pages/SkillRegistryPage.tsx` — hero card and version-history rows use the helper; hero average switches from raw to the same `/5` scale used everywhere else.
- `src/pages/SkillRegistryDetailPage.tsx` — summary tiles and status badge use the helper.
- `src/pages/TeamRegistryPage.tsx` — row builder uses the helper (fixes the missing active-skill filter, the main visible mismatch).
- `src/pages/TeamRegistryDetailPage.tsx` — completion/employee-avg tiles use the helper (manager-avg logic untouched).

While registry items are still loading, the count/percentage/average render a dash or skeleton instead of `0`, so numbers don't flicker into a wrong value on load.

Not touched in this step: `AllRegistriesPage.tsx`, dashboards, CSV exports, review flows, stores, database.

### Issues addressed
- **17 (completion inconsistency)** — fully addressed for these four views.
- **18 (average inconsistency)** — fully addressed for these four views.
- **21 (rated-skill mismatch in My Registry)** — fully addressed (stale copied-draft items no longer inflate the count).
- **22 (status differs)** — addressed as a consequence of identical inputs to status derivation.

### What you should manually test after implementation
1. Open a user in Team Registry, note completion + avg + status, then open that same registry detail and My Registry for that user — all three must match.
2. A registry in a domain that has an inactive/disabled skill mapped — total must exclude it everywhere.
3. A partially rated registry — status should read Incomplete in both list and detail.
4. A registry with zero ratings — average shows a dash, not 0.0.
5. Reload each page and confirm counts don't flash a wrong number first.

### Technical notes
Helper is pure and unit-testable; pages keep their existing data-fetching (`useDomainStore`, `useSkillStore`, `fetchItemsForRegistries`) exactly as-is.
