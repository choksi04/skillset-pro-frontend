## Goal
Replace the single dashboard-intro tour with a **role-aware sidebar walkthrough**. The tour stays on the current page, highlights each visible sidebar menu item one by one, and explains what that section is for. No route navigation during the tour.

## Behavior

- Tour starts wherever the user is (typically `/`). It does **not** navigate.
- Step 1 is a centered "Welcome / this is your Dashboard" intro.
- Each subsequent step highlights one sidebar nav item (My Registry, Team Registry, My Assessments, etc.) with a short description of its purpose, tooltip positioned to the `right` of the sidebar item.
- Steps are filtered by role so the user only sees steps for menu items they can actually see:
  - **Admin**: Dashboard, All Registries, My Registry, Team Registry, My Assessments, Team Assessments, Skill Library, Domains, Question Bank, Assessment Config, Assessment Templates, Users, Help & Tutorial
  - **Manager**: Dashboard, My Registry, Team Registry, My Assessments, Team Assessments, Skill Library, Domains, Question Bank, Assessment Templates, Help & Tutorial
  - **Employee**: Dashboard, My Registry, My Assessments, Help & Tutorial
- Existing safety nets stay: floating top-right X, ESC key, Skip / Later, viewport clamping.

## Changes

### 1. `src/components/layout/AppSidebar.tsx`
Add a `data-tour="nav-<key>"` attribute to each `NavLink` so the tour can target them. Key derived from href (e.g. `/` → `dashboard`, `/skill-registry` → `my-registry`, `/team-registry` → `team-registry`, etc.). Purely additive, no visual change.

### 2. `src/stores/onboardingStore.ts`
Replace `dashboardIntroStep` with an array of steps — one centered intro + one step per sidebar item. Each sidebar step:
- `targetSelector: '[data-tour="nav-<key>"]'`
- `position: 'right'`
- `roles: [...]` matching the sidebar item's `roles`
- **No `targetRoute`** (so the tour never navigates away from the current page).

`getTourStepsForRole(role)` filters the array by `roles.includes(role)` and returns the result.

### 3. `src/components/onboarding/GuidedTour.tsx`
Minor: when a step has no `targetRoute`, skip the `navigate()` call (already conditional, just confirming). No other logic changes — clamping, ESC, X button, Skip/Later/Back/Next stay.

### 4. `src/pages/UserGuidePage.tsx`
Update the small intro note: the in-app tour is now a quick role-aware walkthrough of the sidebar menu; the User Guide remains the detailed reference.

## Out of scope
- No route changes, no welcome-modal/checklist changes, no new pages.
- No business-logic changes.

## Step copy (concise, one sentence each)

- **Dashboard** — Your home view with role-specific KPIs and quick actions.
- **All Registries** (admin) — Organization-wide directory of every employee's skill registry.
- **My Registry** — Your personal skill self-assessment and approved levels.
- **Team Registry** (admin/manager) — Registries of employees in domains you lead.
- **My Assessments** — Assessments assigned to you, in progress or completed.
- **Team Assessments** (admin/manager) — Assessments of employees in your domains, for review.
- **Skill Library** (admin/manager) — Catalog of skill categories, skills and topics.
- **Domains** (admin/manager) — Practice areas grouping people and skills.
- **Question Bank** (admin/manager) — MCQ, coding and scenario questions powering assessments.
- **Assessment Config** (admin) — Global rules: question counts, passing thresholds, scoring.
- **Assessment Templates** (admin/manager) — Reusable assessment definitions to assign to employees.
- **Users** (admin) — Manage accounts, roles and domain assignments.
- **Help & Tutorial** — Full user guide and option to replay this tour.
