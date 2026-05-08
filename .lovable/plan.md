Phase 1 shipped: role-aware shell, Pulse KPIs, one primary insight per role (Skill Heatmap / Team Skill Matrix / Skill Snapshot), and an Action lane. Phase 2 adds the **secondary insight rows**, **filters** for Admin & Manager, and **Previous-Approved lookup helpers** for honest deltas. No new tables — purely client-side aggregation against existing stores.

## Scope

### 1. Previous-Approved lookup helper (foundation)
New `src/lib/registryHistory.ts`:
- `getLatestApprovedPerEmployee(registries, reviewStatuses)` → Map<employeeId, registry>
- `getPreviousApprovedPerEmployee(...)` → Map<employeeId, registry> (the version just before the latest approved one)
- `levelByEmployeeSkill(items, registriesMap)` → Map<`${employeeId}|${skillId}`, level>

These power every delta in Phase 2 and replace the ad-hoc filtering currently inlined in each dashboard.

### 2. Admin Dashboard — secondary insights + filters
- **Filter bar** (top of Admin dashboard): Domain, Manager, Skill Category. Filters propagate to all widgets via a small local context (`AdminFilterContext`). Date range is out of scope for Phase 2.
- **Insights row 2 components** in `src/components/dashboard/admin/`:
  - `TopSkillsPanel.tsx` — Top 5 strengths + Top 5 gaps (two stacked mini-tables). Gaps = skills required by domain mappings where < N employees rate ≥ target level.
  - `DomainReadiness.tsx` — horizontal stacked bar per domain: Approved / In Review / Draft / Not Started.
  - `ManagerActivity.tsx` — table of managers with pending review count, avg turnaround days, approvals vs adjustments.
  - `SelfRatingBias.tsx` — diverging bar per domain showing avg(self − validated). Validated proxy = avg of attempt skill scores until manager scores are bulk-loaded (Phase 3).
- Pulse deltas wired through the new helper (Workforce Coverage Δ vs prior approved cohort, Avg Validated Δ vs prior approved version).

### 3. Manager Dashboard — secondary insights + filters
- **Filter bar**: Domain (only ones the manager owns), Skill Category. Applies to all widgets including the existing Team Skill Matrix.
- **Insights row 2 components** in `src/components/dashboard/manager/`:
  - `SkillCoverageInDomain.tsx` — for each required skill in the domain, "X / Y at or above target" bar.
  - `SelfVsValidatedPerMember.tsx` — bar chart (recharts) of avg self vs avg validated per employee.
  - `VersionMovement.tsx` — counts of skill-employee pairs that went up / stayed / went down between the latest two Approved registry versions.
- Recent Approvals card in the Action lane (last 5 items the manager actioned).

### 4. Employee Dashboard — secondary insights (no filters)
- **Insights row 2 components** in `src/components/dashboard/employee/`:
  - `SelfVsFinalPerSkill.tsx` — bar comparing self-rating vs manager-approved level per skill in the current registry.
  - `VersionGrowth.tsx` — per-skill previous-approved → current-approved with up/down indicator.
  - `DomainBenchmark.tsx` — per skill: my level vs my domain's average. Anonymised, hidden when cohort < 3.
- Recent Manager Feedback card in the Action lane (latest per-skill + overall comments from the most recent approved review).

### 5. Shared primitives
Add to `src/components/dashboard/shared/`:
- `DeltaBadge.tsx` — ▲/▼/— badge with tone, used by Pulse cards.
- `FilterBar.tsx` — generic chip-based filter row used by Admin and Manager dashboards.

## Phasing of the work
1. Build helper + DeltaBadge + FilterBar.
2. Wire Admin filters + Insights row 2.
3. Wire Manager filters + Insights row 2 + Recent Approvals.
4. Wire Employee Insights row 2 + Recent Manager Feedback.
5. Spot-check empty/loading states for every new widget; verify against current data so widgets either show real values or a meaningful empty CTA.

## Out of scope (deferred to Phase 3+)
- Server-side RPCs / SQL views for heavy aggregations (today's data volumes are fine client-side).
- Date-range filter, PDF export, configurable widget visibility.
- Replacing the validated-level proxy with a true bulk-loaded manager score.