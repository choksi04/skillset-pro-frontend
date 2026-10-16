# Team Registry: Manager access initialization

## Findings (confirmed from live data and code)
- **Account:** Sarvesh Bhuva, `sarvesh.bhuva@1rivet.com`, ID `ec77eb29-dfd2-4590-a4a9-5b8ca86a0f03`. Role `manager`, status active, home domain **DevOps** (`dom-1776230313025`). He leads no domain; DevOps has no Domain Lead.
- **His scope is correct.** The shared manager rule (domains led + home domain) gives him DevOps. Role is read from the database on every app load.
- **DevOps has 4 active members (testDevOps, Murtuza Rangwala, Sarvesh Bhuva, Rushabh Gala) and zero skill registries.** Nobody in the domain has started one.
- **Team Registry lists only employees who have a registry.** In-scope employees without one are invisible, so Sarvesh sees "No Registries Yet". A Manager whose domain has registries sees them, which is why some new Managers "work" and others don't.
- **Not the cause:** stale role, missing domain assignment, Domain Lead requirement, query filter, or database restriction (database rules are still "allow all", the existing MVP design).
- **Real secondary gap:** the role is only re-read on full page load. When an Admin changes someone's role, that person keeps the old role until they reload.

No account configuration correction is needed for Sarvesh.

## Changes (reusable code only)
1. **Show in-scope team members who haven't started a registry.** Team Registry adds a row for each active user in the viewer's scope (Admin: everyone; Manager: led + home domains) who has no registry, with status **Not Started**, 0% completion and no average. "View" is disabled for these rows. Archive filter, search, domain filter, sorting and pagination apply as usual. Existing registry rows, statuses and metrics are unchanged.
2. **Exports:** Not Started rows are left out of both CSV formats, so exports stay identical.
3. **Accurate empty states:**
   - Manager with no home domain and no led domain: "You're not assigned to a domain yet. Ask an admin to assign you." (existing)
   - Scope has no members at all: "No team members in your domains yet."
4. **Role refresh without hard reload:** re-read the signed-in user's role and domain when the browser tab regains focus and on navigation. A demoted user loses Manager/Admin pages immediately through the existing route guard; a promoted user gains them.
5. **Users page:** when saving a Manager without a domain, the existing "Domain is required" rule already blocks it; keep it and add helper text "Managers see team members in this domain."

## Technical details
- `TeamRegistryPage.tsx`: fetch in-scope users (`users` where `domain_id` in scope, paged past 1000), merge "not started" rows; extend `RegistryStatus` handling via `src/lib/registryStatus.ts` label "Not Started"; exclude these rows in `handleExport`.
- `teamRegistrySort.ts`: Not Started sorts by label like others; missing metrics already sort last.
- `AuthContext.tsx`: call `fetchUser` on `visibilitychange`/`focus` (throttled).
- `UsersPage.tsx`: helper text only.
- Detail page access check (`TeamRegistryDetailPage.tsx`) stays as is.
- No database changes. Tests: scope merge rule and refresh-driven role change; User Guide updated.

## Verification
- Sign in as Sarvesh in the browser: sees the 4 DevOps members as Not Started.
- Temporarily set a test user to Manager of a domain with registries, then Admin, then Employee, checking access after tab refocus; restore afterwards.
- Detail URL outside scope still shows "no access".
- Not possible: blocking direct database calls (needs proper sign-in sessions, separate larger change).
