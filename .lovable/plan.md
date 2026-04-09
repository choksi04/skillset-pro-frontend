

# Fix: Cap Calculated Level at Assessment Target Level

## Problem
The scoring system uses a pure score-to-level mapping (e.g., score 100 → Level 5) without considering what level the questions were designed for. An employee who self-rates at Level 3 gets Level 3 questions. Scoring 100% on Level 3 questions proves Level 3 competency, not Level 5. Conversely, scoring 0% maps to Level 1, which is also misleading — they attempted Level 3 content.

**Current logic** (`attemptStore.ts`, line 287):
```
calculated_level = await fetchAndScoreToLevel(avg_score)  // score 100 → L5
```

**Correct logic**: The calculated level should be capped at the target level the questions were designed for. A perfect score on Level 3 questions = Level 3 confirmed. A poor score means below Level 3.

## Solution

### Rule
- Determine the **target level** for each skill from the `assessment_questions` table (the `target_level` field).
- After computing `scoreToLevel(avg_score)`, **cap** it: `Math.min(calculated_level, target_level_number)`.
- This means: scoring 100% on L3 questions → L3 (not L5). Scoring 40% on L3 questions → L2 (below target).

### Changes in `src/stores/attemptStore.ts`

1. **Import** `getCompetencyToLevelMap` from `competencyLevelStore`.

2. **In `submitAttempt`** (around lines 272-289), when building skill scores:
   - Extract the `target_level` string for each skill from `assessmentQuestions`.
   - Convert target level name to number using `getCompetencyToLevelMap`.
   - After `fetchAndScoreToLevel(avg_score)`, cap it: `Math.min(rawLevel, targetLevelNumber)`.

3. **Same fix in `retryEvaluation`** (since it calls `submitAttempt`, it inherits the fix automatically).

### Changes in `src/stores/attemptStore.ts` — `SkillScore` interface

- Add `target_level` field to `SkillScore` interface so the UI can display "Target: L3, Achieved: L3".

### Changes in `src/components/assessment/EvalResults.tsx`

- Display the target level alongside the calculated level in the skill scores section, so both employee and manager can see: "Target: L3 | Achieved: L3 | Score: 100%".

## Files Modified
- `src/stores/attemptStore.ts` — cap `calculated_level` at the target level from assessment questions
- `src/components/assessment/EvalResults.tsx` — show target level vs achieved level in results

