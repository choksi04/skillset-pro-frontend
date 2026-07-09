# Plan: Adaptive Assessment UI Refresh + Review Before Submit

Bring `AdaptiveRunner.tsx` up to the same modern look-and-feel we shipped for `FixedRunner.tsx`, minus the side navigator (adaptive is sequential — users can't skip/jump). Add a "Review your answers" screen shown after the last question, before final submission.

## Scope

Only `src/components/assessment/AdaptiveRunner.tsx`. No changes to adaptive engine logic, scoring, or streak rules.

## 1. Visual refresh (parity with FixedRunner)

Reuse the same tokens/components already used in `FixedRunner`:
- Modernized header: assessment title, chip-style timer, progress ring showing answered / total-expected (best-effort — adaptive length is dynamic, so show "Question N" plus current skill/level chips instead of a fixed total when unknown).
- Card-based question surface, consistent typography, spacing, and button styles.
- Reactive buttons with `Loader2` spinner + disabled state during submit/next transitions (matches the pattern added in the last FixedRunner pass).
- Sticky footer with primary action (`Submit answer` → `Next` → finally `Review answers`).

Explicitly **omit**:
- Question navigator sidebar.
- Skip button / filter chips.
Adaptive flow stays strictly linear.

## 2. Review-before-submit step

After the adaptive engine signals the attempt is complete (no more questions to serve), instead of auto-finalizing:

1. Show a **Review** screen listing every question the user answered in order:
   - Skill + level chip
   - Question prompt (collapsed, expandable)
   - The user's submitted answer (MCQ: selected option(s); Coding/Scenario: their text, read-only)
   - No correctness indicators (adaptive scoring/AI eval happens on final submit — keep it neutral)
2. Actions on the review screen:
   - `Submit assessment` (primary) — triggers the existing finalize path.
   - `Back` — returns to the last question view (read-only; answers cannot be changed since adaptive already consumed them). If changing answers is out of scope for adaptive, Back only closes the review overlay.
3. Loading state on `Submit assessment` with spinner; disable while in-flight.

Answers are already persisted per question by the adaptive engine, so the review screen is a pure read from the in-memory attempt state — no new store methods required.

## 3. Technical notes

- Keep component self-contained; no changes to `adaptiveEngineStore.ts`.
- Extract small subcomponents inside the file (`AdaptiveHeader`, `AdaptiveReview`) to keep it readable.
- Timer, exit confirmation, and auto-pause-on-unload behavior copied from FixedRunner's latest version.
- Typecheck after edit.

## Out of scope

- Editing answers from the review screen (adaptive engine treats each answer as final input to the next question selection).
- Any change to how adaptive picks questions, streaks, or level progression.
- Changes to `AssessmentDetailPage` shell.
