# Adaptive Assessment: show elapsed and remaining time

## What's wrong today

Fixed Assessments show a countdown pill (`Clock` + `MM:SS`) in the runner top bar, driven by the assessment's `duration_minutes` and the attempt's saved `remaining_seconds`. The Adaptive runner's top bar has only the progress ring, the title and an "Adaptive Engine" badge — no timer at all.

Confirmed by reading the code:

- Adaptive assessments do have a duration: assessments carry `duration_minutes`, and the Adaptive runner already receives the whole `assessment` object.
- The attempt row carries `started_at` (and `paused_at` / `remaining_seconds`, used by Fixed's pause feature) and is reachable from the Adaptive runner through the attempt store, which it already calls.
- So this is purely a **missing timer UI + missing time calculation** in the Adaptive runner. Nothing is missing on the backend.

The Adaptive runner also has no pause button and no time-based auto-submit — reaching zero currently does nothing, because there is no timer. That existing behaviour stays as-is.

## What will be built

A read-only timer in the Adaptive runner's top bar showing:

- **Elapsed** — counts up in real time
- **Remaining** — counts down in real time, turning red under 5 minutes, and showing an expired state at `00:00`

Both derive from wall-clock time against the attempt's `started_at`, so they stay correct when moving between questions, on refresh, and on resume of an unfinished attempt.

At `00:00` the remaining pill shows "Time's up" and the review/submit path stays available — no new auto-submit is introduced, since Adaptive has none today.

## Technical notes

- Extract the existing `Timer` pill from `FixedRunner.tsx` into a small shared presentational component (`src/components/assessment/AssessmentTimer.tsx`) and have `FixedRunner` import it with identical props and behaviour — no change to Fixed countdown, pause/resume, or auto-submit.
- The shared component gains an optional `label` and a `mode` for a plain (non-counting-down-from-prop) display so the Adaptive side can render an "Elapsed" pill using the same visual style.
- In `AdaptiveRunner.tsx`:
  - During init (where the attempt row is already fetched for resume hydration) capture `started_at` for the current attempt.
  - `elapsed = now - started_at`; `remaining = duration_minutes * 60 - elapsed`, clamped at 0; a single 1s interval drives both.
  - Render the two pills next to the existing "Adaptive Engine" badge in the top bar, and keep them visible on the review screen header.
- No changes to question selection, scoring, finalisation, review, or any store logic.

## Files to change

- `src/components/assessment/AssessmentTimer.tsx` (new — extracted pill)
- `src/components/assessment/FixedRunner.tsx` (import the extracted pill; behaviour unchanged)
- `src/components/assessment/AdaptiveRunner.tsx` (timer state + top-bar display)
