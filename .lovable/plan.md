## Audit findings

The registry has two genuine state dimensions that the UI was conflating into one "Up to date" badge:

1. **Self-review state** (`skill_registries.status`): `draft` → `submitted`
2. **Manager review state** (`registry_reviews.status`): none → `pending` → `approved`

Plus a derived "completeness" check (rated vs. total skills in the domain).

We will adopt **one consistent vocabulary** across every registry surface and remove the misleading "Up to date" label.

## Unified status vocabulary


| Code              | Label                     | Color                | Meaning                                       |
| ----------------- | ------------------------- | -------------------- | --------------------------------------------- |
| `draft`           | **Draft**                 | warning              | Employee is still editing                     |
| `incomplete`      | **Incomplete Submission** | destructive (subtle) | Submitted but not all domain skills rated     |
| `awaiting_review` | **Review Pending**        | primary              | Submitted, fully rated, no manager action yet |
| `approved`        | **Approved**              | success              | Manager finalized                             |


Helper to derive this lives in a new shared module so every page uses the same logic.

## Changes

### 1. New helper — `src/lib/registryStatus.ts` (new file)

- Export `RegistryStatus` type and `deriveRegistryStatus({ registry, totalSkills, ratedCount, reviewStatus })`.
- Export `registryStatusConfig` map: `{ label, badgeClass }` for each status.
- Export `getRegistryStatusBadgeClass(status)` for one-line use.

### 2. `src/pages/TeamRegistryPage.tsx`

- Replace inline `DerivedStatus` (`up_to_date`/`needs_review`/`in_progress`) with shared helper.
- Fetch `registry_reviews` for the latest registry of each employee (one query for all latest IDs) and feed into status derivation.
- Update the status filter dropdown to: All / Draft / Incomplete Submission / Review  Pending / Approved.
- Replace `statusBadge()` to use the shared config.

### 3. `src/pages/SkillRegistryPage.tsx` (My Registry)

- Hero badge: replace "Up to date" with derived status. Fetch the latest registry's review status and show  Review  Pending / **Approved** / **Draft** / **Incomplete Submission**.
- Version History table "Status" column: per-row derived status using each row's review state (single batch query for all version IDs).

### 4. `src/pages/SkillRegistryDetailPage.tsx`

- Replace the "Up to date" / "Version N" badge near the title (line 451-453):
  - For latest submitted: show **derived status** ( Review  Pending / Approved / Incomplete Submission).
  - For older submitted versions: show `Version N` only.
- The "Draft · vN" badge already exists for drafts — keep as-is (matches new vocabulary).

### 5. `src/pages/TeamRegistryDetailPage.tsx`

- Already correct with "Pending Review" / "Approved" — rename "Pending Review" → " Review  Pending" for consistency. Keep the rest as-is.

### 6. `src/pages/AllRegistriesPage.tsx`

- Already added "Approved" / "Pending review" badges. Rename "Pending review" → " Review  Pending" for consistency. Same in the skill drill-down drawer (use short form "Awaiting" if cramped).

### 7. Delete dead code — `src/components/registry/registryHelpers.ts`

- Confirmed unused (no imports anywhere). Removing prevents future confusion with overlapping `EmployeeStatus` definition.

## No DB / schema changes

This is purely a UI/derivation cleanup. No migrations.

## Out of scope

- No changes to Team Registry approval workflow itself.
- No new statuses beyond the four above.
- No changes to assessment-side status badges (separate vocabulary handled by `assessmentStatus.ts`).