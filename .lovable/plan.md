## Plan: Enhance My Skill Registry Listing with Full Score Details & Past Registry Drill-Down

### Problem

The current page shows past registries as a minimal table (cycle, skills rated, avg self-score, status) with no assessment/final scores, no manager info, and no drill-down detail view. The active cycle card also lacks score summaries.

### Changes

#### 1. `src/pages/SkillRegistryPage.tsx` — Rewrite listing & detail views

**Registry Listing (always shown, active on top):**

Every registry card (active + past) shows:

- Cycle Name
- Self-Score (avg) — from `submission.ratings`
- Assessment Score (avg) — from `attempt_skill_scores` via `attemptStore`
- Final Score (avg) — from `official_skill_entries` via `reviewStore.officialEntries` (only when manager approved)
- Manager — avatar/initials with hover card showing name, email (from `manager_reviews.reviewer_id` → `users` table)
- Status badge

The **active cycle card** keeps its existing prominent design (cycle dates, domain, duration, CTA button) but also shows the score columns inline.

Past registries render as clean cards (not just a table) with the same columns.

**Detail View (click any past registry card):**

Opens a dedicated detail page showing:

- Header: Cycle name, Status
- Rating cards: Self-Score avg, Assessment Score avg, Final Score avg, 
- Manager Details and comments/notes
- Skills grouped by category, each skill row showing:
  - Skill name
  - Self Rating (L1-L5)
  - Assessment Score (calculated level from `attempt_skill_scores`)
  - Final Score (from `official_skill_entries`)
  - Gap indicator (final - self)

**Edge case: No active cycle** — page still renders past registries list. No "empty page" when cycle is inactive.

#### 2. Data Fetching

Currently `pastSubmissions` only filters by employee + cycle name. Need to:

- Cross-reference `assessments` → `attempts` → `attempt_skill_scores` for assessment scores
- Cross-reference `reviewStore.officialEntries` for final scores
- Cross-reference `manager_reviews` for reviewer info
- Fetch reviewer user names/emails from `users` table (similar pattern to `TeamRegistryPage`)

Build helper maps:

- `submissionAssessmentScores: Record<submissionId, avgAssessmentScore>`
- `submissionFinalScores: Record<submissionId, avgFinalScore>`
- `submissionReviewer: Record<submissionId, { name, email, avatar_url }>`
- `submissionStatus: Record<submissionId, derivedStatus>`

#### 3. No new database changes needed

All data already exists in `attempt_skill_scores`, `official_skill_entries`, `manager_reviews`, and `users` tables.

---

### File Summary


| File                              | Change                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/SkillRegistryPage.tsx` | Rewrite `PastRegistriesTable` → detailed page with all score columns + manager. Add detail view for past registries. Update "no active cycle" to still show past registries. Fetch reviewer data from users table. |
