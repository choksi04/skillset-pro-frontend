# Redesign My Registry → Detail Page

Restyle `src/pages/SkillRegistryDetailPage.tsx` to match the mockup. Only the **submitted (read-only)** view is redesigned. The draft self-review form (`SelfReviewForm`) is unchanged in behavior, only entered via the new "Edit Ratings" action. Routes, store calls, and submit flow are untouched.

## Visual changes (submitted view)

### Header row

- Replace current "Your Skillset Registry" title block with:
  - **"← Back to Registries"** ghost link (replaces current "Back to My Registry" — points to `/skill-registry`).
  - Title row: bold **{domain.name}** + green **"Up to date"** pill (or amber **Draft** when applicable).
  - Subtitle: domain description (`assignedDomain.description`); fallback to a generic line if empty.
  - Right side: **"Viewing: Version N (Latest)"** dropdown built with shadcn `DropdownMenu` (or `Select`), listing all submitted versions for this employee. Selecting an item navigates to that registry's detail page. The current version is marked "(Latest)" if it equals the highest version_number.
- Thin divider below the header.

### Stats strip

A single horizontal flex row (no card borders), 3 stats separated by spacing. Each stat:

- Uppercase muted label (`TOTAL SKILLS`, `COMPLETION`, `AVG RATING`).
- Value below in larger text:
  - **Total Skills**: `{domainSkills.length}` (count of skills mapped to the domain).
  - **Completion**: `{percentage}% ({rated}/{total})` — percentage in primary blue.
  - **Avg Rating**: amber star icon + `{avg.toFixed(1)}` (mapped to /5 scale using maxLevel).
  - **Top Rated:** Show the top rated skill with rate
    **Lowest Rated:** Show the least rated skill with rate  

- Thin divider below the strip.

### Skill Breakdown section

- Section header row: **"Skill Breakdown"** title + right-aligned **"Edit Ratings"** outline button (pencil icon). Clicking creates/opens a draft via `createNewVersion` and navigates to it (only enabled when viewing latest submitted version; hidden for drafts since edit mode already shows the form).
- Table-style list inside a rounded bordered container. Columns:
  1.  **SKILL / Category**— skill name (medium), category name muted below.
  2. **RATING** — `{score}.0 / {max}.0` text + horizontal `Progress` bar (primary fill).
  3. **SELF-ASSESSMENT DETAILS** — comment text in muted color (italic empty placeholder when missing).
- Rows separated by `divide-y`. Skills are listed flat (no accordion); sorted by category then skill name to keep grouping visible.
- For drafts, the existing `SelfReviewForm` continues to render (no change).

### Removed/relocated

- Remove the 3-card "Average / Top / Lowest" summary block (replaced by stats strip).
- Remove the read-only Accordion grouping (replaced by flat table).
- Search input is removed from the read-only view (not in mockup).

## Technical details

- File touched: `src/pages/SkillRegistryDetailPage.tsx` only.
- Use `useCompetencyLevelStore().levels.length` (fallback 5) for max level; render rating as `(score / max * 5)` for the `/5.0` display + Progress bar percentage = `score/max*100`.
- Version dropdown: filter `registries` for `employee_id === employeeId && status === 'submitted'`, sort desc by version_number. Use shadcn `DropdownMenu` with `Button variant="outline"` trigger.
- Star icon: lucide `Star` filled with `fill-amber-400 text-amber-400`.
- "Back to Registries" → label updated; route unchanged.
- Skeleton/loading states: existing `if (!registry)` fallback retained; add a small skeleton block when items aren't loaded yet (avoid 0/0 flash) by gating the stats/table on `itemsLoaded`.
- No store/schema/route changes. No new dependencies.
- Update memory `mem://features/skill-registry/detail-view-design` after implementation to note: header with version switcher, horizontal stats strip, flat skill breakdown table with progress bars and comment column, "Edit Ratings" entry point.