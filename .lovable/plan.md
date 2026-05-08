## Add Dashboard Notice Banner

Add a dismissible info/alert section at the very top of the dashboard (above all role-specific content) that conveys two messages to users.

### Where
- Render inside `src/pages/DashboardPage.tsx`, above the role switch, so it appears for Admin, Manager, and Employee dashboards in one place.

### What it shows
A single shadcn `Alert` (or compact card) using `Info` icon and muted/primary-tinted styling, containing two stacked items:

1. **Experimental Dashboard**
   - Title: "Experimental dashboard"
   - Body: "This dashboard is experimental and will continue to evolve. Layout, widgets, and metrics may change in upcoming releases."

2. **Application in Beta**
   - Title: "SIAP is in Beta"
   - Body: same wording aligned with the existing Beta badge tooltip — "You're using an early version — your feedback shapes what comes next. Reach out to Team Aekatra."

### New component
- `src/components/dashboard/shared/DashboardNotice.tsx`
  - Self-contained, presentational only.
  - Uses semantic tokens (`bg-primary/5`, `border-primary/20`, `text-muted-foreground`, etc.) — no hardcoded colors.
  - Uses lucide `Info` / `Sparkles` icons for the two rows.
  - Includes a dismiss (×) button that hides it for the session via `sessionStorage` key `dashboard-notice-dismissed` (so it returns next session, since it's important context). No DB writes.

### Wiring
- Import `DashboardNotice` in `DashboardPage.tsx` and render above the role-based dashboard with a small bottom margin.

### Out of scope
- No changes to the sidebar Beta badge.
- No persistence in DB, no per-user dismiss tracking.
- No changes to dashboard widgets themselves.