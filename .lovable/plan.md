## Plan: Full Application Navigation, Layout & Dark Mode Refactor

This is a major structural refactor covering sidebar reorganization, route cleanup, role-adaptive dashboard, dark mode toggle, setup progress indicator, breadcrumb navigation, and documentation updates.

No database or data model changes are required.

---

### New Sidebar Structure

```text
INSIGHTS                       [varies]
  Dashboard                    [all]
  All Registries               [admin]

---------------------------
[need better label]
  Skillset Registry            [all]
  Assessments                  [all]
------------------------------
Setting         [admin, manager where noted]
  Skill Library                [admin, manager]
  Domains                      [admin, manager]
  Users                        [admin]
  Question Bank                [admin, manager]
  Question Settings            [admin]
  Review Cycles                [admin, manager]
-----------------------------------------------
SUPPORT
  Help & Tutorial              [all]
```

Employee sees: Skillset Registry, Assessments, Dashboard, Help & Tutorial (flat, no group headers needed for such a short list).

---

### Step 1: Rewrite AppSidebar with collapsible groups

**File: `src/components/layout/AppSidebar.tsx**`

- Replace flat item list with grouped structure using section labels (small uppercase text).
- Each group: `{ label, items: { title, href, icon, roles }[] }`.
- Groups only render if the user's role matches at least one item.
- Add dark mode toggle button at the bottom (moon/sun icon) that toggles `.dark` class on `<html>`.
- Add a "Setup Progress" indicator in the Setup section header for admin role — shows completed steps count (skills exist, domains exist, users exist, questions exist, cycle exists) as a small `3/5` badge.
- Remove: Organization, Domain-Skill Map, Take Assessment (merged into Assessments), Skill Analytics (renamed to Dashboard insights).

### Step 2: Update routes in App.tsx

**File: `src/App.tsx**`

Route mapping changes:

- `/skills` → `/skill-library`
- `/registry` → `/skill-registry`
- `/skill-analytics` → remove (merge into Dashboard)
- `/reviews` → `/review-cycles`
- `/guide` → `/help`
- `/assessment-exec` → remove as standalone route (merge into `/assessments`)
- `/organization` → remove
- `/domain-skills` → remove
- Add `/question-settings` route (admin only)
- Add `/all-registries` route (admin only)

Update all `RoleGuard` `allowed` arrays per new role visibility.

### Step 3: Add breadcrumb navigation to PageHeader

**File: `src/components/layout/PageHeader.tsx**`

- Replace static `h1` with breadcrumbs built from `location.pathname`.
- Map each route to `[groupLabel, pageTitle]` for two-level breadcrumbs.
- Example: `/skill-library` → `Setup & Configuration > Skill Library`.
- Keep the right-side actions (search, help, notifications).

### Step 4: Dark mode toggle

**File: `src/components/layout/AppSidebar.tsx**` (toggle button in sidebar footer)

- Create a small `useTheme` hook or inline logic:
  - Read initial state from `localStorage('siap-theme')` or `prefers-color-scheme`.
  - Toggle `document.documentElement.classList.toggle('dark')`.
  - Persist to `localStorage`.
- Dark mode CSS variables already exist in `index.css` — no changes needed there.

### Step 5: Role-adaptive Dashboard

**File: `src/pages/DashboardPage.tsx**`

Rewrite to render different sections by role:

- **Admin**: Org stats (total users, skills, domains, active assessments from stores), cycle status, completion metrics, setup progress prompt if incomplete.
- **Manager**: Team assessments pending, team skill overview, action items.
- **Employee**: Active cycle status, pending actions (submit registry, take assessment), recent results, "Contact admin to assign domain" message if no domain assigned.

Pull real data from existing stores instead of hardcoded values.

### Step 6: Setup Progress Indicator

**New component: `src/components/layout/SetupProgress.tsx**`

- Shows for admin only, in the sidebar's Setup section.
- 5 steps: Skills created, Domains created, Users added, Questions added, Cycle started.
- Check completion from stores (skills.length > 0, domains.length > 0, etc.).
- Renders as a compact horizontal progress bar with `3/5` label.

