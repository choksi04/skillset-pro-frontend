## Goal
On the **All Registries** page (`/all-registries`), only show registries that are **submitted AND approved** by a manager, make the **Employees count** clickable in the *By Skills* view to drill into the actual employee list per skill, and remove row hover styling for a calmer look.

## 1. Show only approved registries

**Current behavior**: `AllRegistriesPage` filters by `status === 'submitted'` only — so registries still pending manager review also appear.

**New behavior**: A registry counts only when both:
- `skill_registries.status = 'submitted'`, AND
- a matching row exists in `registry_reviews` with `status = 'approved'` and `deleted_on IS NULL`.

**How**: After fetching submitted registries, fetch approved review rows and build an `approvedRegistryIds: Set<string>`. The existing "latest per employee" reducer then runs over this filtered subset, so the page automatically shows only the latest approved version per employee.

```ts
// inside AllRegistriesPage
const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

useEffect(() => {
  const ids = submittedRegistries.map(r => r.id);
  if (!ids.length) return;
  supabase.from('registry_reviews')
    .select('registry_id, status, deleted_on')
    .in('registry_id', ids)
    .eq('status', 'approved')
    .is('deleted_on', null)
    .then(({ data }) => setApprovedIds(new Set((data ?? []).map(r => r.registry_id))));
}, [submittedRegistries]);

const approvedRegistries = useMemo(
  () => submittedRegistries.filter(r => approvedIds.has(r.id)),
  [submittedRegistries, approvedIds],
);
```

Then replace `submittedRegistries` with `approvedRegistries` in the `latestPerEmployee` reducer (the rest of the aggregation pipeline stays unchanged).

Update the page subtitle to: *"Organization-wide skill registry data from latest approved versions."*

## 2. Drill-down: Employees per skill

In **By Skills** view, the `Employees` cell currently renders a static badge. Make it an interactive button that opens a Sheet (right-side drawer, matching project pattern) listing the employees who declared that skill, their declared self level, and their domain.

### Drawer contents

```
[Sheet header]
  <Skill name>
  <Category>  ·  <N employees>

[Search input]  (filter by employee name)

[Table]
  Employee Name   |   Domain   |   Self Level
  ---------------------------------------------
  Jane Doe        |   Frontend |   L3
  John Smith      |   Frontend |   L4
  ...

  Each row clickable → navigates to the employee's latest approved registry
  (`/team-registry/<latestRegistryId>`), closing the sheet.
```

### Data model
While building `skillAggs` we already iterate `(reg, items)`; extend the inner Map per skill to also collect `{ employee_id, level, registryId }`. Expose this on the `SkillAgg` as `employees: { id, name, domain, level, registryId }[]`. Lookup names via existing `userNames` map and domains via `domainMap`.

### Trigger
Replace the static employees badge with a Button (variant `ghost`, size `sm`) that sets `selectedSkill` state and opens the sheet. Keep the same visual badge styling but make it focusable/clickable. Show pointer cursor.

## 3. Remove hover transition on rows

Strip `hover:bg-muted/30 transition-colors` from both *By Skills* and *By Employees* `TableRow` elements. For *By Employees* keep `cursor-pointer` (row is still clickable to navigate).

## Files

- **`src/pages/AllRegistriesPage.tsx`** — add approved filter, extend `SkillAgg` with employees, render a Sheet drill-down, remove hover classes. No other files change.

## Out of scope
- No DB schema or RLS changes.
- No changes to `registry_reviews` flow or the Team Registry detail page.
- No changes to *By Employee* view aggregation logic (it already navigates to detail on row click).
