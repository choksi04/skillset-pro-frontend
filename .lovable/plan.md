# Fix: Submit disabled after reopening a completed adaptive assessment

## What the employee hit

They answered every question in an **adaptive** assessment, closed the page before submitting, reopened it, and the Submit button was greyed out.

## Root cause

The adaptive runner keeps the list of answered questions only in local component state.

- The adaptive engine state (which questions were asked, per-skill progress) *is* persisted in the attempt, and the answers *are* persisted in the answers table.
- On reopen, the runner re-initialises with an empty in-memory answered list. Because the engine state says all questions were already asked, it immediately jumps to the review screen with zero rows.
- The review screen's Submit button is disabled when the in-memory answered list is empty, so a fully answered attempt can never be submitted.

This also explains the earlier "No answer recorded" report on the same screen.

The fixed (non-adaptive) runner already rehydrates answers from the attempt, so it is not affected.

## The fix (smallest atomic change)

Rehydrate the adaptive runner's answered list from the already-persisted attempt data on start-up, instead of assuming a fresh session.

Scope: `src/components/assessment/AdaptiveRunner.tsx` only. No backend, schema, or engine-logic changes.

1. After initialising the adaptive attempt, load the attempt's saved answers using the existing attempt store fetch scoped to the assessment.
2. Load the corresponding question records with the existing `fetchQuestionsByIds` helper so the review list can render text, skill, topic, and level.
3. Seed the runner's `answered` list and the asked-count/progress ring from those saved answers, matching each answer to its skill and level from the persisted adaptive state.
4. Keep the Submit button disabled while this hydration is in flight (show the existing loading state), then enable it once saved answers are present.

## Guardrails kept intact

- Submit stays disabled when there genuinely are no answers.
- Already submitted/evaluated attempts are unaffected — they never enter the runner.
- No duplicate submission: the existing `finalizing` guard and terminal-status checks are unchanged.
- Nothing changes for fixed assessments, registry, question bank, or review flows.

## Manual test steps

1. Start an adaptive assessment as an employee and answer all questions.
2. Close/navigate away before clicking Submit.
3. Reopen the assessment and resume.
4. The review screen should list every previously answered question with the chosen option, and Submit should be enabled.
5. Submit and confirm the attempt is evaluated and a manager review is created as before.
6. Repeat, closing after only 1–2 answers: the runner should continue at the next question with prior answers preserved.
