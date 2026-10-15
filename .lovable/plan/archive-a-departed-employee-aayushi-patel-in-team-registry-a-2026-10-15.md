# Archive a departed employee (Aayushi Patel) in Team Registry and Team Assessment

## Findings (checked in the database)

There are **two** people named Aayushi Patel. Only one was in Frontend:

| | Frontend Aayushi (the one to archive) | Other Aayushi (stays untouched) |
|---|---|---|
| Email | aayushi.patel@1rivet.com | aayushi.b.patel@1rivet.com |
| User ID | 3f3e748c-87d5-4e12-a801-da4fb020eb46 | 38725e72-d8a1-45ea-ac78-ad652d3ad8a9 |
| Home domain | none (cleared) | Data |
| Account status | active | active |
| Registries | Frontend v1, v2 (both submitted, no manager review yet) | Data v1 (approved) |
| Assessments | 2 pending, never started | 1 in progress |
| Assignments | 2 "new" | 1 verified |
| Other domain memberships | none | none |

**What Mitul Patel's removal changed** (on 2026-10-13): it only cleared her home domain. Her account is still "active", there is no reporting-relationship field in the app, and her skill registries / assessments were not touched.

**Why she is still visible:** Team Registry and Team Assessment pick people from the registry's / assessment's own domain, not the person's current home domain or account status. Clearing the home domain therefore has no effect on those lists — which is correct for a domain move, but leaves no way to say "left the company".

**Existing mechanism to reuse:** every person already has an Active / Inactive status, editable by Admins on the Users page. Nothing in Team Registry or Team Assessment reads it yet. Plan: treat **Inactive person = archived** — no new archive flags on registries, reviews or assessments.

## Proposed archive scope (needs your confirmation)

Database change — one record only:
- Set aayushi.patel@1rivet.com (3f3e748c-...) to **Inactive**, with modified_by / modified_at recorded.

Not changed: her 2 registries, 2 pending assessments, 2 assignments, any ratings or audit fields; the other Aayushi; anyone else in Frontend.

Pending / in-progress work: left exactly as is (not marked completed or submitted). It simply drops out of the active lists. Her 2 submitted registries have no review open, so no manager is left with a stuck review.

## App changes

1. **Team Registry list** — hide people whose status is Inactive by default; add an "Include archived" checkbox next to the existing filters. Counts, pagination, search, sorting and both CSV formats (Admin and Manager) use the same filtered list, so they stay consistent. Archived rows show an "Archived" badge.
2. **Team Assessment list** — same: hidden by default, "Include archived" toggle, "Archived" badge, counts/pagination follow.
3. **Detail pages** (Team Registry detail, Assessment detail) — if the person is Inactive, show an "Archived — read-only" notice and hide approve / adjust / comment / regenerate / revoke / reassign actions. Existing Manager/Admin domain access rules still apply first, so a direct link can't widen access.
4. **Domain removal unchanged** — removing someone from a domain still does not archive them; only setting the person Inactive on the Users page does.
5. **User Guide** — add a short "Archiving a departed employee" note (how to archive, view with Include archived, and restore).

**Restore procedure:** an Admin sets the person back to Active on the Users page; everything reappears unchanged.

## Testing

- Unit test: the archive filter removes Inactive people by default and keeps them with Include archived.
- Browser (Admin): Aayushi absent from both lists by default; counts and CSV drop by her records; Include archived shows her with the badge; her detail pages are read-only; the other Aayushi and other Frontend members still appear. Refresh and re-check.
- Manager-only and real sign-in checks can't be done in the browser here (Microsoft sign-in only) — manual steps will be provided.

## Limitation

The database still allows everyone through ("allow all"), so read-only for archived records is enforced in the app screens, not at the database level — same as the rest of the app today.

## Technical details

- Archive source: `users.status = 'inactive'`. Fetch an id→status map for the employees in each list (chunked `.in('id', …)`), add `includeArchived` state, filter before sort/pagination/export in `TeamRegistryPage.tsx` and `TeamAssessmentsPage.tsx`.
- Read-only gate in `TeamRegistryDetailPage.tsx` and `AssessmentDetailPage.tsx` / `ManagerReviewPanel.tsx` via the employee's status.
- Data change via one UPDATE on `users` after your confirmation; no schema migration.
