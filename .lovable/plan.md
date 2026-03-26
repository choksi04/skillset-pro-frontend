## Plan: Completed — Enhanced My Skill Registry with Full Scores & Detail View

### What was done

1. **Registry Listing** — Always shows all submissions (active cycle on top, past below). Each card displays: Cycle Name, Self-Score avg, Assessment Score avg, Final Score avg, Manager avatar with hover card (name + email), Status badge.

2. **Active Cycle Card** — Retains prominent design with CTA + now shows inline score chips.

3. **Past Registry Detail View** — Clicking any past registry opens a detail page with score summary cards, manager info + comments, and per-skill table grouped by category showing Self / Assessment / Final / Gap.

4. **No active cycle** — Page still renders past registries. No empty state.

5. **Data cross-referencing** — Scores computed from `attempt_skill_scores` (assessment), `official_skill_entries` (final), `manager_reviews` → `users` (reviewer info).
