# Team Registry: make sorting controls visible

## Root cause

The sorting code is present and working. Verified in the live preview (signed in as an Admin): all five headers — Team Member, Registry Subject, Status, Completion, Avg Rating — render as clickable buttons with sort icons, Team Member shows the active ascending arrow on load, and `aria-sort` is set. The most likely reason they were not seen: the published site (skillset.1rivet.com) has not been republished since the sorting change, so it still serves the old table. A secondary, real issue: the icons are very small (12px) and inactive ones are dimmed to 40% opacity, so even in the preview they are easy to miss.

## Fix (smallest safe change)

1. **Improve icon visibility** in `src/pages/TeamRegistryPage.tsx` (header buttons only):
   - Increase icon size from 12 to 14.
   - Raise inactive icon opacity from 40% to 70% so the up/down sort icon is clearly visible without hovering.
   - Keep everything else: same button, same `handleSort` logic, same `aria-sort`, same aria-labels, same default (Team Member ascending), same toggle behavior.
2. **Republish the app** so the published site and custom domain serve the version that includes sorting.

## What stays unchanged

- Sorting logic (`src/lib/teamRegistrySort.ts`), pagination, search, filters, CSV export order, Admin/Manager scoping, file structure.

## Verification

- Re-run the browser check (Admin + a Manager account): confirm all five icons are visible at desktop and mobile widths, Team Member shows the ascending arrow on load, clicking a header reorders rows and updates the indicator, keyboard (Tab + Enter) works.
- Confirm pagination and CSV export still follow the selected sort.
- Run existing sort unit tests.
- Republish and confirm the published URL shows the controls.

## Deliverables after implementation

- Root cause summary, files changed, tests performed, manual validation steps.
