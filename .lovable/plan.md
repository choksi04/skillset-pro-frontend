

# Fix MCQ Evaluation Scoring & Per-Question Display

## Problems Identified

1. **MCQ wrong answer scores Knowledge=10 and Confidence=99%**: In `evaluate-assessment/index.ts` line 99, a wrong MCQ answer gets `Knowledge: 10` instead of `0`, and confidence is hardcoded to `0.99` regardless of correctness.

2. **Score 0 mapping to Level 5**: The `fetchAndScoreToLevel` function in `attemptStore.ts` uses `scoreToLevelDynamic` which checks `score >= score_range_min && score <= score_range_max`. If Level 5 has `score_range_min=0`, a score of 0 could match Level 5. The function iterates from highest level down and returns the first match.

3. **Questions showing as raw JSON**: In `EvalResults.tsx` line 185, `question?.question_text` is displayed directly. For MCQ/coding/scenario questions, the text is JSON-encoded, so it renders as `{"questionText":"...","options":[...]}`.

## Changes

### 1. Fix MCQ scoring in Edge Function (`evaluate-assessment/index.ts`)

- Wrong answer: all dimension scores = 0, confidence = 0 (not 0.99)
- Correct answer: all dimension scores = 100, confidence = 1.0
- Remove the `Knowledge` dimension for MCQ entirely — MCQs are binary (correct/incorrect), no need for multi-dimension breakdown
- Simplify to a single `Correctness` dimension only

```
Wrong:  score=0, dimensions=[{Correctness: 0}], confidence=0
Correct: score=100, dimensions=[{Correctness: 100}], confidence=1.0
```

### 2. Fix Level calculation (`attemptStore.ts`)

- In `fetchAndScoreToLevel`, ensure score=0 always returns level 1
- Add an early return: `if (score === 0) return 1;` before calling `scoreToLevelDynamic`

### 3. Fix Per-Question rendering (`EvalResults.tsx`)

Add a helper function `getDisplayQuestionText(questionText: string, questionType: string)` that:
- For MCQ: parses JSON, extracts `questionText` field, and renders question + lettered options
- For coding: parses JSON, extracts `problemStatement`
- For scenario: parses JSON, extracts `question_text` or `questionText`
- Fallback: returns raw text if not JSON

Apply this helper on line 185 where `question?.question_text` is shown, and in the expanded section to show the full question with options.

### 4. Simplify MCQ evaluation display in EvalResults

- For MCQ questions with score=0: hide the "Dimension Scores" grid (it's meaningless for a binary wrong answer)
- For MCQ questions: hide "Confidence" display (it's always 100% or 0%)
- Keep dimension display for scenario/coding questions (AI-evaluated)

## Files Modified

- `supabase/functions/evaluate-assessment/index.ts` — Fix MCQ scoring logic
- `src/stores/attemptStore.ts` — Add score=0 guard in level calculation  
- `src/components/assessment/EvalResults.tsx` — Parse JSON question text for display, simplify MCQ result cards

