# Dashboard Blueprint — Admin, Manager, Employee

> Note: Review Cycles are **not** part of this product. All deltas and "previous" comparisons use the **previous Approved registry version** for the same employee (registry versioning already exists). Anything that depended on a cycle concept has been removed or rephrased.

## Guiding Principles

A mature dashboard is **opinionated**. Every widget answers a question or drives an action — not "here is data, you figure it out". Each role's dashboard is built around three layers:

1. **Pulse** — 4–5 headline KPIs that summarise current health.
2. **Insights** — 2–4 visual blocks that surface trends, gaps, and outliers.
3. **Action** — task-style lists (queues, alerts, follow-ups) that the user can click into.

Existing `HRDashboardPage` (All Registries) is a *reporting tool*. The Dashboard is a *decision surface*. We will keep them separate.

---

## Role 1 — Admin / HR Dashboard

Org-wide visibility with filters (Domain, Manager, Skill Category, Date range). Answers: *Where are we strong? Where are we exposed? What needs my attention?*

### Pulse strip (KPI cards)

- **Workforce Coverage** — % of active employees with at least one Approved registry version.
- **Assessment Throughput** — Last 30 days: submitted / evaluated / reviewed (3 small numbers in one card).
- **Avg Validated Level** — Org-wide mean of final levels across the latest Approved registry per employee. Delta vs each employee's previous Approved version (averaged).
- **Self vs Validated Gap** — Avg `|self − final|` across the latest Approved registries. Trend arrow vs previous versions. Reveals over/under-rating culture.

### Insights row 1 — Capability map

- **Skill Heatmap (Domain × Skill Category)** — coloured by avg validated level. Clicking a cell drills into matching employees. Headline "where do we stand" widget.
- **Top 5 Skill Strengths / Top 5 Skill Gaps** — two stacked mini-tables: skill name, avg level, # employees at L4+. The "gaps" list uses skills that domains require but no one rates ≥ target.

### Insights row 2 — People & process health

- **Domain Readiness** — horizontal bar per domain showing current distribution of employees: Approved / Review Pending / Draft / Incomplete / Not Started (no current registry). Identifies stalled domains.
- **Manager Activity** — table of managers with: # registries pending review, avg review turnaround (days from submission → approval), # adjustments made vs straight approvals. Surfaces bottleneck managers.
- **Self-rating Bias by Domain** — diverging bar (under-rate ↔ over-rate) per domain, computed from the latest Approved registry per employee. Cultural insight.

### Action lane (right column or bottom)

- **My Attention** — global queue: employees stuck in Draft >14 days, assessments awaiting evaluation >24h, managers with >5 pending reviews.
- **Setup Health** — small checklist: domains without a lead, skills not mapped to any domain, skills with <3 published questions (assessment-blocking).

### Filters

Top of page: Domain, Manager, Skill Category, Date range. Filters apply to all widgets.

---

## Role 2 — Manager Dashboard

Scoped to the manager's domain(s) and team. Answers: *How is my team performing? Who needs me right now? Which skills should we invest in?*

### Pulse strip

- **Team Size** — active employees in the manager's domain(s).
- **Pending My Review** — count of registries + assessments awaiting this manager's action (clickable).
- **Team Avg Validated Level** — delta vs previous Approved registry version per team member (averaged).
- **Reassessments Open** — count, with oldest age.

### Insights row 1 — Team capability

- **Team Skill Matrix** — compact grid (employees × top skills in the domain), cells coloured by validated level. The single most useful manager view.
- **Skill Coverage in Domain** — for each required skill in the domain: # team members at or above target level / total. Highlights coverage gaps.

### Insights row 2 — Behaviour and trend

- **Self vs Validated per Team Member** — bar chart showing each employee's avg self vs avg final from their latest Approved registry. Spots over/under-confident reports.
- **Version-over-Version Movement** — across the team, count of skill-employee pairs that went up / stayed / went down between each employee's last two Approved registry versions. Quick growth signal.

### Action lane

- **Review Queue** — list of pending registry reviews + completed assessments awaiting manager review, sorted by oldest. One-click into review.
- **Stuck Employees** — team members in Draft / Incomplete / Review Pending for >X days.
- **Recent Approvals** — last 5 things this manager actioned, for quick recall.

### Filters

Domain (only ones they manage), Skill Category.

---

## Role 3 — Employee Dashboard

Scoped strictly to the employee. Answers: *What do I need to do? How am I rated? Where can I grow?*

### Pulse strip

- **My Registry** — Draft / Submitted / Review Pending / Approved (with progress dots) plus last updated date/time.
- **Skills Assessed** — count of skills with a final validated level.
- **My Avg Level** — single number with delta vs my previous Approved registry version.
- **Open Tasks** — # pending assessments + reassessments to take.