### Step 7: Create Question Settings page

**New file: `src/pages/QuestionSettingsPage.tsx**`

- Admin-only page for managing question difficulty levels and experience levels.
- For now, display the current level definitions (beginner/intermediate/advanced/expert) as editable cards.
- This is a configuration page — uses card-based layout with the standard page template (Header, Description, Action, Content).

### Step 8: Create All Registries page

**New file: `src/pages/AllRegistriesPage.tsx**`

- Extract the registry table from `HRDashboardPage.tsx` into a standalone admin page.
- Includes search, domain filter, CSV export.
- Follows standard page template.

### Step 9: Merge assessment execution into AssessmentsPage

**File: `src/pages/AssessmentsPage.tsx**`

- Import assessment execution components from `AssessmentExecPage.tsx`.
- When employee clicks "Start/Resume", render the execution view inline (or as a full-page takeover within the same route) instead of navigating to `/assessment-exec`.

### Step 10: Page template consistency

Apply to all page components the pattern:

```text
<div className="space-y-6">
  <div className="flex items-center justify-between">
    <div>
      <h2>Page Title</h2>
      <p>Description</p>
    </div>
    <PrimaryActionButton />  {/* if applicable */}
  </div>
  <Content />
</div>
```

Audit and fix: `SkillFrameworkPage`, `DomainsPage`, `QuestionBankPage`, `UsersPage`, `SkillRegistryPage`, `ReviewsPage`.

### Step 11: Update internal route references

Search and replace all old paths across the codebase:

- `/skills` → `/skill-library`
- `/registry` → `/skill-registry`
- `/reviews` → `/review-cycles`
- `/guide` → `/help`
- `/skill-analytics` → `/analytics` or dashboard
- `/assessment-exec` → `/assessments`
- `/organization` → remove references

Files affected: `onboardingStore.ts`, `QuickStartChecklist.tsx`, `AssessmentExecPage.tsx`, `SkillRegistryPage.tsx`, any `navigate()` or `<Link>` calls.

### Step 12: Update User Guide

**File: `src/pages/UserGuidePage.tsx**`

- Update all module names and navigation references.
- Add section explaining the 3-group navigation structure.
- Update role-based access explanation.
- Add setup flow explanation (5-step process).

### Step 13: Cleanup

- Remove `src/pages/OrganizationPage.tsx` (placeholder only).
- Remove `src/pages/DomainSkillMappingPage.tsx` (redundant — accessible from domain detail).
- Keep `src/pages/AssessmentExecPage.tsx` but refactor as an importable component, not a routed page.
- Remove `/assessment-exec` and `/organization` and `/domain-skills` routes from `App.tsx`.

---

### Files Summary


| Action  | File                                                |
| ------- | --------------------------------------------------- |
| Rewrite | `src/components/layout/AppSidebar.tsx`              |
| Rewrite | `src/components/layout/PageHeader.tsx`              |
| Rewrite | `src/components/layout/AppLayout.tsx`               |
| Rewrite | `src/pages/DashboardPage.tsx`                       |
| Modify  | `src/App.tsx`                                       |
| Modify  | `src/pages/AssessmentsPage.tsx`                     |
| Modify  | `src/pages/AssessmentExecPage.tsx`                  |
| Modify  | `src/pages/UserGuidePage.tsx`                       |
| Modify  | `src/stores/onboardingStore.ts`                     |
| Modify  | `src/components/onboarding/QuickStartChecklist.tsx` |
| Modify  | `src/pages/SkillFrameworkPage.tsx` (rename refs)    |
| Modify  | `src/pages/SkillRegistryPage.tsx` (rename refs)     |
| Modify  | `src/pages/ReviewsPage.tsx` (route update)          |
| Create  | `src/components/layout/SetupProgress.tsx`           |
| Create  | `src/pages/QuestionSettingsPage.tsx`                |
| Create  | `src/pages/AllRegistriesPage.tsx`                   |
| Create  | `src/hooks/useTheme.ts`                             |
| Delete  | `src/pages/OrganizationPage.tsx`                    |
| Delete  | `src/pages/DomainSkillMappingPage.tsx`              |
