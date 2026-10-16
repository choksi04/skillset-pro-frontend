# Domain skills: same up-to-date view for Admin and Manager

## Findings (from code)
- **No separate Admin path.** Admins and Managers use the same Domains list, domain detail page, data loaders and shared count rule from the last fix (active, non-deleted, distinct linked skills). Role only decides who can *edit* (Admin or Domain Lead); viewing is identical. Admins don't need to be Domain Lead.
- **Same-person changes already update live.** Saving in "Manage Skills" reloads the domain links, and creating, disabling or deleting a skill updates the loaded skill list, so the counts recalculate at once.
- **Real gap (applies to both roles):** the app loads domains and skills once per browser session and then reuses that copy. Opening Domains again does not reload it. So when *another* person (for example Sarvesh) links a skill, an Admin who already had the app open keeps seeing the old count and list until a hard refresh.
- **No paging in the domain skill list**: every link is loaded in one request (432 today). The count is never based on a partial page.
- **Duplicates:** none exist; the count deduplicates anyway.

## Change (smallest fix)
- When the Domains list or a domain detail page opens, reload domains, links and skills fresh instead of reusing the session copy. Uses the existing loaders (`fetchDomains({ force: true })`, `fetchSkills({ force: true })`). No new logic, no database change.
- Nothing else changes: count rule, permissions, registries (including approved versions).

## Technical details
- `src/pages/DomainsPage.tsx` mount effect: `fetchDomains({ force: true }); fetchSkills({ force: true });`
- `src/pages/DomainDetailPage.tsx` line 70: same.
- Current data stays on screen while reloading (no skeleton flash), since the loaders keep old data until the new data arrives.

## Verification
- Browser: open Domains as Admin, link a test skill to DevOps as Sarvesh in a second session, navigate back to Domains as Admin, and confirm 6 becomes 7 on the card and detail tab. Unlink it to restore 6. The reverse: Admin links, Sarvesh's view updates.
- Check a domain with disabled links: card and tab agree. Rerun the existing tests.
- DevOps is expected to stay at 6 until the 17 skills are actually linked; no data repair is planned.
