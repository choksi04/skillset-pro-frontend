## Goal

Eliminate the "no data" → "data appears" flash on listing pages by showing skeleton loaders while the initial fetch is in flight. Reuse the pattern already established in `DomainsPage` and `SkillFrameworkPage` (which gate on `loading && !initialized`).

## Pages to update

All listing pages that currently render an empty-state or jump straight to data without a skeleton:

1. `src/pages/AssessmentTemplatesPage.tsx` — currently shows "Loading templates…" text only.
2. `src/pages/SkillRegistryPage.tsx` — no loading guard; flashes "Start Your First Registry" empty card.
3. `src/pages/QuestionBankPage.tsx`
4. `src/pages/AssessmentsPage.tsx`
5. `src/pages/TeamRegistryPage.tsx`
6. `src/pages/TeamAssessmentsPage.tsx`
7. `src/pages/ReviewsPage.tsx`
8. `src/pages/AllRegistriesPage.tsx`
9. `src/pages/UsersPage.tsx` — already has a `loading` flag; replace its current placeholder with skeleton rows.

(Already correct: `DomainsPage`, `SkillFrameworkPage`. No changes needed.)

## Approach

For each page above:

- Read `loading` and `initialized` from the relevant store (all listed stores already expose both flags). For `UsersPage`, use the local `loading` state already present.
- Wrap the list/table/card grid in:
  ```text
  {loading && !initialized
     ? <SkeletonList />
     : items.length === 0
        ? <EmptyState />
        : <ActualList />}
  ```
- Skeleton should visually mirror each page's row/card shape (3–5 placeholder rows) using the existing `Skeleton` component from `@/components/ui/skeleton`. Reuse the table-row skeleton pattern from `DomainsPage` for table-style pages, and a card skeleton variant for card-style pages (Assessment Templates, Skill Registry, Assessments, Team Registry, Reviews).
- Keep page header, search/filter bar, and action buttons rendered above the skeleton so layout doesn't jump.

## Skeleton variants (two reusable shapes)

- **Table rows** (Users, Question Bank, All Registries, Team Registry, Team Assessments, Reviews): rounded card → 4–5 rows of `Skeleton h-5` bars matching column widths.
- **Stacked cards** (Assessment Templates, Skill Registry, Assessments): 3 placeholder cards each containing a title bar, two text bars, and a row of small action-button bars on the right.

These can be defined inline per page (matching existing `DomainsPage` style) — no need for a shared component, keeping the change minimal and localized.

## Edge cases

- Pages that fetch from multiple stores (e.g. `SkillRegistryPage` fetches registries + domains + skills): gate skeleton on the primary store's `initialized` flag (`useSkillRegistryStore`), which is what determines whether the listing has data.
- Pages where `fetchX` is called unconditionally on mount: the `initialized` flag remains false until the first fetch resolves, so the skeleton will display for any first-paint, including refreshes.
- Subsequent refetches (e.g. after create/delete) must NOT show the skeleton again — the `&& !initialized` guard ensures this; data stays visible during background refresh.

## Out of scope

- Detail pages (`AssessmentDetailPage`, `SkillRegistryDetailPage`, etc.) — only listing pages are affected by this request.
- Loader behaviour inside dialogs/sheets.
- Changing store APIs or fetch logic.