### Insights row 1 — My profile

- **My Skill Snapshot** — radar (or grouped bar) of validated levels across my skill categories. Visual identity widget.
- **Self vs Final per Skill** — bar comparing my self-rating to the manager-approved level for each skill in the current registry. Calibration tool.

### Insights row 2 — Growth

- **Version-over-Version Growth** — for each skill: previous Approved final → current Approved final, with up/down indicator. Motivation widget.
- **Domain Benchmark (anonymised)** — per skill, my level vs my domain's average. No names, minimum cohort size enforced. Helps an employee see relative standing without exposing peers.

### Action lane

- **What's next** — ordered list: Submit registry → Take pending assessment → View manager feedback. Each card opens the right page.
- **Recent Manager Feedback** — latest per-skill and overall comments from the most recent approved assessment / registry.

### No filters

Employee dashboard is not configurable — it is a personal page.

---

## Cross-Cutting Decisions

- **Empty states everywhere.** Each widget renders a meaningful "what to do next" message when data is missing — not a blank card. (e.g., a brand-new admin sees Setup Health, not Skill Heatmap.)
- **Click-through is mandatory.** Every widget links to its detail page (registry, assessment, review, domain, skill).
- **Comparison is mandatory where data allows.** Deltas use the **previous Approved registry version** of the same employee. If an employee has only one Approved version, deltas show "—" with tooltip "First approved registry — no prior version to compare".
- **Reuse, don't reinvent.** The HR `All Registries` page stays as the deep reporting tool; Dashboard links into it for "see full report".
- **Performance.** Aggregate via SQL views or RPC functions; do not pull every row into the client.
- **Scope guard.** Manager and Employee dashboards must enforce server-side filtering (domain assignment for managers, employee_id for employees) — not just hide on the client.

---

## Phased Delivery

### Phase 1 — Foundations (ship first)

- Role-aware shell on `DashboardPage` that switches by `currentRole`.
- Pulse strip for all 3 roles (KPI cards) wired to real data — deltas omitted in this phase.
- One insight widget per role: Skill Heatmap (Admin), Team Skill Matrix (Manager), My Skill Snapshot (Employee).
- Action lane v1 for all 3 roles (queues only — no advanced sorting).
- Empty states for every widget.

### Phase 2 — Insights depth

- Second insights row per role (Domain Readiness, Self-vs-Validated, Version-over-Version Movement / Growth).
- Filters bar (Admin + Manager).
- Click-through wiring to existing detail pages.
- Introduce "previous Approved version" lookup helper in stores.

### Phase 3 — Maturity

- Version-over-version deltas everywhere (RPC returning current + previous Approved per employee to keep the client lean).
- Manager Activity + Setup Health (Admin).
- Domain Benchmark (Employee, anonymised aggregation — `SECURITY DEFINER` function with min cohort size).
- Saved filter presets (Admin).

### Phase 4 — Polish

- Export dashboard to PDF (Admin).
- Configurable widget visibility per user.
- Time-range selectors on trend widgets.

---

## Technical Notes (for implementation later)

- Data sources already exist: `skill_registries` (versioned), `registry_reviews`, `registry_review_items`, `manager_reviews`, `official_skill_entries`, `assessment_attempts`, `assessment_assignments`, `domain_skill_mappings`, `competency_levels`, `users`, `employee_domain_assignments`. No new tables needed.
- For aggregates (heatmap, domain readiness, manager activity, version deltas), add Postgres functions returning JSON to avoid pulling raw rows. RLS is currently "Allow all" so scoping is enforced at the query layer — must be respected in every fetch.
- "Previous Approved version" = the Approved `skill_registries` row for the same `employee_id` with the next-lower `version_number` than the current Approved one. Centralise this lookup.
- Reuse `recharts` (already in project) and `competencyLevelStore` for level labels and colours.
- New components live under `src/components/dashboard/` organised by role: `admin/`, `manager/`, `employee/`, plus `shared/` for `StatCard`, `Heatmap`, `DeltaBadge`, etc.
- `DashboardPage.tsx` becomes a router that mounts `<AdminDashboard />`, `<ManagerDashboard />`, or `<EmployeeDashboard />`. The current "Coming Soon" hero and module grid go away.

---

## Open Questions Before Build

1. **Domain Benchmark for employees** — confirm anonymised averages are acceptable, with a minimum cohort size (suggest 3) to prevent identification.
2. **Phase 1 scope** — ship all 3 roles together, or start with Employee (smallest surface, easiest to validate) and expand?
3. **Module grid removal** — current Dashboard's "Explore what's available today" tile grid: drop entirely once the new Dashboard ships, or keep as a collapsed "Quick links" footer?