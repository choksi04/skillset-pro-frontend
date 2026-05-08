Root cause found: the heatmap aggregates populated cells using `skills.skill_category`, which is stored as the category name (for example `Frontend`, `.NET`). But the rendered grid looks up cells using `skill_categories.id` (for example `cat-1775719872664`). So the summary card correctly counts populated aggregates, but every displayed cell asks for a different key and resolves to `—`.

Evidence from the database:
- Current “All submitted” aggregation produces 6 populated Domain × Category cells.
- Current render lookup by category ID finds 0 matching cells.
- The same aggregated cells become renderable when mapped by category name.

Plan to fix:
1. Update `src/components/dashboard/admin/SkillHeatmap.tsx` to normalize category references.
   - Build a category lookup that supports both category ID and category name.
   - When aggregating registry items, resolve `skill.skill_category` to the canonical category ID before creating the heatmap key.
   - This will make `cells.get(`${domain.id}|${category.id}`)` match the actual aggregate data.

2. Make the coverage count honest.
   - Count only cells that resolve to active visible domains and active visible categories.
   - This prevents “Cells populated” from including hidden/stale categories or inactive framework entries.

3. Keep navigation filters consistent.
   - Continue navigating with the canonical category ID.
   - If the All Registries page expects category names instead, adjust that filter handling too so cell clicks land on the correct filtered registry view.

4. Add a small resilience fallback.
   - If a skill references a category name that no longer exists, skip it from the visible heatmap rather than counting it as populated.
   - This preserves the Domain × active Category matrix and avoids misleading counts.

After approval, I’ll implement this directly and verify against the current data that the 6 populated cells render as values instead of `—`.