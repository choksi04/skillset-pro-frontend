# Keep approved registry versions stable when domain skills change

## Confirmed root cause
Every registry view works out completion and status by comparing a version's ratings with **today's** domain skill list. Nothing stores which skills belonged to a version except its own saved ratings.

Affected record: Rahul Choksi, Frontend, version 1. Submitted 17 Jun with 4 skills rated, approved 22 Jun. Frontend now has 17 active skills, and 13 of them were added after he submitted. The check becomes 4 of 17 rated, and the shared status helper checks "Incomplete" before it checks "Approved". So the saved approval is overridden. About 20 approved versions in Frontend are affected the same way. The approval and review records themselves are unchanged.

## Historical data source
No separate snapshot table exists. A submitted version's own saved skill ratings are the record of what the employee rated when they submitted. For an approved version, we use those ratings as its skill set. We never guess from the current skill list, and no data is rewritten.

## Changes
1. **Shared metrics helper** (`src/lib/registryMetrics.ts`): when a version is submitted and its review is approved/completed, its skill set is its own rated items:
   - total = number of saved items
   - rated count and average come from those items
   - skills that were later removed or disabled still count, because they were part of that version
   - stale count = 0

   Drafts, Review Pending versions and versions that aren't approved keep today's rules, so genuinely incomplete current work still shows Incomplete.
2. **Status helper** (`src/lib/registryStatus.ts`): no rule change. With the right skill set, an approved version's numbers match and it shows Approved. We don't force anything to Approved.
3. **Detail pages** (`SkillRegistryDetailPage.tsx`, `TeamRegistryDetailPage.tsx`): when an approved version is open, list only that version's skills. New skills don't appear as unrated rows. Manager scores, comments, reviewer and dates are unchanged.
4. **CSV export** (`src/lib/teamRegistryExport.ts`): approved versions export the version's own skills, so the export matches the screen.
5. Lists (My Registry, Team Registry, All Registries, dashboards) pick up the fix through the shared helper. They need no separate logic.
6. New skills: the current draft or a new version still uses the current domain list. New skills show there as unrated, and nothing is approved automatically.

## Tests
- Unit tests in `registryMetrics.test.ts`:
  - an approved version with 4 of 4 rated plus 13 newer domain skills gives Approved, 100%, total 4
  - the same data with review pending gives Incomplete
  - a draft gives the current domain total
  - an approved version whose skill was later disabled keeps total 4
- Browser check in the preview as Admin, Manager scope and Employee (via the app's user switch):
  - Rahul Choksi v1 shows Approved with 4/4 skills in My Registry, Team Registry list, detail and export
  - his current/latest version is still judged against today's 17 skills
  - switching versions and refreshing gives the same results

## Limitations
- If a version was ever approved without every skill rated, its unrated skills were never saved. Its total will equal its rated count. We can't recover that from stored data without guessing.
- Versions that are submitted but not approved still use today's skill list, which is the existing rule. Freezing them too would need a stored snapshot (a small new table written on submit). That is a possible follow-up, not part of this change.
- Database access rules are unchanged ("allow all", app-level checks).

## Database changes
None.
