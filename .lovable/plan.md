Goal: Stop the dashboard from issuing heavy data fetches by rendering a static "under construction" placeholder. All other navigation and features remain reachable.

Changes:

1. `src/pages/DashboardPage.tsx`
   - Remove the role-based `AdminDashboard` / `ManagerDashboard` / `EmployeeDashboard` imports and renders.
   - Render a centered placeholder card with:
     - Title: "Dashboard is currently under construction"
     - Subtitle: "All other features are functional. Use the menu to navigate to Skill Registry, Assessments, Skill Library, Domains, etc."
     - A simple icon (e.g., `Construction` or `HardHat` from lucide-react).
   - Keep `data-tour="dashboard"` on the wrapper for tour compatibility.
   - Remove `DashboardNotice` so the experimental/beta banner is not shown on this placeholder page.

2. `src/components/layout/AppSidebar.tsx`
   - No change required; keep the Dashboard link in the sidebar so the route still works and users can see the placeholder. Active state on `/` will still work correctly.

3. `src/App.tsx`
   - No change required; the root route remains `/` → `DashboardPage`.

Verification:
- Open `/` after the change. The page should show the construction placeholder only, with no network requests for dashboard stats/charts.
- Confirm sidebar navigation to `/skill-registry`, `/assessments`, `/questions`, etc. still works.
- Confirm the build/typecheck passes.