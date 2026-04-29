## Problem

When an employee pauses a fixed assessment and later clicks **Resume**, the runner restores their saved answers and the remaining timer correctly — but it always reopens on **Question 1** instead of the question they were on when they paused. They have to click through to find where they left off.

## Root cause

`src/components/assessment/FixedRunner.tsx` initialises the current-question index unconditionally:

```ts
const [currentIdx, setCurrentIdx] = useState(0);
```

The `initialAttempt` (with all answers + `remaining_seconds` + `paused_at`) is loaded from the store and used to hydrate `answers`, `timeSpent`, `timerSeconds` and `isPaused` — but it is never used to pick the starting question index. So every resume starts at index 0.

The DB doesn't currently store "last viewed question". The cleanest, schema-free fix is to derive the resume index from the answers we already persist: jump to the **first unanswered question**. This is the standard exam-resume behaviour and matches user intent (continue where work is pending).

## Plan

### 1. Compute the resume index from saved answers

In `src/components/assessment/FixedRunner.tsx`, replace `useState(0)` for `currentIdx` with a derived initial index:

- If there is no prior attempt or no saved answers → start at index 0.
- Otherwise, find the index of the **first question without a saved answer** and start there.
- If every question already has an answer (user paused on the very last one after answering everything) → start at the last question so they can review and submit.

This is a pure-client change driven by data the store already loads.

### 2. Reset the per-question timer on resume

`questionStartTime` is initialised to `Date.now()` on mount — already correct for resume. No change needed; the time-spent counter for the resumed question simply continues from where it was.

### 3. Out of scope

- **AdaptiveRunner** — adaptive flow shows one question at a time driven by the engine; there is no "current index" to restore. No change.
- **Persisting an explicit `last_question_index`** in `assessment_attempts`. Not needed; "first unanswered" is sufficient and matches what users expect. Avoiding a schema change keeps this fix small and safe.
- The pause/resume API (`pauseAttempt` / `resumeAttempt` in `attemptStore`) — already works correctly for timer and paused state.

## Files to change

- `src/components/assessment/FixedRunner.tsx` — derive initial `currentIdx` from `initialAttempt.answers` instead of hardcoding `0`.

No DB / store / edge function changes required.
