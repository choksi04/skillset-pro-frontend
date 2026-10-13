# Team Registry: Export CSV

## What the user gets
An "Export CSV" button (download icon) placed before the search box and Filter button on Team Registries. Visible only when the current role is Admin or Manager. It downloads `Team_Registry_YYYY-MM-DD_HH-mm.csv` with every record matching the current search and filters, across all domains the user may see.

## Scope (same rules as the table)
- Admin: all employees' latest registry, all domains.
- Manager: domains from `getManagerDomainIds` (domains they lead plus their own domain), the rule from the earlier access fix.
- Employee role (including Domain Leads acting as Employee): no button. The export function also refuses to run unless `currentRole` is admin or manager.
- Version: latest `version_number` per employee, the same grouping the table uses.
- Search/status/domain filters: reuses the table's `filteredRows`. Order is stable: employee name, then skill category and skill name.

## Rows and columns
One row per employee, registry, and active domain skill. Unrated skills are included with blank ratings. An employee whose domain has no skills gets one row with blank skill columns.

Columns: Employee ID, Employee Name, Designation, Domain ID, Domain Name, Registry ID, Registry Version, Registry Status (shared label), Submitted At, Last Updated, Rated Skills, Total Skills, Completion %, Avg Self Rating (/5), Skill ID, Skill Name, Skill Category, Self Rating (level), Self Comment, Manager Score (level), Manager Comment, Review Status, Review Overall Comment, Review Completed At.

Manager columns are filled only when a review exists. No value is ever made up.

## Data loading (not limited to loaded rows)
- Registries, items and review statuses already come through chunked fetches that get past the 1000-row limit. A fresh fetch of items for every exported registry happens at export time.
- Review details (manager scores and comments) come from `registry_reviews` and `registry_review_items`, fetched in chunks of registry IDs and paged with `.range()`.
- If any chunk errors, the export stops with a failure message and no file downloads. Partial files are never saved.
- Empty result: an "Nothing to export" message and no file.

## CSV safety
- A new small helper, `src/lib/csv.ts`: quotes every field, doubles internal quotes, keeps line breaks inside quotes, adds a UTF-8 BOM for Excel, and uses CRLF line endings.
- Formula-injection guard: text cells starting with `= + - @`, tab, or CR get a leading `'`. Real numbers are left as is.
- A unit test, `src/lib/csv.test.ts`, covers escaping, Unicode, the formula guard, and numbers passing through untouched.

## UX
The button shows a spinner and is disabled while the export runs. Toasts report success (with the row count), empty results, and failures. The toolbar wraps on narrow screens, and the search box becomes full-width on mobile, so the page never scrolls sideways.

## Files
- `src/lib/csv.ts` (new) and `src/lib/csv.test.ts` (new)
- `src/lib/teamRegistryExport.ts` (new): builds rows using `computeRegistryMetrics` and `registryStatusConfig`
- `src/pages/TeamRegistryPage.tsx`: adds the button and handler, and makes the toolbar wrap
- User Guide page: a short Team Registry export section

## Important limitation (security)
Per the project's current setup, database access rules are "allow all" and permissions are enforced in the app. This plan enforces export permission in the UI and in the export code, and the export only fetches registries in the user's scope. It cannot stop someone from sending a crafted direct request to the database. Real server-side enforcement needs the project-wide move to proper database access rules, which is outside this feature. It will be listed as remaining work.

## Verification
- Run the CSV unit tests.
- Check button placement and the mobile layout in the browser. A signed-in export as Admin and as Manager may not be possible from the sandbox (Microsoft sign-in only). If so, it will be reported as unverified, with manual steps.
