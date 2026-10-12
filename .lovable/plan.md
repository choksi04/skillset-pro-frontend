# Fix: Managers blocked from Team Assessment unless they are Domain Lead

## Confirmed root cause
Team Assessment limits a Manager to domains where they are the **Domain Lead** only. When a Manager leads no domain, the page returns no rows and shows "You're not assigned as Domain Lead for any domain."

The app's own rules say all managers assigned to a domain can see its users and assessments, with the Domain Lead as the primary reviewer. A Manager's assigned domain is stored on their user record.

Live data supports this. 23 active Managers exist. 12 of them belong to a domain but lead none, so every one of them sees the blocking message today.

Not the cause:
- **Stale role:** the role is re-read from the database every time the app loads, so a reload or sign-in picks up the new role.
- **Missing permission:** the page guard already lets Managers in.

## What changes
1. Change Team Assessment so a Manager can see assessments in two places:
   - the domains they lead
   - their own assigned domain

   Admins still see everything. Employees still cannot open the page.
2. Pick the empty-state message based on the Manager's situation:
   - **No domain and leads none:** "You're not assigned to a domain yet. Ask an admin to assign you."
   - **Has a domain but no assessments yet:** the normal "no assessments" message.
3. Show the loading state until the domain list has loaded, so the wrong message never flashes.

Out of scope, unless you ask: Team Registry has the same Domain-Lead-only rule. It is a one-line follow-up using the same change.

## Technical details
- File: `src/pages/TeamAssessmentsPage.tsx`.
- Replace `ledDomainIds` with `managerDomainIds`: led domains plus `user.domain_id`. Reuse the existing `domains` store and `useAuth`. No new model.
- Rename `notDomainLead` to `noManagerScope`, which is true when the set is empty. Gate it on domains being loaded.
- The reviewer-reassign and review-action logic stays unchanged. Domain Lead routing is preserved.
- No database changes. Note: scoping happens in the app, not in the database. Today's database rules are "allow all" (the existing MVP design), and this fix does not change that.
- Update the role-capabilities memory: a Manager's scope is led domains plus their home domain.
- Add a unit test for the scope rule. Run it, then check the page in a browser as a Manager with a home domain who leads no domain.
