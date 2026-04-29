## Goal

Improve the **Per-Question Details** expansion on the assessment result page so MCQs always display the **option text** along with the letter (A/B/C/D) — for the employee's selected answer, the correct answer in the answer box, and the correct answer reference in the AI feedback line.

## Current behavior

In `src/components/assessment/EvalResults.tsx` (MCQ expand block, lines ~119–141):

- **Selected answer** shows just the letter: `Selected: A`
- **Correct answer reference** shows letter + text correctly already, but only when answer was provided
- When the employee submitted nothing, the whole MCQ-aware block is skipped (because `answer?.answer_text` is falsy) and the fallback renders `No answer provided` — losing the chance to still show the correct option text
- The AI feedback string (from `evaluate-assessment` edge function) reads `Incorrect. The correct answer was A.` — letter only, no option text

## Changes

### 1. `src/components/assessment/EvalResults.tsx` — MCQ expand block

Rewrite the MCQ branch so it always renders when `isMCQ && mcqInfo` is true (regardless of whether `answer.answer_text` exists), and always shows the option text:

- **Selected line**:
  - If user selected a letter → `Selected: A) <option text>`
  - If empty → render italic `No answer provided` for the selected line only
- **Correct/Incorrect line** (always shown when `correctIndex != null`):
  - Correct → `Correct — A) <option text>`
  - Incorrect or empty → `Incorrect — Correct answer: A) <option text>`
- Add a small helper inside the component to map a letter (`A`/`B`/`C`/`D`) to its option text via `mcqInfo.options[letter.charCodeAt(0)-65]`, with bounds check.

### 2. `supabase/functions/evaluate-assessment/index.ts` — `evaluateMCQ` feedback text

Enhance feedback strings to include the option text when it can be parsed from `question_text` JSON:

- Parse `parsed.options` alongside `correctIndex`
- Correct → `Correct answer selected: A) <option text>.`
- Incorrect → `Incorrect. The correct answer was A) <option text>.`
- Same enhancement in the `dimensions[0].comment` string
- Fallback to current letter-only text if options can't be parsed

This only affects newly generated evaluations. Existing stored feedback strings will remain letter-only (acceptable; the EvalResults UI already shows the full correct answer with text in the answer box).

## Out of scope

- Non-MCQ question types (scenario/coding) — unchanged
- Re-evaluating historical attempts
