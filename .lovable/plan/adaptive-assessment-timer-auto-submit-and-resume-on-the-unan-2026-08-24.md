# Adaptive Assessment: timer, auto-submit, and resume on the unanswered question

## What is wrong today

1. The adaptive runner has no timer at all. Only the fixed runner shows a countdown, and its `Timer` component is defined privately inside `FixedRunner.tsx`, so nothing else can use it.
2. Because there is no timer, there is no time-up message and no auto-submit for adaptive assessments.
3. On resume, the adaptive runner asks a *new* question even when the previous one was never answered. Confirmed cause: the engine marks a question as "delivered" the moment it is shown — it pushes the question id into `excludedQuestionIds` and increments `deliveredCount` inside `getNextQuestion`, before any answer exists. When the employee reopens the attempt, that question is already excluded, so the engine serves the next one and the unanswered question is silently lost.

## The fix

### A. Timer for adaptive only

Add `src/components/assessment/AssessmentTimer.tsx`: a small countdown chip that shows **remaining** time and **elapsed** time, in the same pill style already used in the fixed runner. It takes the initial remaining seconds, fires `onTick` each second and `onTimeUp` at zero.

`FixedRunner.tsx` keeps its own existing private `Timer` untouched — no change to fixed assessment behaviour.

Wire it into `AdaptiveRunner.tsx`'s top bar:

- Total duration = `assessment.duration_minutes * 60`; if missing or not positive, the timer is simply not rendered and the assessment behaves exactly as it does today.
- Initial remaining = the attempt's saved `remaining_seconds`, falling back to the total.
- Elapsed = total minus remaining, counted up as remaining counts down.
- Every tick updates a ref; when the runner unmounts, the tab is hidden, or the page unloads, the current remaining value is written to the attempt with the existing `pauseAttempt` store action — the same persistence the fixed runner already uses.

### B. Time up

At 00:00 the runner:

- shows a clear banner: "Time is up. Your assessment will be submitted automatically."
- disables option selection and the Next/Submit-answer button,
- calls the existing `finalize()` submit path (adaptive engine finalize + review creation), guarded by a `timeUpHandledRef` plus the existing `finalizing` flag so it can only ever run once.

If the attempt already has zero remaining time when it is reopened, the timer does not immediately auto-submit again; the runner opens on the review screen with the time-up banner so the employee can still submit.

### C. Resume on the same unanswered question

In `src/stores/adaptiveEngineStore.ts`, add a `pendingQuestion` marker to the persisted `adaptive_state`:

- `getNextQuestion` records `{ question_id, skill_id, level }` as `pendingQuestion` when it hands a question out.
- On entry, `getNextQuestion` first checks `pendingQuestion`; if it is set and the question has no answer in that skill's `history`, it reloads and returns that exact question instead of picking a new one — no new `assessment_questions` row, no second increment of `deliveredCount`.
- `recordAnswer` clears `pendingQuestion` once the answer is written.

Legacy attempts without the field are unaffected: no `pendingQuestion` means the current behaviour.

`AdaptiveRunner.tsx` then naturally reopens on the correct question, since it just calls `loadNext()` after rehydrating. The existing rehydration of the answered list and the progress ring stays as is.

## Files changed

- `src/components/assessment/AssessmentTimer.tsx` (new)
- `src/components/assessment/AdaptiveRunner.tsx`
- `src/stores/adaptiveEngineStore.ts`

Not touched: `FixedRunner.tsx`, scoring/evaluation, registry, question bank, reviews, dashboard.

## Manual test

1. Start an adaptive assessment: the header shows remaining and elapsed time, counting correctly.
2. Answer a question, then close the tab. Reopen: the timer resumes near where it stopped and the **next unanswered** question is shown.
3. Open a question, do **not** answer, close the tab. Reopen: the **same** question appears again, not a new one.
4. Let the timer reach 00:00: the banner appears, inputs lock, and the assessment submits itself exactly once.
5. Confirm a fixed assessment behaves exactly as before.
