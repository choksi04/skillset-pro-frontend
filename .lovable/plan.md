# Fix Adaptive Assessment question count and end-of-assessment behaviour

## What QA saw
An adaptive assessment configured for 50 questions showed only 40, then still presented a
41st question that could not be saved, and the assessment ended unexpectedly.

## What the code actually does today (verified)

There is **no hardcoded 40-question cap** anywhere in the adaptive engine or runner.
The 40 comes from arithmetic:

- The configured total is implicit: `skills_per_assessment x questions_per_skill`
  (that is what the template page and `AssessmentDetailPage` display as the expected count).
- The engine (`initAdaptiveAttempt`) builds its plan from **usable skills only** — skills that
  survive the published-MCQ availability check. It also does **not** apply the
  `skills_per_assessment` cap in "Pick Skills" (custom) mode; it takes every template skill.
- The runner (`AdaptiveRunner`) advertises `usableSkills.length x questionsPerSkill` as the total.
  With 2 of 10 skills dropped, 10x5 = 50 configured becomes 8x5 = 40 delivered, silently.

The extra 41st question comes from two separate mismatches:

- The header prints `Question {asked + 1} of up to {total}`. When `asked` already equals the
  total, the counter reads 41 of 40 while the engine is still deciding.
- Per-skill budget is counted by `attemptedCount`, which only increments in `recordAnswer`.
  A question that was fetched and persisted into `assessment_questions` but never answered
  (page closed / reload) does not increment it, so the engine keeps handing out questions past
  the advertised total. If that skill has meanwhile been marked `done`, `recordAnswer` returns
  early (`if (!skill || skill.done) return;`) and the answer is **never saved** — exactly the
  "41st question not submitted" symptom — after which the runner falls through to the review
  screen, which reads as an unexpected auto-submit.

## The smallest atomic fix

Introduce one authoritative target in the persisted adaptive state and make every path read it.

1. **Store the target on init** (`adaptiveEngineStore.initAdaptiveAttempt`)
   - Apply `skills_per_assessment` consistently in both custom and auto modes.
   - Persist `targetTotal = min(configuredTotal, sum of eligible MCQs per usable skill)` plus
     `configuredTotal` and `shortfallReason` (which skills were dropped and why) in
     `adaptive_state`.
   - Top-up: when some skills are dropped, redistribute the remaining budget across usable
     skills (per-skill quota array instead of one flat `questionsPerSkill`) so a 50-question
     assessment still delivers 50 whenever enough eligible questions exist.

2. **Gate question delivery on the target** (`getNextQuestion`)
   - Compute questions already delivered from the persisted state, and return `null`
     immediately once delivered count >= `targetTotal`. This makes a 51st question impossible.

3. **Never drop an answer** (`recordAnswer`)
   - Remove the `skill.done` early return: if a question was delivered, its answer is recorded
     (state advances, `attemptedCount` capped at the quota). Delivery, not `done`, is the gate.

4. **Counter and completion in the runner** (`AdaptiveRunner`)
   - Read `targetTotal` from the returned state instead of recomputing it.
   - Clamp the displayed number: `Math.min(asked + 1, targetTotal)`.
   - Keep the existing early-exhaustion notice, but drive it from `shortfallReason` so the
     employee sees a clear message when fewer eligible questions exist than configured.

No changes to scoring, finalisation, fixed assessments, registry, dashboards, question bank,
or review logic.

## Files to change
- `src/stores/adaptiveEngineStore.ts` (state shape, init, getNextQuestion, recordAnswer)
- `src/components/assessment/AdaptiveRunner.tsx` (counter, completion, shortfall notice)

Existing attempts with an older `adaptive_state` are handled by deriving `targetTotal` on read
when the field is absent, so in-flight assessments keep working.

## Manual test steps
1. Template with 10 skills x 5 questions/skill, all skills with enough published MCQs:
   assessment shows questions 1..50, ends at 50, no 51st, Submit enabled on the review screen.
2. Same template with 2 skills having no published MCQs: total still reaches 50 if the other
   8 skills have enough questions; otherwise the runner shows the reduced total with a clear
   reason.
3. Answer 3 questions, close the tab, reopen: counter resumes at the right number, previously
   answered questions appear in the review list, no phantom extra question.
4. A fixed (non-adaptive) assessment behaves exactly as before.
