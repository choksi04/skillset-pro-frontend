

# Fix: Employee Assignment Readiness Check Missing Legacy Users

## Problem
The readiness check (line 197) only queries `employee_domain_assignments` to determine if a domain has assigned employees. However, the system also supports direct `domain_id` assignment on the `users` table (legacy). The activation logic in `cycleStore.ts` correctly checks both sources, but the readiness check does not — causing false "missing employees" errors.

## Fix
In `src/pages/ReviewCyclesPage.tsx`, update the employee assignment check (lines 196-206) to also query users with `domain_id` matching the selected domains, merging both sources before determining which domains lack employees.

### Changes in `src/pages/ReviewCyclesPage.tsx`

Replace the current check (lines 196-206) with:

```typescript
// 3. Assigned employees — check both assignment table AND legacy domain_id on users
const [assignmentRes, directUsersRes] = await Promise.all([
  supabase.from('employee_domain_assignments').select('domain_id').eq('tenant_id', tenantId),
  supabase.from('users').select('domain_id').eq('tenant_id', tenantId).eq('status', 'active').not('domain_id', 'is', null),
]);
const assignedDomainIds = new Set([
  ...(assignmentRes.data || []).map((a: any) => a.domain_id),
  ...(directUsersRes.data || []).map((u: any) => u.domain_id),
]);
const domainsWithoutEmployees = selectedDomainObjs.filter(d => !assignedDomainIds.has(d.id));
// ... rest stays the same
```

This mirrors the same dual-source logic already used in `cycleStore.ts` activation flow.

## Files Modified
- `src/pages/ReviewCyclesPage.tsx` — one block (~5 lines replaced)

