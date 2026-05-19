# Plan: Show L1–L5 competency levels clearly in the User Guide

## Goal
Make the 5-level competency framework (L1 → L5) easy to find and understand inside the Help & Tutorial page, for all roles. Data is read dynamically from the `competency_levels` table (never hardcoded), matching project standard.

## Where it appears
On `src/pages/UserGuidePage.tsx`, insert a new prominent section titled **"Competency Levels (L1 – L5)"** directly under the existing "How the Platform Works" banner and above the role tabs. Visible to Admin, Manager, and Employee.

## What it shows
A compact 5-row card (or table) — one row per level — pulled live from `useCompetencyLevelStore`:

```text
┌────┬──────────────────────┬──────────────┬──────────────────────────────────────────────┐
│ L# │ Label                │ Score Range  │ What it means                                │
├────┼──────────────────────┼──────────────┼──────────────────────────────────────────────┤
│ L1 │ None / Low           │ 0 – 39       │ Unable to perform basic tasks. No exp.       │
│ L2 │ Basic                │ 40 – 56      │ Limited / basic level. No critical tasks.    │
│ L3 │ Demonstrating        │ 60 – 74      │ Basic→advanced w/ some SME direction.        │
│ L4 │ Proficient           │ 75 – 89      │ Independent, can train & lead others.        │
│ L5 │ Expert               │ 90 – 100     │ SME, cross-dept consultation, train & lead.  │
└────┴──────────────────────┴──────────────┴──────────────────────────────────────────────┘
```

Each row uses the existing `getLevelColorClass(level)` semantic token so colors align with badges used elsewhere (red→green progression).

A short helper line above the table:
> "Every skill in the platform is rated on this 5-level scale. Self-ratings, assessment achieved levels, and manager-verified levels all use the same vocabulary."

A small note below for transparency:
> "Levels and score ranges are configured by admins under Settings → Assessment Config and are read live from the database."

## Implementation details (technical)
- File: `src/pages/UserGuidePage.tsx`
- Add a new component `CompetencyLevelsCard` in the same file (or co-located) that:
  - Calls `useCompetencyLevelStore()` and, if `!initialized`, triggers `fetchLevels()` on mount.
  - Filters `levels` to `status === 'active'`, sorted by `level` ASC.
  - Renders rows with `getLevelColorClass(level)` for the L# pill, `label`, `score_range_min–score_range_max`, and `description`.
  - Graceful empty state if no levels loaded yet (skeleton or "Loading competency levels…").
- Place the card between the "How the Platform Works" banner and the `platformOverview` accordion list.
- No DB changes, no store changes, no routing changes. Purely additive UI.

## Out of scope
- No edits to other guide sections (Admin/Manager/Employee accordions stay as-is).
- No changes to the in-app guided tour.
- No new translations or copy elsewhere.
