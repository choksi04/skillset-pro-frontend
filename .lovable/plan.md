

# Plan: Replace Hardcoded Competency Levels with Dynamic Settings

## Problem

Competency levels are hardcoded in `questionStore.ts` as a static type/array/map (`'beginner' | 'intermediate' | ...`). The `question_settings` table already stores the actual configurable levels (name, label, etc.), but forms, filters, and display components import the hardcoded constants instead.

## Approach

Make all competency level dropdowns, filters, and labels derive from `question_settings` data fetched from the database. Remove the hardcoded `competencyLevels` array and `competencyLabels` map as the source of truth.

## Changes

### 1. `src/stores/questionStore.ts`
- Keep `CompetencyLevel` as a broad `string` type (since settings are dynamic)
- Replace the hardcoded `competencyLevels` array and `competencyLabels` map with **derived getters** from `settings`:
  - `getCompetencyLevels()` → returns `settings.map(s => s.name)` (sorted by `level`)
  - `getCompetencyLabels()` → returns `Record<string, string>` from `settings` (`name → label`)
- Keep the old exports as deprecated fallbacks or remove them entirely

### 2. `src/components/questions/QuestionFormSheet.tsx`
- Import `settings` and `fetchSettings` from `useQuestionStore`
- Call `fetchSettings()` on mount
- Build level options from `settings` instead of `competencyLevels`/`competencyLabels`

### 3. `src/pages/QuestionBankPage.tsx`
- Use `settings` for:
  - AI generation level dropdown
  - Filter level dropdown
  - Coverage gap level iteration
  - Badge labels (question detail, table rows, AI preview)
- Call `fetchSettings()` alongside `fetchQuestions()`

### 4. `src/pages/AssessmentExecPage.tsx`
- Replace `competencyLabels[currentAQ.target_level]` with settings-derived label lookup

### 5. `src/components/assessment/EvalResults.tsx`
- Replace `competencyLabels` usage with settings-derived lookup

### 6. `src/stores/assessmentStore.ts`
- Replace hardcoded `levelToCompetency` map and `getTargetCompetencyLevels` function to use settings-based level names
- Update `competencyToLevel` to be derived from settings

## Technical Detail

A helper will be added to `questionStore.ts`:

```typescript
// Derived from settings (fetched from question_settings table)
export function getCompetencyLevels(settings: QuestionSetting[]): string[] {
  return settings
    .filter(s => s.status === 'active')
    .sort((a, b) => a.level - b.level)
    .map(s => s.name);
}

export function getCompetencyLabel(settings: QuestionSetting[], name: string): string {
  return settings.find(s => s.name === name)?.label || name;
}

export function getCompetencyLabelsMap(settings: QuestionSetting[]): Record<string, string> {
  return Object.fromEntries(settings.map(s => [s.name, s.label]));
}
```

All consuming components will call `fetchSettings()` on mount (idempotent — already guarded by `settingsLoaded` flag) and use these helpers.

## Files to Edit

| File | Change |
|------|--------|
| `src/stores/questionStore.ts` | Add helper functions, deprecate hardcoded arrays |
| `src/stores/assessmentStore.ts` | Use settings-derived level mappings |
| `src/components/questions/QuestionFormSheet.tsx` | Use settings for level dropdown |
| `src/pages/QuestionBankPage.tsx` | Use settings for filters, dropdowns, badges, coverage |
| `src/pages/AssessmentExecPage.tsx` | Use settings for level badge |
| `src/components/assessment/EvalResults.tsx` | Use settings for level badge |

