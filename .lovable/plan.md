# Users Page — Filters & Sticky Pagination

## 1. Filters (toolbar)

Extend the existing toolbar (next to the search input) with three dropdowns built using the shared `SearchableSelect` (matching `DomainsPage` style):

- **Domain** — options: `All Domains`, `No domain`, plus all domains from `useDomainStore`.
- **Role** — options: `All Roles`, `Admin`, `Manager`, `Employee`.
- **Status** — options: `All Status`, `Active`, `Disabled`.

Add a `Clear` ghost button (right side) when any filter is non-default.

State: extend local state with `domainFilter`, `roleFilter`, `statusFilter` (default `'all'`).

Update the `filtered` memo to apply search + the three filters together. Reset pagination to page 1 whenever filters or search change.

## 2. Sticky Pagination (bottom)

Reuse the project's existing sticky pagination pattern (per memory `mem://style/ui-patterns/sticky-pagination`). I'll inspect `QuestionBankPage`/similar to copy the exact sticky styling so it overlaps container padding consistently.

- Page size: **20** (default), with a small page-size selector (10 / 20 / 50).
- Controls: `Prev`, page number indicator (`Page X of Y`), `Next`, plus a count summary (`Showing 1–20 of 84`).
- Sticky to the bottom of the viewport, full-width, with backdrop/border so it sits above the table when scrolling.
- Hidden when `filtered.length <= pageSize`.

Slice `filtered` with `(page-1)*pageSize` for rendering.

## 3. Out of scope

- No backend/query changes — filtering & pagination remain client-side (consistent with current full-table fetch).
- No changes to the Add/Edit dialog or stats cards.

## Files

- `src/pages/UsersPage.tsx` — add filter state + UI, pagination state + sticky control, slice rendered rows.
