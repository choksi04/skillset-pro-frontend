## Workstream 1 — Next atomic fix

### What I re-verified in the current code

The previous fix landed and is holding. `computeRegistryMetrics` is now consumed by all four views:

| File | Uses helper |
|---|---|
| `src/pages/SkillRegistryPage.tsx` (hero + history rows) | yes (lines 234, 384) |
| `src/pages/SkillRegistryDetailPage.tsx` | yes (line 403) |
| `src/pages/TeamRegistryPage.tsx` | yes (line 153) |
| `src/pages/TeamRegistryDetailPage.tsx` | yes (line 136) |

### What is still unresolved in issues 17, 18, 21, 22

One registry view was left out and still computes its own numbers: **`src/pages/AllRegistriesPage.tsx`, "By Employees" view and the skill drill-down drawer.**

Verified in that file:
- **Issue 18 (average)** — `selfAvg: avg(items.map(i => i.self_score))` (line 286) is a raw average over *every* registry item, with no filter to active domain-mapped skills and no `/5` scaling. The same employee therefore shows e.g. `3.0` here and a different value on Team Registry.
- **Issue 17 / 21 (completion & rated count)** — `entryCount: items.length` (line 287) counts all stored items, including stale items for skills no longer active or no longer mapped to the domain. No completion denominator exists at all on this page.
- **Issue 22 (status)** — `deriveRegistryStatus` is imported (line 18) but **never called**. Both status badges (line 520 employee rows, line 598 drawer) render a hand-rolled two-state expression: `reviewStatus === "approved" ? "approved" : "review_pending"`. A submitted-but-partially-rated registry shows **Review Pending** here and **Incomplete** on Team Registry — the exact issue-22 symptom, in the one place still not fixed.

Not in scope for this atomic fix (own tickets/workstreams): the dashboards (`ManagerDashboard`, `DomainReadiness`, `EmployeeDashboard`) each call `deriveRegistryStatus` with their own inputs.

### The fix (single, atomic)

Make `AllRegistriesPage.tsx` derive employee-level metrics and status from `computeRegistryMetrics`, exactly like the other four views. No layout change, no new components, no store or DB change.

1. Build a per-domain active-skill index in the page (reuse the already-imported `useDomainStore().mappings` + `useSkillStore().skills`, filtered to active/non-deleted) — same rule the other views apply.
2. In the `employeeAggs` memo, replace the manual `selfAvg` and `entryCount` with a `computeRegistryMetrics({ registryStatus, items, domainSkillIds, maxLevel, reviewStatus })` call and carry `metrics` on the row.
3. Employee table:
   - "Avg" cell uses `metrics.avgOnFive` (same `/5` scale as Team Registry) and renders a dash when `null` instead of `0.0`.
   - Skills-count cell uses `metrics.ratedCount` / `metrics.totalSkills`.
   - Status badge switches to `metrics.status`, so Incomplete / Review Pending / Approved match Team Registry.
4. Skill drill-down drawer: status badge uses that employee's `metrics.status` from the same map instead of the two-state expression.
5. Remove the now-genuinely-unused local `avg()` helper only if nothing else references it (the skills view keeps its own `avgLevel`, which is a different metric — average level *across employees for one skill* — and is intentionally left untouched).

Also update the CSV export for the employees view so exported values match what the table shows.

### Files changed
- `src/pages/AllRegistriesPage.tsx` (only file)

### Manual test steps
1. Open All Registries → By Employees. Note avg, skills count, and status for one employee.
2. Open Team Registry, find the same employee — avg, completion, and status must match exactly.
3. Find a submitted registry that is not fully rated — All Registries must now read **Incomplete**, not Review Pending.
4. An employee with zero self-scores → avg shows a dash, not `0.0`.
5. Filter by a domain containing a disabled skill → that skill is excluded from the denominator.
6. Export the employees CSV → values equal the on-screen values.

### Remaining work in Workstream 1 after this
- Dashboard status/metric call sites (`ManagerDashboard`, `DomainReadiness`, `EmployeeDashboard`) still compute their own inputs into `deriveRegistryStatus` — a separate atomic fix if you want them unified.
- Optional: surface `staleItemCount` in the UI (currently computed and ignored everywhere).

### Suggested next prompt
"All Registries verified. Next atomic fix: unify the three dashboard status call sites onto `computeRegistryMetrics`." — or move to Workstream 2 (Issue 20, select-all in fixed-template question selection).
