# Fix: Fixed Assessments show Verified Level identical to Achieved Level

## What's happening

For Fixed (non-adaptive) assessments, both level columns are computed from the same underlying number, so they always match.

- Achieved Level for a fixed attempt falls back to the per-skill `calculated_level` stored on the attempt's skill scores.
- When the manager review is created, each skill's `verified_level` is seeded with exactly that same `calculated_level`. If the manager approves without adjusting, Verified Level equals Achieved Level.

Adaptive assessments are unaffected because their Achieved Level is derived from the adaptive answer history (highest level answered correctly per skill), which is a different source from the review-seeded value.

Verified: `src/lib/assessmentStatus.ts` (achieved fallback = `calculated_level`), `src/stores/reviewStore.ts` line 184 (`verified_level: ss.calculated_level`).

## The fix (smallest atomic change)

Give Fixed assessments their own evidence-based Achieved Level, mirroring the adaptive rule, instead of reusing the same number the review was seeded from.

For a fixed attempt, per skill:
- Look at the questions delivered for that skill (each carries a `target_level`) and the AI evaluation score for each question.
- A question counts as correct when its score meets the pass threshold already used elsewhere (>= 50).
- Achieved level for the skill = highest `target_level` among correct answers; skills with no correct answer contribute nothing.
- Overall Achieved Level = rounded average across skills, same as adaptive.
- If evaluations or question level data are unavailable, keep today's `calculated_level` + error-cap fallback so nothing regresses.

Verified Level logic is untouched: it keeps reading the completed manager review's `verified_level`, and still shows the existing "Pending manager review" placeholder when no completed review exists.

## Technical details

- `src/lib/assessmentStatus.ts`: extend `getAchievedLevelFromAttempt` to accept optional assessment questions (`{ question_id, skill_id, target_level }`) and use `attempt.ai_evaluations` to derive the level as described. Adaptive branch untouched and still takes priority.
- `src/pages/AssessmentsPage.tsx` and `src/pages/TeamAssessmentsPage.tsx`: pass the assessment's questions (already loaded in the assessment store) into the achieved-level call. No other change to columns, filters, or layout.
- No database, review workflow, scoring persistence, or adaptive engine changes.

## Manual test

1. My Assessments: open a completed Fixed assessment where the manager approved without adjusting. Achieved Level now reflects the highest level answered correctly; Verified Level shows the manager's value and they may legitimately differ.
2. Team Assessments: the same assessment shows the identical two values as My Assessments.
3. Fixed assessment with review still pending: Verified Level shows the pending placeholder, not the achieved value.
4. Adaptive assessment: both columns unchanged from current behaviour.
5. Fixed assessment with zero correct answers: Achieved Level shows the existing empty/dash state.
