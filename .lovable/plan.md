# Fix: Skills mapped to Category by NAME instead of ID

## Root cause

`public.skills.skill_category` is a free-text column that stores the **category name** (e.g. `"Frontend"`), not the category id (`cat-1775719872664`). This violates the "map by ID only" rule we agreed on earlier.

Consequences confirmed in the live database:

- Renaming a category in `skill_categories` silently breaks the link for every skill that referenced the old name.
- Case / whitespace variations create silent orphans.
- **There are already 11 orphan skills** in the DB pointing to a category name `"Business Analyst"` that no longer exists in `skill_categories`. Those skills currently render under "Uncategorized" everywhere.

Other related tables were audited and are fine:

- `skill_topics.skill_id` → uses skill ID (OK)
- `domain_skill_mappings.skill_id` / `domain_id` → use IDs (OK)
- `questions.skill_id` / `topic_id` → use IDs (OK)

So the problem is isolated to `**skills.skill_category**`.

## Where this leaks into the code

The name-based join is used in ~20 places. Representative ones:

- `src/stores/skillStore.ts` — `s.skill_category === cat.name` for child lookup and cascade status logic
- `src/pages/CategoryDetailPage.tsx` — filters skills by `category.name`
- `src/pages/SkillFrameworkPage.tsx`, `DomainDetailPage.tsx`, `SkillRegistryDetailPage.tsx`, `TeamRegistryDetailPage.tsx`, `AllRegistriesPage.tsx`, `HRDashboardPage.tsx` — group skills by `s.skill_category` (name)
- `src/components/skills/SkillFormDialog.tsx` — writes the category **name** into `skill_category` on create/edit
- `src/components/dashboard/admin/SkillHeatmap.tsx` / `TopSkillsPanel.tsx` / `AdminFiltersContext.tsx` — resolve category by name (heatmap already has a name→id workaround that proves the bug)
- `src/components/domains/DomainSkillManager.tsx`, `DomainSkillMapDialog.tsx` — group/filter by name

## Proposed solution

### 1. Schema migration

Add a proper FK-style column and keep the legacy column briefly for safety:

```sql
ALTER TABLE public.skills
  ADD COLUMN category_id text;

-- backfill from the existing name
UPDATE public.skills s
SET category_id = c.id
FROM public.skill_categories c
WHERE c.name = s.skill_category
  AND c.deleted_on IS NULL;

CREATE INDEX idx_skills_category_id ON public.skills(category_id);
```

`skill_category` (text/name) will be **kept temporarily** as a denormalised label, then dropped in a follow-up migration once the app no longer reads it.

### 2. Orphan cleanup (needs your input — see "Open question" below)

11 skills point to a non-existent category `"Business Analyst"`. The two existing close matches are `Business Analyst - Interpersonal & Communication` and `Business Analyst - Technical & Additional`. Options:

- (a) Create a new category `Business Analyst` and assign all 11 to it.
- (b) Manually re-map each to one of the two existing BA categories.
  - For "Business Analyst", use this skill_category id: "cat-1780481628021" to replace.
- (c) Leave `category_id` null for those 11 and let you fix them in the UI.

### 3. App code refactor (single sweep)

- `skillStore`: load `category_id`, expose it on the Skill type, replace every `s.skill_category === cat.name` with `s.category_id === cat.id`.
- `SkillFormDialog`: write `category_id` (the id of the picked/created category) instead of the name. Stop writing `skill_category` text once column is dropped.
- All grouping / filtering / breadcrumb / heatmap / dashboard code: group by `category_id`, resolve display name via `categories` map.
- Remove the name→id workaround in `SkillHeatmap.tsx` and `AdminFiltersContext.tsx`.
- Update `src/integrations/supabase/types.ts` will regenerate automatically after the migration.

### 4. Follow-up migration (after app deploy is verified)

```sql
ALTER TABLE public.skills DROP COLUMN skill_category;
```

Done as a second migration so we can roll back safely if anything still reads the legacy field.

### 5. Guardrail

Add a lightweight check trigger (optional) to reject inserts/updates where `category_id` is not null but doesn't exist in `skill_categories`. Cheap insurance against the bug returning.

## Out of scope

- No changes to `skill_topics`, `domain_skill_mappings`, `questions`, registries, assessments — already keyed by IDs.
- No UI redesign — only the underlying field swap; visible category labels look identical to users.

## Open question (please answer before I implement)

How should the **11 orphan skills currently pointing to** `"Business Analyst"` be handled? Ans: Options (b)