# Skill Registry: Label Updates + Avg Level & Top/Lowest Skills

## Changes

### `src/pages/SkillRegistryPage.tsx`

**Label change**: Replace "Version X" with "Your Skillset Registry" as the title, and show "v{X}" as small muted text beneath it with full date (including day) and time.

**Add avg level**: For the current/latest submitted card and each version history row, compute the average self_score from loaded items and display it (e.g. "Avg Level: 3.2").

To compute avg, the store needs items loaded for each registry. We'll add a method to the store or compute inline by fetching items for displayed registries.

### `src/stores/skillRegistryStore.ts`

Add a `fetchItemsForRegistries(ids: string[])` batch method that loads items for multiple registries (for the listing page), so we can compute avg scores without N+1 calls.

### `src/pages/SkillRegistryDetailPage.tsx`

**Label change**: Same — "Your Skillset Registry" with "v{X}" as subtitle text. Below is show the full date (including day) and time.

**Add summary section** (for submitted view, above the skill accordion):

- **Avg Level** tile: average of all self_scores, rounded to 1 decimal
- **Top Rated Skills**: skills with the highest self_score (all skills sharing the max score), if more than 1 available, show 1 and rest as "+X" with hover show more.
- **Lowest Rated Skills**: skills with the lowest self_score (all skills sharing the min score). if more than 1 available, show 1 and rest as "+X" with hover show more

Display these in a small card/grid section between the header and the skill list.

## Technical Details

**Avg calculation**: `Math.round((sum of self_scores / count) * 10) / 10`

**Top/Lowest**: Filter `ratings` entries to find max and min values, list all skill names matching those values.

**Items loading on listing page**: On `SkillRegistryPage` mount, after fetching registries, call `fetchItemsForRegistries` for all displayed registry IDs so avg scores are available.

## Files Modified


| File                                    | Change                                               |
| --------------------------------------- | ---------------------------------------------------- |
| `src/stores/skillRegistryStore.ts`      | Add batch `fetchItemsForRegistries`                  |
| `src/pages/SkillRegistryPage.tsx`       | Label → "Your Skillset Registry" + avg level display |
| `src/pages/SkillRegistryDetailPage.tsx` | Label + summary cards (avg, top, lowest)             |
