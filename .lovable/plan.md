# Adaptive Assessment: consistent auto-submit on timer expiry

## Verification result: the issue is still reproducible

Reviewed: `src/components/assessment/AdaptiveRunner.tsx`, `src/components/assessment/AssessmentTimer.tsx`, `src/components/assessment/FixedRunner.tsx`, `src/stores/attemptStore.ts`.

What the code does today (verified):

- Auto-submit fires from exactly one place: `handleTimeUp()` in `AdaptiveRunner`, called only by the `AssessmentTimer` countdown reaching zero while the component is mounted and not paused. It is guarded by `timeUpHandledRef` plus `finalizingRef`, so it can run only once. That path is role-independent and identical for everyone.
- **The gap:** when an attempt is reopened with `remaining_seconds <= 0` (line 114), `timeUp` is initialised to `true` and the effect at line 166 only opens the review screen. It shows the banner "Time is up. Your assessment will be submitted automatically." but **nothing calls `finalize()`** — the timer never counts down to zero because it is already at zero, so `onTimeUp` never fires. The user must click **Submit assessment** manually.
- Same outcome when the employee pauses (or closes the tab, which persists remaining time) and comes back after the nominal duration: the clock is frozen, not wall-clock based, so it can also land on 0 and stall in the same state.

That is exactly the QA report: users who sit on the page until 00:00 are auto-submitted; users who leave/pause and return at 00:00 are asked to submit manually.

Other checks: no dependency on user role, answer-save state or loading state; the in-progress selected answer is recorded before finalizing in `handleTimeUp`; the timeout banner renders for everyone who reaches the review screen with `timeUp`.

## The fix (smallest atomic change, `AdaptiveRunner.tsx` only)

1. Route the "already expired on open" case through the same single handler. Replace the effect at lines 165-168 so that, once loading finishes and the runner is initialised, an expired attempt calls `handleTimeUp()` instead of only setting `reviewOpen`. The existing `timeUpHandledRef` / `finalizingRef` guards keep it to exactly one submission.
2. Keep the pause rule explicit and consistent: while `isPaused` is true, do not auto-submit; the expiry auto-submit runs on the next resume/open. Pausing already stops the clock, so paused time is never counted.
3. No other change: no store change, no scoring change, no change to `FixedRunner` (its "start paused when expired" behaviour is its own and stays as is), no timer component change.

## Final auto-submit rules after the fix

- Adaptive: reaching 00:00 while active submits automatically, once, for every user.
- Adaptive: opening/resuming an attempt that already has 00:00 left submits automatically as soon as it loads and is not paused.
- Adaptive: a paused assessment never auto-submits while paused; it submits on resume if the clock is at zero.
- Assessments with no configured duration have no timer and stay fully manual, unchanged.

## Manual test steps for QA

1. Start an adaptive assessment, answer 1-2 questions, stay on the page until 00:00 — banner appears, submission happens by itself, once.
2. Start an attempt, answer a question, close the tab. Reopen after the remaining time has been exhausted (or with a short-duration template) — it should submit itself without any click.
3. Pause with time remaining, wait, resume — timer continues from the paused value, no submission occurred while paused.
4. Pause, close the tab, reopen — same unanswered question, no unexpected submission.
5. Reload the page right at 00:00 — only one submission is recorded (one attempt row moves to submitted, one review created).
6. Run a fixed assessment end to end — behaviour identical to today.

## Files changed

- `src/components/assessment/AdaptiveRunner.tsx` (one effect)
