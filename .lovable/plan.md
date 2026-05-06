# Admin Skill Heatmap — Polish & Extract

## Context

The Admin Skill Heatmap (Domain × Skill Category, fed by approved registries) already ships in `src/components/dashboard/admin/AdminDashboard.tsx` as part of Phase 1. It renders a color-coded grid, has Skeleton loading, and has two empty states. This task tightens it into a proper, reusable widget with better signal density, a legend, click-through, and stronger empty/loading affordances.

No data model changes. No new tables. No backend work.

## What changes

### 1. Extract to its own component

Create `src/components/dashboard/admin/SkillHeatmap.tsx` and move all heatmap logic (data aggregation + render) out of `AdminDashboard.tsx`. The Admin dashboard just renders `<SkillHeatmap />` inside the existing section.

Props:
- `loading: boolean`
- `domains`, `categories`, `skills`, `registries`, `items`, `reviewStatuses` (passed from parent so we don't re-fetch)
- `onNavigateRegistries: () => void` — used by empty-state CTA and "See all"

### 2. Aggregation upgrades

The cell value stays the **mean self_score across approved-registry items** for `(employee.domain_id, skill.skill_category)`. We additionally track:

- `employeeCount` — distinct employees that contributed to the cell
- `itemCount` — total scored items in the cell

These power the tooltip: `"Avg L3.2 · 4 employees · 11 ratings"`.

### 3. Visual upgrades

- **Legend row** below the table: 5 swatches (L1…L5) using `getLevelColorClass`, plus a "—" swatch labelled "No data". Pulls labels dynamically from `useCompetencyLevelStore` (per project rule: levels are dynamic).
- **Row totals column** on the right: per-domain average across all populated categories.
- **Column totals row** at the bottom: per-category average across all populated domains.
- **Hide-empty toggle** (small `Switch` in the section header): "Show only populated rows/columns". Default ON when there is sparse data (>50% empty cells), OFF otherwise.
- Cell click navigates to `/all-registries?domain=<id>&category=<id>` (filter params already understood — if not yet supported, link still resolves to `/all-registries` and we file a follow-up; we will not touch AllRegistriesPage in this task).

### 4. Empty / loading states

Three explicit branches, all rendered inside the same `Card` so layout doesn't shift:

| Condition | Shown |
|---|---|
| `loading` | A "ghost" heatmap: Skeleton header row + 4 Skeleton body rows of 6 cells each (uses real grid, not a single big Skeleton). |
| `domains.length === 0 \|\| categories.length === 0` | EmptyState: "Set up your skill framework first" → CTA "Manage domains" + secondary "Manage skill framework". |
| `latestApprovedPerEmployee.size === 0` | EmptyState: "No approved registries yet" with a 1-line explainer of what unlocks this widget (managers approving team registries) and a secondary CTA "Open All Registries". |
| Some domains/categories populated, others empty | Render the table with "—" in empty cells and a soft footer note: `"X of Y cells populated"`. |

### 5. SectionHeader

Keep current header but add a small "Updated just now" timestamp on the right (derived from `max(modified_at)` across approved registries we used) so admins know freshness at a glance.

## Files

- **edit** `src/components/dashboard/admin/AdminDashboard.tsx` — remove inline heatmap block, render `<SkillHeatmap … />`, pass already-fetched data.
- **create** `src/components/dashboard/admin/SkillHeatmap.tsx` — the widget.
- No store changes, no migrations, no edge functions.

## Out of scope (intentionally)

- Replacing `self_score` with true validated/manager scores at the cell level (waits for a dedicated approved-score join; tracked separately).
- Filters at the dashboard level (admin-wide domain/manager/skill filters belong to Phase 2 per the approved blueprint).
- Drilldown page changes.
