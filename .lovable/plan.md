## Problem

On `Domains > [Domain] > Skills`, after selecting skills via **Manage Skills** and saving, the newly-mapped skills sometimes do not appear in the tab, even though:
- Mappings are correctly persisted in the database (`domain_skill_mappings` has the rows).
- The tab counter `Skills (N)` shows a non-zero count.

## Root cause

`DomainDetailPage.tsx` groups mapped skills by the legacy **denormalized name** field `skill.skill_category` (lines 88–101):

```ts
const cat = skill.skill_category || 'Uncategorized';
if (!map.has(cat)) map.set(cat, []);
```

This is inconsistent with the rest of the app, which was migrated to use `category_id` as the source of truth (see `DomainSkillManager.tsx` — it groups by `s.category_id` and resolves the display name from `categories`). For skills where `skill_category` is empty or stale (common after category renames or migrations), the grouping still works but any downstream mismatch (empty string category, category deleted, name drift) can produce entries that render as blank/uncategorized rows or silently drop when a search filter is applied. It also diverges from the picker the user just used, causing perceived "missing" skills.

Additionally, the empty-state branches only handle `currentMappings.length === 0` and `mappedByCategory.size === 0 && skillSearch` — if `skills` hasn't finished loading yet on first mount (race between `fetchDomains()` and `fetchSkills()`), the map is empty with no search, falling through to render nothing between the header and an empty body.

## Fix

Align `DomainDetailPage.tsx` Skills tab with the rest of the app:

1. **Group by `category_id`** (source of truth), resolving display name from `categories` via a `Map<id, name>`. Uncategorized skills (blank `category_id`) get a stable `__uncategorised__` bucket labeled "Uncategorized".
2. **Update `mappedByCategory`** to key by `category_id` and carry `{ name, skills }` — same shape used in `DomainSkillManager`.
3. **Search filter** matches on skill name or resolved category name (not the stale denormalized field).
4. **Loading state**: when `currentMappings.length > 0` but the `skills` store hasn't loaded yet, render a small skeleton instead of an empty container.

No changes to `domainStore`, `DomainSkillManager`, or the database — mappings are already correct in DB.

## Files touched

- `src/pages/DomainDetailPage.tsx` — rewrite `mappedByCategory` memo + tab body rendering to group by `category_id`, add a loading skeleton for the not-yet-loaded case.

## Verification

- Open a domain with existing mappings (e.g. Business Analyst → 43 mappings). All 43 skills render grouped under their current category names.
- Add a new skill via **Manage Skills** and save. It appears immediately in the Skills tab under the correct category.
- Rename a category in Skill Library; the domain's Skills tab shows the new name without any skills disappearing.
- Search by category name or skill name filters correctly; clearing the search restores the full list.
