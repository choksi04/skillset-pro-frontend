

# Plan: Map Competency Levels to Related Tables via Database Reference

## Summary

Currently, competency level values are stored as raw text strings (`"beginner"`, `"intermediate"`, etc.) in multiple tables and hardcoded score-to-level thresholds exist in code. This plan creates a proper `competency_levels` table (renamed from `question_settings`) and ensures all related tables and code reference it consistently.

---

## Database Changes

### Migration 1: Rename `question_settings` to `competency_levels`

```sql
ALTER TABLE question_settings RENAME TO competency_levels;
```

Update the existing RLS policy name to match.

### No Foreign Key Additions

The existing schema uses `text` IDs throughout (no uuid references). Adding formal foreign keys to `questions.competency_level` or `assessment_questions.target_level` would require data migration and constraint management. Instead, we will enforce consistency at the application layer — all code that reads/writes competency level names will validate against the `competency_levels` table.

---

## Tables Affected (Competency Level References)

| Table | Column | Current Storage | Change |
|---|---|---|---|
| `questions` | `competency_level` | text (e.g. `"beginner"`) | Validate against `competency_levels.name` |
| `assessment_questions` | `target_level` | text (e.g. `"beginner"`) | Validate against `competency_levels.name` |
| `attempt_skill_scores` | `calculated_level` | integer (1-5) | Map via `competency_levels.level` |
| `official_skill_entries` | `final_level`, `self_rating`, `ai_level` | integer (1-5) | Map via `competency_levels.level` |
| `review_skill_entries` | `self_rating`, `ai_calculated_level`, `manager_adjusted_level` | integer | Map via `competency_levels.level` |
| `skill_self_ratings` | `rating` | integer (1-5) | Map via `competency_levels.level` |

---

## Code Changes

### 1. New `competencyLevelStore.ts`

- Dedicated store replacing `fetchSettings`/`settings` from `questionStore`
- Fetches from `competency_levels` table
- Exports helper functions: `getLevelByName(name)`, `getNameByLevel(level)`, `getLevelLabel(level)`, `getScoreRangeForLevel(level)`
- Replaces the hardcoded `scoreToLevel()` function in `attemptStore.ts` (lines 33-38) with a dynamic lookup using `score_range_min`/`score_range_max` from the table

### 2. Update `questionStore.ts`

- Remove `QuestionSetting` type, `fetchSettings`, `settings`, `settingsLoaded`, and all deprecated exports (`competencyLevels`, `competencyLabels`)
- Remove helper functions (`getCompetencyLevels`, `getCompetencyLabel`, `getCompetencyLabelsMap`) — moved to new store
- Keep question-only concerns

### 3. Update `assessmentStore.ts`

- Import from `competencyLevelStore` instead of `questionStore` for level mapping
- Remove all hardcoded fallback maps (`{ 1: 'beginner', 2: 'beginner', ... }`)
- `getTargetCompetencyLevels` and `getLevelToCompetencyMap` use new store

### 4. Update `attemptStore.ts`

- Replace hardcoded `scoreToLevel()` with dynamic function from `competencyLevelStore` that uses `score_range_min`/`score_range_max`

### 5. Update `registryStore.ts`

- Replace hardcoded `ratingLabels` and `ratingDescriptions` with dynamic lookups from `competencyLevelStore`

### 6. Update all UI references

Files that display competency level labels/badges (~10 files):
- `QuestionFormSheet.tsx`, `QuestionBankPage.tsx`, `QuestionSettingsPage.tsx`, `EvalResults.tsx`, `ReviewsPage.tsx`, `ManagerReviewPanel.tsx`, `SkillRegistryDetailPage.tsx`, `HRDashboardPage.tsx`, `AllRegistriesPage.tsx`, `RatingSlider.tsx`
- All will read from the new store instead of hardcoded maps

### 7. Update Edge Functions

- `evaluate-assessment/index.ts` — fetch `competency_levels` instead of `question_settings`
- `generate-questions/index.ts` — update table reference if it reads settings

---

## Validation

- When saving a question, validate `competency_level` value exists in `competency_levels` table
- When generating assessments, validate `target_level` against active competency levels
- Show meaningful error if an invalid/inactive level is referenced

---

## Technical Detail

The `competency_levels` table columns remain unchanged:
`id`, `tenant_id`, `level` (integer 1-5), `name` (text key), `label` (display), `description`, `score_range_min`, `score_range_max`, `min_questions`, `status`

The `level` integer field is the canonical numeric reference. The `name` text field is the canonical string reference. All integer-based columns (ratings, calculated_level, final_level) map to `level`. All text-based columns (competency_level, target_level) map to `name`.

