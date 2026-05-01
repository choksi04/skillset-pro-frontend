## Root cause

`src/pages/TeamAssessmentsPage.tsx` line 74 (and 78 for managers) explicitly **excludes the logged-in user's own assessments**:

```ts
if (currentRole === 'admin') return assessments.filter((a) => a.employee_id !== user?.id);
```

Per project memory ("Admins/Managers also act as Employees"), the logged-in Admin should still see their own assessments inside **Team Assessments** when overseeing the org. Same applies to Managers viewing their domain.

## Fix

**File:** `src/pages/TeamAssessmentsPage.tsx` (lines 73–81)

Drop the `employee_id !== user?.id` exclusion:

```ts
const teamAssessments = useMemo(() => {
  if (currentRole === 'admin') return assessments;
  if (currentRole === 'manager') {
    const domainId = user?.domain_id;
    if (!domainId) return [];
    return assessments.filter((a) => a.domain_id === domainId);
  }
  return [];
}, [assessments, currentRole, user]);
```

After this:
- **Admin** sees every assessment in the tenant (including their own).
- **Manager** sees every assessment in their domain (including their own).
- **Employee** still sees nothing on this page (handled elsewhere via My Assessments).

No DB or other file changes needed.
