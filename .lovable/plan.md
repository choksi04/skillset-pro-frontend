# Add Top Rated / Lowest Rated Skill stats to My Registry detail

The **My Registry detail** page (`src/pages/SkillRegistryDetailPage.tsx`, submitted/read-only view) currently shows three KPIs in its stats strip: **Total Skills**, **Completion**, and **Avg Rating**. Add two more on the same row: **Top Rated Skill** and **Lowest Rated Skill**.

The Team Registry detail page already has these (added in the previous turn) — this brings the employee-facing view in line.

## Layout

Same horizontal stats strip, two extra cells appended:

```text
TOTAL SKILLS  COMPLETION         AVG RATING   TOP RATED SKILL          LOWEST RATED SKILL
    12        100% (12/12)        ★ 4.2       React (L5)               Jest (L3)
                                              +2 more (tooltip)
```

## Behaviour

- **Top Rated Skill**: skill(s) with the highest `self_score` in the current submitted version. Display first skill name + `(L{score})`. If multiple skills tie at the max, show a `+N` chip (with tooltip listing the rest), matching the existing pattern used on the Team Registry detail page.
- **Lowest Rated Skill**: same shape, for the lowest `self_score`. Ties handled identically.
- If the registry has no rated items, both cells render `—` (consistent with Avg Rating's empty state).
- Values stay text-based (no extra cards) so the strip keeps its current minimalist look. Top/Lowest values get subtle color hints — `text-success` and `text-warning` respectively — to visually echo "best/worst" without adding icons or chrome.
- Strip uses `flex-wrap` already, so the two new cells flow to a second row on narrow viewports.

## Technical notes

- Files modified:
  - `src/pages/SkillRegistryDetailPage.tsx` — extend the existing stats block (around lines 396 and 489–508).
- Compute `maxScore` / `minScore` from `ratedItems` and resolve names via the existing `skills` store. No new fetches, no schema changes.
- Reuse the inline tie-tooltip pattern already present in `TeamRegistryDetailPage.tsx` (small `+N` `Badge` with `Tooltip` listing the remaining skill names) so behaviour matches across both pages.
- Documentation (`mem://features/skill-registry/summary-metrics`) gets a one-line update noting that the submitted-view stats now include Top/Lowest Rated alongside Avg Rating.
