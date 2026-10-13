# Team Registry list: verify version-aware status (expected no code change)

## What the code reading confirmed
- **Version rule (unchanged):** each list row is the employee's **highest version number**, whatever its state (draft, submitted, approved). Nothing changes this rule.
- Row status, rated count, completion, total skills and average all come from one call to the shared metrics helper. That call uses that version's own ratings and its own latest review state, which is the same helper My Registry uses. So an approved row already counts only its own saved skills, and new domain skills don't affect it.
- Clicking a row opens `/team-registry/<that version's id>`, so the detail page shows the same version. The detail page already uses the same frozen-skill rule.
- Status filter, sorting and CSV export all read the same computed rows. The export calls the same helper with the same review mapping.
- Review states saved today are only `approved` (77) and `pending` (2). The list, export and detail page all map them the same way, so they can't disagree.

Conclusion: no mismatch was found in the code. Code changes are only needed if the browser check below shows one.

## Verification steps (build mode)
1. Database read: find (a) an employee whose latest version is approved and was submitted before Frontend skills were added (for example Rahul Choksi v1, if it is still his latest), (b) an employee with an older approved version and a newer draft, (c) one of the 2 pending reviews.
2. Browser as Admin (app user switch): open Team Registry and check each case's status, completion and skill count across pages, with the status filter, sorting by Status/Completion, and after a refresh. Open each row and compare it with its detail page. Export the CSV and compare those rows.
3. Repeat for a Manager-only user to confirm scope is unchanged.
4. Add one unit test to `registryMetrics.test.ts` covering an older approved version plus a newer draft. The draft must use the current domain total, and its status must not be Approved.
5. Only if a real mismatch shows up: make the smallest fix in the affected spot, reusing `computeRegistryMetrics` / `versionSkillIds`.

## Limitation to report
- "Adding a domain skill before and after" is checked with existing data (skills already added after approvals). No new skill will be added to live data without your OK.
- Older approved versions aren't listed as their own rows. That's the existing rule, and they're visible from the detail page's version history.
