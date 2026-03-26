## Plan: Completed — Child Routes for Registry Detail Pages

### What was done

1. **Shared registry components** extracted to `src/components/registry/`:
   - `ScoreChip.tsx`, `ManagerAvatar.tsx`, `ScoreCard.tsx`, `RegistrySkillTable.tsx`, `registryHelpers.ts`

2. **SkillRegistryPage** — Stripped to listing-only. Active card + past registry cards with score columns. CTAs navigate to `/skill-registry/:id`.

3. **SkillRegistryDetailPage** — New child route. Shows Self-Review form for drafts, read-only detail view (score cards + skill table) for submitted/completed.

4. **TeamRegistryPage** — Rewritten with enrichment logic. Each submission card shows Self/Assessment/Final/Manager/Status. Clicks navigate to `/team-registry/:id`.

5. **TeamRegistryDetailPage** — New child route with score cards, manager info, and per-skill breakdown table.

6. **Routes** — Added `/skill-registry/:submissionId` and `/team-registry/:submissionId` in App.tsx.

7. **Breadcrumbs** — PageHeader updated for detail routes.
