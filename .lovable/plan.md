# Redesign Team Registry listing page

Convert `src/pages/TeamRegistryPage.tsx` from the current card-list layout into a structured table that matches the attached mockup, while keeping all existing data sources, role-based scoping, and navigation behaviour intact.

## Layout

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ Team Registries                                          [ Search… ]   [ Filter ]          │
│ Review and manage skill assessments submitted by your team.                                │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ TEAM MEMBER          REGISTRY SUBJECT     STATUS         COMPLETION         AVG    ACTIONS│
│ ◐ Alice Chen         Frontend Engineering [Up to date]   12/12 Rated 100%   ★ 4.8  Review▸│
│   Senior Frontend…   Updated 1 day ago                   ▰▰▰▰▰▰▰▰▰▰                       │
│ ...                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Columns

1. **Team Member** — circular avatar (initials chip, `bg-primary/10 text-primary`), full name, designation as muted subtext.
2. **Registry Subject** — domain name (foreground, semibold), `Updated {relative time}` muted subtext below.
3. **Status** — pill badge derived from latest registry version:
   - `submitted` and is the latest version → `Up to date` (success).
   - `draft` exists for that employee → `In Progress` (info / blue tint).
   - `submitted` but not latest expected (no current draft, but version count behind cycle) → `Needs Review` (warning).  *MVP rule: treat `submitted` with completion < 100% as `Needs Review`; otherwise `Up to date`.*
4. **Completion** — `X / Y Rated` + `%` aligned right, `Progress` bar below. Bar turns `bg-success` when 100%, `bg-primary` otherwise. Y is the count of skills mapped to the registry's domain (from `domainStore.mappings`).
5. **Avg Rating** — star icon + score scaled to **/5** (`avg / maxLevel * 5`, one decimal), consistent with My Registry. Use competency level count from `competencyLevelStore` (already loaded elsewhere; fetch here too).
6. **Actions** — `Review ›` text-only link button → navigates to `/team-registry/{latestRegistryId}` (existing route).

## Header

- Page title `Team Registries` and the description from the mockup.
- Right-aligned `Search` input (`Search members or roles…`) — filters by employee name and designation, case-insensitive.
- `Filter` button opens a `Popover` with two `Select`s: **Status** (All / Up to date / Needs Review / In Progress) and **Domain** (All / each domain visible to the user).

## Data & logic

- Reuse `useSkillRegistryStore`, `useDomainStore`, `useCompetencyLevelStore`, `useSkillStore` (skills not strictly needed; domain mappings give the denominator).
- Group registries by `employee_id`, pick the highest `version_number` per employee (existing logic).
- Batch-fetch employee `full_name` and `designation` from `users` for ids not already cached.
- Completion denominator = count of `domain_skill_mappings` for `latest.domain_id`. Numerator = `items.get(latest.id).length`.
- Avg = mean of `self_score` across the latest registry's items, then scaled to `/5` using `competencyLevels.length` (fallback 5).
- "Updated" timestamp = `submitted_at ?? modified_at ?? created_at`, rendered with the existing `formatRelative` helper (copy from `SkillRegistryPage.tsx`).
- Role scoping unchanged: admins see everyone; managers see only their own `domain_id`.

## States

- **Loading**: render 4–5 skeleton rows that mirror the table layout.
- **Empty (no registries)**: keep current empty-state copy, centered inside the table card.
- **Empty after filter**: small inline message inside the table body — `No team members match your filters.`

## Technical details

- File touched: `src/pages/TeamRegistryPage.tsx` only (single component rewrite).
- Components used: existing `Table*`, `Input`, `Button`, `Badge`, `Progress`, `Popover`, `Select`, `Skeleton`, `Card` — all already in the project.
- Icons: `Search`, `Filter`, `Star`, `ChevronRight`, `Users` from `lucide-react`.
- Avatar: derive 2-letter initials from `full_name`; render in a `rounded-full` div using semantic tokens (`bg-primary/10 text-primary`) — no hardcoded colours.
- The whole row stays clickable (navigates to detail), with the explicit `Review` link as the visible affordance.
- No store, route, or DB changes. No new dependencies.
