## Goal

One source of truth for registry status — same labels, same colors, same rules — used by **My Registry**, **Team Registry**, **All Registries**, and both detail pages. While doing it, remove duplicated `registry_reviews` fetches and ad-hoc badge styling.

## Current problems (verified)

- `src/lib/registryStatus.ts` does **not exist** — the previous "unification" was never actually applied. Every page still rolls its own.
- `SkillRegistryPage.tsx` (lines 242–250): inline `let statusLabel/statusClass`, uses **"Up to date"** for any submitted registry, never checks manager review.
- `TeamRegistryPage.tsx` (lines 188–195): own `DerivedStatus` union (`up_to_date | needs_review | in_progress`) and inline `statusBadge()` — also says **"Up to date"** even when manager hasn't approved (the original bug).
- `AllRegistriesPage.tsx` (lines 24, 100–138, 419, 421, 491, 493): own `ReviewStatus` type + inline **"Approved" / "Pending review" / "Pending"** badges, fetches `registry_reviews` directly with raw Supabase calls.
- `SkillRegistryDetailPage.tsx` (line 451): hard-coded green `"Up to date"` badge regardless of review state.
- `TeamRegistryDetailPage.tsx`: own approve flow, no shared status badge.
- `src/components/registry/registryHelpers.ts` still exists with a third `EmployeeStatus` enum — dead code per earlier cleanup intent.

Three different vocabularies, three different color palettes, two different `registry_reviews` fetch paths.

## Plan

### 1. New shared module `src/lib/registryStatus.ts`

Single canonical status enum + config + derivation:

```ts
export type RegistryStatus =
  | 'not_started'      // no registry exists
  | 'draft'            // employee editing
  | 'incomplete'       // submitted but not all domain skills rated
  | 'review_pending'   // submitted, fully rated, no manager approval yet
  | 'approved';        // manager approved/completed

export interface RegistryStatusConfig {
  label: string;            // user-facing copy
  badgeClass: string;       // tailwind classes for <Badge>
  filterValue: string;      // value used in Select filters
}

export const registryStatusConfig: Record<RegistryStatus, RegistryStatusConfig> = {
  not_started:    { label: 'Not Started',    badgeClass: 'bg-muted text-muted-foreground border-border', filterValue: 'not_started' },
  draft:          { label: 'Draft',          badgeClass: 'bg-warning/15 text-warning border-warning/20', filterValue: 'draft' },
  incomplete:     { label: 'Incomplete',     badgeClass: 'bg-destructive/15 text-destructive border-destructive/20', filterValue: 'incomplete' },
  review_pending: { label: 'Review Pending', badgeClass: 'bg-primary/10 text-primary border-primary/20', filterValue: 'review_pending' },
  approved:       { label: 'Approved',       badgeClass: 'bg-success/15 text-success border-success/20', filterValue: 'approved' },
};

export function deriveRegistryStatus(input: {
  registryStatus?: 'draft' | 'submitted' | null;
  ratedCount: number;
  totalSkills: number;
  reviewStatus?: 'pending' | 'approved' | 'completed' | null;
}): RegistryStatus { /* …rules below… */ }
```

Rules:
1. no `registryStatus` → `not_started`
2. `draft` → `draft`
3. `submitted` + `totalSkills > 0` + `ratedCount < totalSkills` → `incomplete`
4. `submitted` + `reviewStatus in ('approved','completed')` → `approved`
5. otherwise → `review_pending`

### 2. New shared component `src/components/registry/RegistryStatusBadge.tsx`

```tsx
<RegistryStatusBadge status={status} size="sm" />
```

Wraps `<Badge>` with `registryStatusConfig[status].badgeClass`. One component, used everywhere status is shown.

### 3. Batch review-status fetch in the store

Add to `src/stores/registryReviewStore.ts`:

```ts
reviewStatuses: Record<string, 'pending' | 'approved'>;          // keyed by registry_id
fetchReviewStatusesForRegistries: (registryIds: string[]) => Promise<void>;
```

Single `IN (...)` query against `registry_reviews` with `deleted_on IS NULL`. Skips IDs already in cache. Replaces the ad-hoc fetch in `AllRegistriesPage` and the per-row needs of `TeamRegistryPage`.

### 4. Refactor each page

| File | Remove | Use |
|---|---|---|
| `src/pages/SkillRegistryPage.tsx` | inline `statusLabel`/`statusClass` block (242–250), the hard-coded green "Submitted" badge in version history (399) | `deriveRegistryStatus` (with own draft + ratedCount + per-version reviewStatus) + `<RegistryStatusBadge>` |
| `src/pages/TeamRegistryPage.tsx` | `DerivedStatus`, `statusBadge()`, status `Select` options (188–195, 230–234) | shared status, filter options built from `registryStatusConfig` |
| `src/pages/AllRegistriesPage.tsx` | local `ReviewStatus` type, inline `useEffect` that fetches `registry_reviews` directly, ad-hoc "Approved/Pending review" badges (419, 421, 491, 493) | store's `fetchReviewStatusesForRegistries` + `<RegistryStatusBadge>` |
| `src/pages/SkillRegistryDetailPage.tsx` | hard-coded "Up to date" green badge (451) | derived status (needs review fetch via existing `fetchReviewForRegistry`) + `<RegistryStatusBadge>` |
| `src/pages/TeamRegistryDetailPage.tsx` | any inline status pill (if added later) | `<RegistryStatusBadge>` |

### 5. Cleanup

- Delete `src/components/registry/registryHelpers.ts` (dead — its `EmployeeStatus` enum is unused after these refactors; will verify with `rg` before deletion).

## Performance / API-call wins

- `AllRegistriesPage` and `TeamRegistryPage` (when both mounted in a session) will share the cached `reviewStatuses` map → no duplicate `registry_reviews` queries.
- `SkillRegistryPage` version history: one batch review-status fetch for all submitted versions instead of per-row.
- `AllRegistriesPage`: removes the inline raw Supabase call and centralises the query — also fixes the current `setReviewStatuses({})` reset that re-runs every render of `submittedRegistries`.

## Out of scope

- No DB schema changes.
- No status-vocabulary expansion beyond the five above.
- Existing assessment statuses (`src/lib/assessmentStatus.ts`) untouched — registry and assessment lifecycles stay independent.

## Files touched

- New: `src/lib/registryStatus.ts`
- New: `src/components/registry/RegistryStatusBadge.tsx`
- Edit: `src/stores/registryReviewStore.ts`
- Edit: `src/pages/SkillRegistryPage.tsx`
- Edit: `src/pages/TeamRegistryPage.tsx`
- Edit: `src/pages/AllRegistriesPage.tsx`
- Edit: `src/pages/SkillRegistryDetailPage.tsx`
- Edit: `src/pages/TeamRegistryDetailPage.tsx` (only if it currently shows a status pill)
- Delete: `src/components/registry/registryHelpers.ts` (after verifying no imports)
