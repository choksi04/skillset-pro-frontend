## Problem

In the assessment runner (`FixedRunner`) and the assessment detail page's runner shell, several buttons trigger async work (save answer → DB round-trip, pause DB write, submit, exit-with-refetch), but give no immediate visual feedback. The user clicks Exit / Pause / Next / Previous / Skip / question-navigator tile and it looks frozen, then "suddenly" something happens. Also nothing prevents double-clicks during the async gap.

## Fix (UI-only, no business logic changes)

Add per-action loading state + immediate disable + spinner on every interactive button in the runner. Nothing changes about what the buttons do — only how reactive they feel.

### 1. `src/components/assessment/FixedRunner.tsx` — top bar

- **Exit**: wrap `onCancel` in a local `isExiting` state. On click: set `isExiting=true`, disable the button, swap the icon for `Loader2` (spinning), await `onCancel()`, then reset. Also disable Exit while `isSubmitting`.
- **Pause / Resume**: add `isPausing` / `isResuming` state. Show spinner in-place while the DB call runs; disable both buttons during the transition.
- **Review & submit**: already has `isSubmitting`; also add a `isOpeningReview` state so the button shows a spinner while `saveCurrentAnswer()` finishes before opening the review panel.
- **Timer area**: unchanged.

### 2. `FixedRunner.tsx` — question area footer

- **Previous / Next / Skip**: add a shared `isNavigating` state. `goTo(i)` becomes: set `isNavigating=true` → await save → change index → set `false`. All three buttons show spinner + disabled while navigating. Prevents the "click did nothing" gap caused by the awaited `saveAnswer`.
- **Reset**: instant (local state) — no change needed, but confirm no async.
- **Flag for review**: instant local state — no change.

### 3. `FixedRunner.tsx` — question navigator sidebar tiles

- The numbered tiles call `goTo(i)` which awaits DB write. Wire them into the same `isNavigating` flag: disable pointer events + add `opacity-60` while navigating so the user sees the click was received.

### 4. `FixedRunner.tsx` — Review panel

- **Back to questions**: instant, no change.
- **Submit assessment / Submit anyway**: already have `isSubmitting`; ensure the spinner shows on the exact button clicked and both dialog buttons disable together.
- **Jump to Q#**: shares `isNavigating` (also awaits save via `goTo`-style flow) — add spinner/disable.

### 5. `src/pages/AssessmentDetailPage.tsx` — runner shell

- **Back to Assessment** (top of runnerActive view, calls `exitRunner` which awaits `fetchAssessments` + `fetchAttempts`): add `isExitingRunner` state, disable + spinner while running.
- No other buttons on this page need changes (Start / Regenerate / Re-attempt already have `startingRunner` / `regenerating` flags).

### Common pattern applied

```
const [busy, setBusy] = useState(false);
const handler = async () => {
  if (busy) return;
  setBusy(true);
  try { await doWork(); } finally { setBusy(false); }
};
<Button disabled={busy || otherBusyFlags} onClick={handler}>
  {busy ? <Loader2 className="animate-spin" size={14} /> : <Icon size={14} />}
  Label
</Button>
```

### Out of scope

- No changes to save/submit/pause/resume logic in `attemptStore`.
- No changes to timer, adaptive engine, or evaluation flow.
- No visual redesign — only spinner/disabled affordances on existing buttons.

## Files changed

- `src/components/assessment/FixedRunner.tsx`
- `src/pages/AssessmentDetailPage.tsx` (only the `runnerActive` back button)
