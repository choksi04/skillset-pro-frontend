# Redesign "My Registry" Page

Restyle `src/pages/SkillRegistryPage.tsx` to match the provided mockup. Logic, data sources, and routes stay the same — only the **Current Registry** section's visual structure changes. Version History table and empty/no-domain/no-skills states remain.

## Visual changes

### Page header

- Rename heading from **"Your Skillset Registry"** → **"My Registry"**.
- Subtitle: **"Manage and track your assessed skill sets over time."**
- Add a top-right **"Edit Details"** outline button (pencil icon) — wired to navigate to the draft (if any) or create a new version. Hidden if no domain/skills.

### Current Registry hero card (replaces existing draft/latest/empty card)

A single bordered card containing:

1. **Title row**
  - Large bold **domain name** (e.g. "Software Engineering"), `text-2xl font-bold`.
  - Status pill next to it:
    - Draft 
    - Submitted
    - No registry yet → gray "Not started" pill
2. **Meta row** (small, muted, icons from lucide):
  - History icon + `Updated {N} times` — count of submitted versions for this employee.
  - Clock icon + `Last edit: {relative time}` — uses `submitted_at` (or `created_at` for draft). Format as "2 days ago" via a small inline relative-time helper (no new deps).
3. **Two summary tiles** in a 2-col grid (`grid-cols-1 md:grid-cols-2 gap-4`):
  - **Completion Status**
    - Icon (CheckCircle2) + label.
    - Big number `{rated}` / total `{domainSkills.length}` + `SKILLS RATED` caption.
    - Progress bar underneath (`Progress` from `@/components/ui/progress`).
  - **Overall Average Rating**
    - Icon (BarChart3) + label.
    - Big number (e.g. `4.2`) + 5-star row rendered with `Star` (filled, half, empty based on avg/maxLevel — use `useCompetencyLevelStore` max level, default 5) + caption `Out of {max}.0 possible`.
    - When draft with no ratings yet → show `—` and empty stars.
4. **Footer action row** (right-aligned, separated by a top border):
  - Primary button **"View Detailed Breakdown →"** (ArrowRight icon) → navigates to `/skill-registry/{id}` of draft or latest.
  - For draft state, button label switches to **"Continue Editing →"**.
  - For "no registry yet" state, replace card body with the existing empty-state CTA ("Start Your First Registry" / "Start Self Review") rendered inside the same hero card shell.

### Version History

- Keep the existing table unchanged.

## Technical details

- File touched: `src/pages/SkillRegistryPage.tsx` only.
- Compute averages from `items.get(registryId)` (already fetched via `fetchItemsForRegistries`). Reuse `computeAvg`.
- For "Updated N times" use `submittedRegistries.length` (already derived).
- Relative time: small inline `formatRelative(date)` returning "today", "yesterday", "N days ago", "N weeks ago", "N months ago".
- Stars: render 5 `Star` icons; fill class `fill-amber-400 text-amber-400`; for half star use `StarHalf`. Compute `full = floor(avg)`, `half = avg - full >= 0.5`.
- Max competency level: read from `useCompetencyLevelStore().levels.length` (fallback 5) to keep it dynamic per the dynamic-competency-levels rule.
- Skeleton loader: extend existing skeleton block to match new hero card shape (title + meta + 2 tiles + footer button).
- No store/schema changes. No new dependencies.
- Update memory `mem://features/skill-registry/ux-patterns` after implementation to note "My Registry" rename and hero card layout.