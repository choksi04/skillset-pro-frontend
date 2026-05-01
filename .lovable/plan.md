## Goal

Replace the current role-based `DashboardPage` with a simple, polished **"Dashboard — Coming Soon"** screen. This is a temporary placeholder until a properly designed dashboard is built. It should reassure users the platform is functional and guide them to the parts of the product that *are* live.

## Scope

- File touched: `src/pages/DashboardPage.tsx` (full rewrite, kept small)
- No routing changes, no new components, no store changes, no DB changes
- Existing data fetching (`fetchSkills`, `fetchAssessments`, etc.) on the dashboard will be **removed** — this fixes a meaningful chunk of the "too many API calls" concern raised earlier, since the landing route currently fires 7 store fetches on mount that the placeholder doesn't need.

## UX Design

Single centered, minimal layout. Subtle, neutral, with a small indigo/blue accent — consistent with project visual identity. Works in light + dark mode.

```text
┌──────────────────────────────────────────────────────────────┐
│  Welcome back, {first name}                                  │
│  Your skill intelligence workspace                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  [icon]  Dashboard — Coming Soon                       │  │
│  │                                                        │  │
│  │  We're crafting a focused dashboard with the           │  │
│  │  insights that matter most. In the meantime, the       │  │
│  │  platform is fully usable — jump into the modules     │  │
│  │  below to get started.                                 │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Explore what's available today                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Skill        │  │ Assessments  │  │ Team         │        │
│  │ Registry     │  │              │  │ Registry *   │        │
│  │ Self-rate…   │  │ Take/review… │  │ Review team… │        │
│  │ Open →       │  │ Open →       │  │ Open →       │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│  (cards shown depend on role)                                │
│                                                              │
│  Need a tour? → Open the User Guide                          │
└──────────────────────────────────────────────────────────────┘
```

### Card visibility by role

- **Employee**: Skill Registry, My Assessments, User Guide
- **Manager**: Skill Registry, My Assessments, Team Registry, Team Assessments, Manager Reviews, User Guide
- **Admin**: Skill Library, Domains, Question Bank, Assessment Templates, All Registries, User Guide

Each card: small lucide icon in a soft `bg-primary/10` square, short title, one-line description, subtle `Open →` affordance. Entire card is clickable (uses `useNavigate`).

### Visual details

- Outer container: `space-y-8`, max width `max-w-5xl`
- Hero card: single `Card` with muted border, soft gradient or plain `bg-card`, small `Sparkles` / `Construction` icon in a rounded square, "Coming Soon" pill badge using existing `Badge` variant
- Module grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- Hover: `hover:border-primary/40 hover:shadow-sm transition` — subtle, no heavy effects
- Footer line: muted text linking to `/help`

## Technical Notes

- Keep `useAuth()` for greeting + role-based card list
- Remove all store imports and the big `useEffect` that fetches 7 stores
- Preserve the `data-tour="dashboard"` attribute on the root so the existing guided tour selectors don't break
- Drop unused imports (`Progress`, `useSkillStore`, etc.)
- No new files; no changes to `QuickStartChecklist` (it stays available elsewhere if referenced — verify no other page imports break; it's only used inside DashboardPage today, but the component file remains untouched so nothing else regresses)

## Out of Scope

- No changes to the sidebar, routes, or other pages
- No new "real" dashboard widgets — that's the next iteration
- No analytics/telemetry hooks