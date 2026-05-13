# User Guide — Add "Dashboard" section

Add a new role-aware **Dashboard** chapter to the Help & Tutorial page (`src/pages/UserGuidePage.tsx`) covering every widget on the role-specific dashboards: what it shows, why it matters, and where its data comes from. No business-logic changes — guide content only.

## Structure

Add one shared overview card (always visible) plus three new role-scoped sections appended to each tab's existing guide array.

### 1. Shared overview (new array `dashboardOverview`)

- **Dashboard Overview** — explains the dashboard adapts to the user's role; lists the two persistent banners (Beta, Experimental dashboard) and the Quick-Start Checklist / Setup Progress for admins. Notes data refreshes on load and reflects current DB state (no manual input).

### 2. Admin tab — append to `adminGuide`

Single "Admin Dashboard Widgets" card listing each widget with purpose + data source:

- **Filters bar** — Domain, Manager, Skill Category. Scopes every widget below.
- **KPI cards**:
  - *Workforce Coverage* — % of employees with at least one approved validated skill.
  - *Throughput (30d)* — assessments submitted in the last 30 days, with delta vs prior 30d.
  - *Avg Validated Level* — mean approved level across the org.
  - *Self vs Validated Gap* — average difference between self-rating and validated level (bias indicator).
- **My Attention** — actionable counts (pending reviews you can act on, stuck employees, domains missing setup).
- **Domain Readiness** — per-domain bar showing setup status (skills mapped, questions, templates, employees ready).
- **Top 5 Skill Strengths** — highest avg approved levels across the org.
- **Top 5 Skill Gaps** — lowest avg approved levels — drives upskilling decisions.
- **Self-Rating Bias by Domain** — average self-vs-validated delta per domain.
- **Manager Activity** — per-manager review throughput and pending counts.
- **Skill Heatmap** — Domain × Category matrix of avg validated level; click a cell to drill in.

Note: all data is derived from registries, assessments, reviews, users, and domains tables — admins do not enter dashboard data directly; they influence it by configuring the framework and by employees/managers completing workflow steps.

### 3. Manager tab — append to `managerGuide`

Single "Manager Dashboard Widgets" card:

- **KPI cards**:
  - *Team Size* — employees in domains you manage.
  - *Pending My Review* — assessments waiting for your action.
  - *Team Avg Validated Level* — mean approved level for your team.
  - *Reassessments Open* — outstanding reassessment requests you raised.
- **Team Skill Matrix** — Skill × Employee grid of validated levels for your team.
- **Review Queue** — shortcut list of pending reviews (links into the Reviews page).
- **Stuck Employees** — team members blocked (no domain, no recent submission, overdue assessment).

Data source: scoped to domains you manage; populated by team activity — nothing to enter directly on the dashboard.

### 4. Employee tab — append to `employeeGuide`

Single "My Dashboard Widgets" card:

- **KPI cards**:
  - *My Registry* — current version state (Draft / Submitted / Approved).
  - *Skills Assessed* — count of skills with a completed assessment.
  - *My Avg Level* — your average validated level.
  - *Open Tasks* — pending assessments + draft registry reminders.
- **My Skill Snapshot** — your skills grouped by category with self vs validated levels.
- **What's next** — suggested next actions (e.g. submit registry, take pending assessment).

Data source: your own registry, assessments, and reviews — populated automatically as you complete workflow steps.

## Files

- `src/pages/UserGuidePage.tsx` — add `dashboardOverview` array, render it in the always-visible section; append "Admin Dashboard Widgets", "Manager Dashboard Widgets", and "My Dashboard Widgets" entries into `adminGuide`, `managerGuide`, `employeeGuide` respectively. Reuse existing `GuideSectionCard` component and `LayoutDashboard` (or existing) icon.

## Out of scope

- No changes to dashboard components themselves.
- No new tooltips or help popovers on dashboard widgets (guide-only update).
