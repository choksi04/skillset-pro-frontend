# Adaptive Assessment: Pause / Resume control

## Current state (verified)

- `AdaptiveRunner.tsx` already renders `AssessmentTimer` in the top bar, with `isPaused={timeUp || finalizing}`. There is no user-facing Pause button.
- `AssessmentTimer.tsx` already stops its interval whenever `isPaused` is true, and elapsed is derived as `totalSeconds - remaining`, so freezing `remaining` also freezes elapsed. No new timer logic is needed.
- `attemptStore` already exposes `pauseAttempt(attemptId, remainingSeconds)` (writes `paused_at` + `remaining_seconds`) and `resumeAttempt(attemptId)` (clears `paused_at`). `FixedRunner` uses exactly this pair — the same pattern will be reused.
- The adaptive runner already persists `remaining_seconds` on unmount / tab hide via `pauseAttempt`, so leaving mid-assessment does not consume time.
- The current question is already preserved server-side by the engine's `pendingQuestion` marker in `adaptive_state`, so a paused/closed attempt reopens on the same unanswered question. No store change is needed.

## The change (UI-level only, `AdaptiveRunner.tsx`)

1. Add local state `isPaused`, `isPausing`, `isResuming`.
2. In the top bar, next to the timer, add a Pause / Resume ghost button using the exact same markup and icons (`Pause`, `Play`, `Loader2`) as `FixedRunner`'s top bar.
   - Pause: calls `pauseAttempt(attempt.id, remainingRef.current)`, sets `isPaused`, toasts "Assessment paused. Your progress has been saved."
   - Resume: calls `resumeAttempt(attempt.id)`, clears `isPaused`.
   - Both are no-ops while already in flight, so repeated clicks cannot create duplicate state or timers.
3. Pass `isPaused={timeUp || finalizing || isPaused}` to `AssessmentTimer`. The countdown interval stops; remaining and elapsed both freeze; the `onTick` ref keeps its last value so nothing is lost.
4. Header subtitle switches to "Assessment paused" wording while paused.
5. When paused, replace the question card body with the same paused panel used by the fixed runner (muted circle icon, "Assessment paused", "Your progress is saved…", Resume button). The question card, options and the Next button are not rendered, so answering and navigation are disabled. The selected option lives in React state and is untouched, so it is still selected after resume.
6. Nothing else changes: no submit on pause, no `getNextQuestion` call on pause or resume, no scoring change, no store change, `FixedRunner` untouched.

## Pause state: local only

Pause is local UI state; the backend `paused_at` + `remaining_seconds` are written for persistence of the clock. On reopening, the runner does **not** start in a paused screen (the adaptive runner already writes `paused_at` on every unmount, so it is not a reliable "user pressed pause" signal). Instead the attempt reopens on the same unanswered question with the preserved remaining time — the minimum behaviour the requirement allows.

## Auto-submit while paused

No business rule requires wall-clock expiry, so paused time is not counted and the assessment will never auto-submit while paused.

## Files changed

- `src/components/assessment/AdaptiveRunner.tsx` (only)

## Manual test

1. Start an adaptive assessment; the Pause button shows next to the timer.
2. Click Pause: timer freezes (remaining and elapsed both stop), question hides, paused panel with Resume appears, nothing is submitted.
3. Click Resume: same question returns, previously selected option still selected, timer continues from the paused value.
4. Click Pause/Resume rapidly several times: only one countdown runs, times stay consistent.
5. Pause, close the tab, reopen: same unanswered question, remaining time unchanged by the paused interval.
6. Run a fixed assessment: behaviour identical to before.
