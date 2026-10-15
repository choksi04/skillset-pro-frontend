# Archival consistency for Admin (Team Registry and Team Assessment)

## Findings from the current code
- Team Registry list: Admins and Managers use the same archive filter before search, sort, pagination, totals and export. No Admin bypass.
- Team Assessment list: same shared filter for both roles. Totals and pagination use the filtered list. The page has no export.
- Detail pages: the "Archived, read-only" notice and the hidden actions depend on the employee's status, not the viewer's role, so Admin is covered.
- Admin gap 1, export labeling: when "Include archived" is on, archived people are exported, but neither the Admin HR matrix nor the Manager long format marks them.
- Admin gap 2, the All Registries report (Admin-only): it reads registries directly and never checks archive status, so archived people still appear there by default.
- Admin gap 3, server side: the database's access rules still allow everything, so read-only is only enforced in the app screens.
- No new database change for Aayushi. She is already Inactive, and her records stay as they are.

## Changes (smallest set)
1. **Export labeling (both formats, only when Include archived is on)**: add " (Archived)" after the employee's name in the name cell. Columns, rows, totals and the HR matrix layout stay the same. With the default setting, archived people are already excluded and the files are byte-identical to today's.
2. **All Registries (Admin)**: hide archived people by default with the shared filter, and add the same "Include archived" checkbox and "Archived" badge. Its counts and its export follow the selected scope.
3. **Server-side read-only (narrow database change)**: add one database rule that rejects new or changed reviews, review items, assessment regeneration, revocation and question changes when the employee is Inactive. It never blocks reads, and historical rows are not modified. This is the only way to enforce read-only "as well as the UI", because there are no real per-user database permissions today. It gives nobody extra access.
4. **User Guide**: one line on export labeling and archived records in All Registries.

## Export-template decision (please confirm)
Labeling archived people inside the agreed HR template changes the employee name text (for example "Aayushi Patel (Archived)"). It does not change the structure. If you'd rather keep the template exactly as it is, archived people can be left unlabeled in the HR matrix and labeled only in the Manager format. By default, the plan labels both.

## Testing
- Unit tests: the name label is added only for archived people, the pivot totals don't change, and the default export excludes archived people.
- Browser check as Admin: Aayushi is missing by default from Team Registry, Team Assessment and All Registries. With Include archived on she appears with the badge, and counts and pagination change by her records. Exports with and without Include archived. Her detail pages are read-only.
- Database: try writing a review for her (it should be rejected), confirm the same write works for an active employee, and confirm her historical rows are unchanged.
- Manager: a real Manager sign-in can't be done here (Microsoft sign-in only). I'll check the Manager view by simulating the role and give you manual steps.

## Technical details
- `teamRegistryExport.ts`: optional `archived` flag on `ExportRegistryRow`, which appends the suffix to `fullName`. `TeamRegistryPage.tsx` passes `isArchivedStatus(userStatus[empId])`.
- `AllRegistriesPage.tsx`: fetch the `users.status` map (in chunks) and apply `filterArchived` before stats, pagination and export.
- Migration: a `BEFORE INSERT OR UPDATE` trigger function (security definer, fixed search_path) on `registry_reviews`, `registry_review_items` and `assessment_questions`, plus updates to `assessments`. It raises an error when the linked employee's `users.status <> 'active'`. Employee self-actions on their own records aren't affected because inactive users can't sign in to work.
