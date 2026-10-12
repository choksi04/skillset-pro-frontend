# Fix: Managers blocked from Team Registry unless they are Domain Lead

## Confirmed root cause
This is the same cause as the Team Assessment issue. Team Registry shows a Manager only the domains where they are the Domain Lead. When a Manager leads no domain, the list is empty and the "not assigned as Domain Lead" message appears.

The Team Assessment fix created a shared rule: a Manager sees the domains they lead plus their own assigned domain. Team Registry was never switched to that rule.

A second gap was found. The registry detail page has no visibility check at all. Any Manager who knows the web address can open any employee's registry, even outside their domain.

Not the cause:
- **Stale role:** the role is re-read from the database every time the app loads.
- **Page permission:** the route already allows Admins and Managers.

## What changes
1. **Team Registry list**
   - Use the same visibility rule as Team Assessment: led domains plus own domain.
   - Admins still see everything, and Employees still cannot open the page.
2. **Messages on the list**
   - **Manager with no domain:** "You're not assigned to a domain yet. Ask an admin to assign you."
   - **Manager with a domain but no registries:** the normal "no registries" message.
   - Show the loading state until the domain list has loaded, so the wrong message never flashes.
3. **Registry detail page**
   - If a Manager opens a registry outside their visible domains, they see "You don't have access to this registry" and a Back button.
   - The approve and comment actions are hidden in that case.
   - Admins are unaffected.
4. **Statuses and scores**
   - Status labels, averages and completion calculations stay exactly as they are.

## Limits (stated plainly)
- Visibility is enforced in the app's pages, not in the database. Today's database rules are "allow all" (the existing MVP design, because sign-in goes through Microsoft and not the built-in sign-in).
- A technical user calling the data service directly could still read data. Closing that requires moving to proper database sign-in sessions, which is a separate, larger change.
- This fix does not weaken anything.

## Technical details
- Files:
  - `src/pages/TeamRegistryPage.tsx`: use `getManagerDomainIds` from `src/lib/managerScope.ts`, update the message, and add `currentRole === 'manager' && domains.length === 0` to `isLoading`.
  - `src/pages/TeamRegistryDetailPage.tsx`: fetch domains if they are not loaded. Compute `canView` = admin, OR manager AND scope includes `registry.domain_id`. Render an access-denied card when `!canView`.
- `managerScope.ts` and its tests are unchanged, so Team Assessment is unaffected. Re-run the existing tests.
- Update the role-capabilities memory: Team Registry now uses the same manager scope.
- Follow-up to suggest afterwards: the Team Assessment detail page likely has the same direct-address gap.
