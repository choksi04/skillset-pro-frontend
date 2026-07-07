## 1. Assessment questions using wrong level (L3 instead of user's L4)

**Root cause**
Self-ratings are now persisted in `skill_registry_items.self_score` (via `useSkillRegistryStore`), but the assessment generation path still reads the legacy `skill_self_ratings` table, which is now empty (verified: 0 rows). When no rating is found, the code silently falls back to level 3.

Three call sites all read the empty table:
- `src/stores/adaptiveEngineStore.ts` (lines ~209 and ~251) — picks skills and computes `start = clampLevel(selfRatingMap[skill_id] ?? 3)`, so every skill defaults to L3.
- `src/stores/assignmentStore.ts` (line ~231) — picks the top-N skills for adaptive templates from `skill_self_ratings`.
- `src/stores/registryStore.ts` `fetchRegistry` (line ~82) — loads legacy ratings for the in-memory `submissions.ratings` map that FixedRunner/AdaptiveRunner use to build `self_ratings` when auto-creating manager reviews.

**Fix**
Introduce a single helper `getLatestSelfRatings(employeeId, domainId?)` that reads from `skill_registry_items` joined to the latest non-deleted `skill_registries` for that employee (preferring the current cycle / most recent approved-or-submitted registry), returning `{ skill_id, rating }[]`. Route all three call sites through it. Keep `skill_self_ratings` untouched (legacy) — do not write new rows there.

Also tighten the safety net: when a self-rating is still missing for a skill after the lookup, log a warning and use the skill's assessed level from the previous registry if available; only fall back to L3 as a last resort.

## 2. Assessment "auto-submits" when the user navigates back

**Likely cause**
There is no explicit unload/visibility auto-submit. What actually happens is the timer resumes from stale state on return: `initialRemaining = initialAttempt?.remaining_seconds ?? totalSeconds`. If the user paused/exited without the pause path being taken (browser back button skips `handlePause`), `remaining_seconds` is never refreshed, and on re-entry the Timer effect may hit `r <= 1` on the first tick and call `handleTimeUp → doSubmit`. Also, `updateAssessmentStatus(id, "in_progress")` runs on start but there is no "resume" gating on return — the runner mounts, the timer starts, and if the countdown reached 0 in a prior visit it submits immediately.

**Fix**
- On unmount of `FixedRunner` (return from `useEffect` cleanup), if the attempt is still `in_progress`, auto-pause: persist `remaining_seconds` and `paused_at` via `pauseAttempt`, and save the current answer. No submission.
- Add a `beforeunload` / `visibilitychange (hidden)` handler that does the same pause+save, best-effort.
- Guard `handleTimeUp` so it only submits when the runner is visibly active (not paused, not just mounted with `timerSeconds <= 0` from stale data). If `initialRemaining <= 0` on mount, treat the attempt as paused and require an explicit Resume click before the timer can tick.
- On re-entry to `AssessmentDetailPage` while an `in_progress` attempt exists, show a "Resume assessment" CTA instead of auto-mounting the runner.

## 3. Allow reviewing answers before submit

Add a **Review** step to `FixedRunner` between the last question and the final submit:
- New `reviewOpen` state. Clicking Submit (or reaching the last question) opens a full-panel review view instead of the current confirm dialog.
- The review view lists every question with: number, skill, level, question type, the user's answer (or "Not answered"), flagged-for-review badge, and a "Jump to question" button that closes review and navigates to that index.
- Sticky footer with "Back to questions" and "Submit assessment" (calls existing `doSubmit`). Keep the "unanswered questions" confirm dialog as a secondary step from the review view.
- The existing left navigator already lets users jump around during the attempt; the new review step is the final consolidated pass.

## 4. Modern assessment UI

Redesign `FixedRunner` layout only (no logic changes) to feel like a real exam surface:
- Full-viewport shell with a top header (assessment name, skill/level badges for the current question, timer pill, pause/exit/submit).
- Left rail: grouped question navigator with a small legend (Answered / Flagged / Unanswered / Current), progress ring showing `answered / total`, and quick filters (All, Flagged, Unanswered).
- Center: single-question card with generous spacing, clear typography, distinct treatment per question type (MCQ radio cards, coding editor block, scenario prose + textarea), and a keyboard shortcut hint row.
- Right rail (desktop only, collapsible): question meta, "Flag for review" toggle, "Clear answer", time spent on this question.
- Sticky bottom action bar: Previous / Next / Flag / Save & continue, with the primary Submit surfaced only on the last question or from the Review step.
- Use existing semantic tokens (`primary`, `success`, `warning`, `destructive`, `muted`) — no hardcoded colors. Dark mode preserved.

Before implementing the visual redesign I will capture the current runner via a Playwright screenshot and run it through the design directions flow so you can pick a direction; this plan step covers the structural + interaction changes, and the exact visual direction will be confirmed after that.

## Out of scope
- No schema changes.
- No changes to AI evaluation, scoring, manager review logic.
- No changes to adaptive engine promotion/demotion rules — only the initial `startLevel` source.
- Legacy `skill_self_ratings` table is left in place; not backfilled.

## Files to touch
- `src/stores/adaptiveEngineStore.ts` — self-rating source.
- `src/stores/assignmentStore.ts` — self-rating source for adaptive skill picking.
- `src/stores/registryStore.ts` — populate `submissions.ratings` from `skill_registry_items`.
- `src/lib/registryHistory.ts` or new `src/lib/selfRatings.ts` — shared helper.
- `src/components/assessment/FixedRunner.tsx` — pause-on-exit, resume gating, Review step, UI redesign.
- `src/pages/AssessmentDetailPage.tsx` — Resume CTA when returning to an `in_progress` attempt.
