# Admin Team Registry export: readable employee identifier

## What I found
- `teamRegistryPivot.ts` adds `[<database id>]` to a name only when two people in the same domain block share that name.
- The data model has no HR or business employee code. The only identifiers are the internal user ID and `email`. All 278 users have an email, so there are no gaps today.
- The two Dhruv Patel records are separate, active accounts in the same domain:
  - `dhruv.patel@1rivet.com`, created 2026-07-08 11:44
  - `dhruv.n.patel@1rivet.com`, created 2026-07-08 10:36
  - Their emails are different, so these look like two different people, not a duplicate account. Nothing will be merged or changed.
- So the new column will be **Employee Email**, not Employee ID. Following your rule, no codes will be invented.

## Changes (Admin pivot only)
- `src/lib/teamRegistryPivot.ts`:
  - Add an optional `emails` map (internal ID to email) to `buildAdminPivot`.
  - In every domain block, insert an `Employee Email` column right after `Row Labels`.
  - Employee rows: the plain name (plus " (Archived)" as today), then the email, or a blank cell if it is missing.
  - The bottom Grand Total row gets a blank email cell.
  - The DATA and "Sum of..." rows shift so `Skills` stays above the first skill column.
  - Remove the `[id]` suffix. Rows are still grouped by internal ID, so people with the same name stay as separate rows.
  - Ratings, averages (2 decimals), column order, block order and padding stay as they are.
- `src/pages/TeamRegistryPage.tsx`: Admin branch only. Pass the emails of the exported employees, taken from the user data the page already loads (or one read of `users.email` scoped to the exported IDs if they are not loaded). The Manager branch is not touched.
- `src/lib/teamRegistryPivot.test.ts`: update the index offsets. Add tests for:
  - same-name employees staying separate with their emails and no ID
  - a missing email leaving a blank cell
  - the summary row's email cell being blank
- User Guide: one line saying the Admin export lists Employee Email.

## Verification
- Run the full test suite. The Manager long-export tests must pass unchanged.
- Rebuild the Admin export from live data with a script. Check that both Dhruv Patel rows show their own emails and correct ratings, that no name contains an internal ID, and that headers line up in every block.
- Confirm a Manager export is byte-identical to the current output.
