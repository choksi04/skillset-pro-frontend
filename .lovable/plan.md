# Plan: All Registries — Dual View Mode (By Skills / By Employee)

## Overview

Replace the current flat table on `/all-registries` with a **Switch toggle** offering two views:

1. **Registry by Skills** — Aggregated skill-level view showing employee distribution across competency levels
2. **Registry by Employee** — Employee-centric view with avg scores and click-through to detail

---

## View 1: Registry by Skills

**Table columns:**


| Skill Name | Category | Employees | L1  | L2  | L3  | L4  | L5  | Avg Level |
| ---------- | -------- | --------- | --- | --- | --- | --- | --- | --------- |


- **Employees**: Total distinct employees with a final level for that skill
- **L1–L5**: Number of employees at each level (colored badges) — this is more actionable than just showing averages, as HR can instantly spot gaps (e.g., "0 employees at L4 for React")
- **Avg Level**: Weighted average final level across all employees (e.g., 2.8)
- Searchable by skill name, filterable by domain
- Clicking a skill row could expand inline to show the employee breakdown (optional, phase 2)
- CSV export adapts to this view

**Data source**: `officialEntries` grouped by `skill_id`, counting distinct `employee_id` per `final_level`.

---

## View 2: Registry by Employee

**Table columns:**


| Employee Name | Domain | Self Avg | Assessment Avg | Final Avg | Status |
| ------------- | ------ | -------- | -------------- | --------- | ------ |


- Employee names fetched from `users` table (same pattern as TeamRegistryPage)
- Domain name resolved from submissions + domainStore
- Scores: averaged from `officialEntries` grouped by `employee_id`
- **Clickable rows** → navigate to `/team-registry/:submissionId` (reuse existing detail page)
- Searchable by employee name, filterable by domain

**Data source**: `officialEntries` grouped by `employee_id`, plus `submissions` for linking to detail page and resolving domain.

---

## UI Design

- **Switch component** at the top-right (next to Export button): `"By Skills"` / `"By Employee"` using the existing `Switch` or a `Tabs` component styled as pills
- Search + domain filter remain shared across both views
- Export CSV adjusts output based on active view

---

## Technical Changes


| File                              | Change                          |
| --------------------------------- | ------------------------------- |
| `src/pages/AllRegistriesPage.tsx` | Add `viewMode` state (`'skills' |


**No new files or routes needed** — this is a single-page enhancement. User name fetching follows the same Supabase query pattern already used in `TeamRegistryPage`.