## Add "Top Skill" and "Low Skill" columns to All Registries → By Employee

Enhance the By Employee table on `AllRegistriesPage` to surface each employee's strongest and weakest self-rated skill from their latest submitted registry.

### Definitions

- **Top Skill**: skill with the highest `self_score` in the employee's latest submitted registry. Ties broken alphabetically.
- **Low Skill**: skill with the lowest `self_score`. Ties broken alphabetically.
- If the employee has no rated items, show `—`.

### UI changes (`src/pages/AllRegistriesPage.tsx`)

1. Extend `EmployeeAgg` interface with:
   - `topSkill: { name: string; level: number } | null`
   - `lowSkill: { name: string; level: number } | null`
2. In the `employeeAggs` useMemo, compute top/low by scanning `allItems[reg.id]` and resolving names via `skillMap`.
3. Add two new `<TableHead>` cells ("Top Skill", "Low Skill") between **Skills** and **Status** columns.
4. Render each as skill name (text-sm) + a small level badge using `getLevelColorClass` for visual consistency with existing level badges.
5. Update `exportEmployeesCSV` header + rows to include both columns (name + level, e.g. `"React (L4)"`).

### Notes

- No new API calls — data already fetched in `allItems`.
- No DB or store changes.
- Follows existing badge/color patterns; semantic tokens preserved.
