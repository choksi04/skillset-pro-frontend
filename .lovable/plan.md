## Workstream 1 — next atomic fix

### Root cause (verified)

Two different rules were in play for the same registry record:

- **Team Registry list** (`src/pages/TeamRegistryPage.tsx`, lines 153-161) derives status via `computeRegistryMetrics(...)` → `deriveRegistryStatus(...)`, using registry status, rated count vs active domain skills, and the latest review status.
- **Team Registry detail** (`src/pages/TeamRegistryDetailPage.tsx`, line 256) hardcodes the badge:
  `status={isApproved ? 'approved' : 'review_pending'}`. It never renders Draft or Incomplete.

Database check confirms the data pattern behind the report: several employees have a newer **draft** version stacked on an older **submitted** one (e.g. employee `15c5e6bc…` — v2 `draft`, v1 `submitted`; employee `0098a72a…` — v1 `draft`). Both views open the *same* latest record, so the list correctly shows Draft while the detail page unconditionally shows Review Pending.

So the list view is right; the **detail page** is the one bypassing the shared helper.

### Fix (single, minimal change)

File: `src/pages/TeamRegistryDetailPage.tsx`

1. The page already calls `computeRegistryMetrics` (line 136) but ignores `metrics.status`. Pass the missing `reviewStatus` input into that call, derived from the already-loaded `review` object (`review?.status`), so the helper can distinguish `review_pending` from `approved`.
2. Replace the hardcoded badge expression with `metrics.status`:
   `<RegistryStatusBadge status={metrics.status} size="sm" />`.

No changes to stores, queries, metrics helper, review flow, or the list page.

### Behavior after the fix

| Registry state | List badge | Detail badge |
|---|---|---|
| Latest version is draft | Draft | Draft (was: Review Pending) |
| Submitted, partially rated | Incomplete | Incomplete (was: Review Pending) |
| Submitted, fully rated, no approval | Review Pending | Review Pending |
| Review approved/completed | Approved | Approved |

The "table must not show Draft for a submitted registry" case is already correct — the affected employees genuinely have a newer draft version; the detail page was the misleading one.

### Issue coverage

- **Issue 22 (status differs across views)** — completes the Team Registry list vs detail parity.
- Issues 17, 18, 21 — unchanged, already handled by the shared metrics helper in earlier steps.

### Remaining in Workstream 1

- Unify dashboard status call sites (`ManagerDashboard`, `DomainReadiness`, `EmployeeDashboard`) onto `computeRegistryMetrics`.
- Verify `SkillRegistryDetailPage` (My Registry detail) badge also uses `metrics.status` rather than a local rule.

### Manual test steps

Admin:
1. Open Team Registries. Note an employee whose row shows **Draft**.
2. Click the row — detail header must now also show **Draft**, not Review Pending.
3. Find a row showing **Review Pending**; detail must show **Review Pending**.
4. Find an **Approved** row; detail must show **Approved** and the review inputs stay read-only.

Manager (domain lead):
5. Repeat 1-4 within the led domain; confirm no rows disappear and filters by status still match the badges shown.
