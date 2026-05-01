## Bug

Manager `test_manager@1rivet.com` (domain lead of "Dynamic 365" / `dom-1776245490169`) cannot see Nikunj Patel's submitted assessment on **Team Assessments**, even though Nikunj belongs to the same domain.

## Root cause

Verified with live data:

- `users.test_manager@1rivet.com.domain_id` = `dom-1776245490169` ✅
- `users.nikunjkumar.s.patel@1rivet.com.domain_id` = `dom-1776245490169` ✅
- `assessments` row for Nikunj has **`domain_id = "fixed"`** ❌ (a placeholder string, not a real domain id)

Two issues combine to cause the bug:

1. **Bad data being written** — `src/stores/assignmentStore.ts` (lines 135 and 170) inserts assessments using:
   ```ts
   domain_id: template.domain_id ?? 'fixed'
   ```
   When a template is not bound to a specific domain, the assessment gets the literal string `'fixed'` instead of the employee's actual domain. The same fallback is also written into the in-memory store at line 170.

2. **Wrong filter on Team Assessments** — `src/pages/TeamAssessmentsPage.tsx` filters team assessments by `a.domain_id === user.domain_id`. The intent is "assessments of employees in my domain", but it's filtering on the assessment's stamped `domain_id`, which can drift from the employee's actual domain (and in this case is `'fixed'`).

## Fix

### 1. `src/pages/TeamAssessmentsPage.tsx` — filter by the employee's domain, not the assessment's domain
For managers, resolve each assessment's owner domain via `useUserStore` (or the same `users` lookup the page already does via `supabase`), and include the assessment when the employee's `domain_id` matches the manager's `domain_id`. This is consistent with the "managers see data of employees in their domain" rule (memory: `data-visibility`).

Implementation outline:
- Reuse the existing `users` fetch already running on the page; extend the projection to include `domain_id`.
- Build a `Map<employeeId, domainId>` and use it in the `teamAssessments` memo:
  ```ts
  if (currentRole === 'manager') {
    const myDomain = user?.domain_id;
    if (!myDomain) return [];
    return assessments.filter((a) => employeeDomainMap.get(a.employee_id) === myDomain);
  }
  ```
- Admin branch unchanged (sees all).

### 2. `src/stores/assignmentStore.ts` — stop stamping the literal `'fixed'`
Replace both occurrences of `template.domain_id ?? 'fixed'` (lines 135 and 170) so the assessment row carries the **employee's** domain when the template is not bound to one:

```ts
const employeeDomain =
  template.domain_id ?? (await getEmployeeDomain(employeeId)) ?? null;
// ...
domain_id: employeeDomain,
```

Where `getEmployeeDomain` is a small inline lookup against `users.domain_id` (we can fetch it once per call). The DB column is `text NOT NULL` per schema, so if both template and employee have no domain, fall back to an empty string `''` rather than `'fixed'` (or, cleaner, alter to nullable in a follow-up — out of scope here). Choosing empty-string keeps the schema intact and avoids the placeholder showing up in any UI filter.

### 3. Backfill the existing broken row
One-shot migration to repair existing data:

```sql
UPDATE assessments a
SET domain_id = u.domain_id
FROM users u
WHERE a.employee_id = u.id
  AND a.domain_id = 'fixed'
  AND u.domain_id IS NOT NULL;
```

This makes Nikunj's existing assessment immediately visible to the manager and fixes any other historical rows created with the placeholder.

## Files to change

- `src/pages/TeamAssessmentsPage.tsx` — manager filter uses employee→domain map.
- `src/stores/assignmentStore.ts` — remove `'fixed'` placeholder; resolve employee domain.
- New migration — backfill `assessments.domain_id` where it equals `'fixed'`.

## Verification

1. Sign in as `test_manager@1rivet.com` → **Team Assessments** lists Nikunj's assessment.
2. Open the assessment, take a manager action, return to the list — assessment still visible.
3. Assigning a template (with no domain bound) to an employee creates an assessment whose `domain_id` matches the employee's domain, not `'fixed'`.
