# Fix: adaptive assessment still delivers 40 of the configured 50 questions

## Confirmed root cause (checked against live data)

The QA template is "Testing Assessment": adaptive, custom skill mode, 10 skills x 5 questions = 50 configured.

Two of its 10 skills have **zero** published MCQs:

- Automation Testing - Core Concepts — 0 MCQs
- Automation Testing - Selenium — 0 MCQs

The remaining 8 skills have 25-50 published MCQs each, so 50 eligible questions clearly exist.

Both attempts on that template were inspected. Their persisted `adaptive_state` has:

```text
skills: 8      delivered: 40      assessment_questions: 40
targetTotal: null   configuredTotal: null   quotas: null   shortfallReason: null
```

`targetTotal`/`quotas`/`shortfallReason` are exactly the fields the previous fix introduced, and the engine writes them on **every** fresh init. Their absence proves these attempts were initialized with the pre-fix state shape (the runtime QA used did not yet have the new engine). `initAdaptiveAttempt` returns the existing state untouched whenever `initialized` is true, so those attempts stay permanently on the legacy plan, and the legacy fallback in `getTargetTotal` computes 8 skills x 5 = **40**.

So the cause is **not** a hardcoded 40 cap, not a pool/API row limit, not eligibility filtering of individual questions, and not the template config. It is a **stale, already-persisted adaptive plan** built by the old skill-count-based formula, which the new code never re-plans.

Second, smaller gap: even for fresh attempts, `configuredTotal` is derived from the number of **resolved** skills (`candidateSkills.length x questionsPerSkill`). When the resolved pool is smaller than `skills_per_assessment`, the runtime target drifts below the number the template page shows (`skills_per_assessment x questions_per_skill`). Making both use the same formula keeps the preview and runtime identical.

## The fix (smallest atomic change)

Single file: `src/stores/adaptiveEngineStore.ts`.

1. **Re-plan legacy attempts on load.** In `initAdaptiveAttempt`, when the existing state is initialized but has no `targetTotal`/`quotas`, run the same budget computation already written for fresh attempts against the state's existing skills, honouring questions already delivered per skill, then persist the upgraded state. In-flight attempts (including the two current ones) immediately continue toward 50 instead of stopping at 40.

2. **One formula for configured total.** Compute `configuredTotal = skills_per_assessment x questions_per_skill` — the same expression the template page and `AssessmentDetailPage` show — instead of deriving it from the resolved skill count. The top-up loop already redistributes that budget round-robin across usable skills and is capped by each skill's real eligible bank, so no skill is ever asked more questions than exist.

3. **Always explain a shortfall.** Extend `shortfallReason` to name the skills excluded for having no published MCQs, in addition to the existing count message. It already renders in `AdaptiveRunner`'s notice and is logged via `console.warn`, so no new UI pattern is introduced.

Nothing else changes: no schema change, no change to delivery gating (the already-fixed "no invalid extra question" behaviour stays, since `getNextQuestion` still hard-stops at `getTargetTotal`), no change to `recordAnswer`, scoring, finalisation, fixed assessments, registry, dashboards, question bank, or review logic.

## Result

- The QA attempt configured for 50 delivers 50 questions, spread across the 8 skills that actually have MCQs (topped up beyond 5 per skill where the bank allows).
- If genuinely fewer than 50 eligible MCQs exist, the runner shows the reason and names the skills, instead of silently shrinking.

## Manual test steps

1. Resume one of the two in-flight "Testing Assessment" attempts: the counter target moves from 40 to 50 and the runner keeps serving questions past 40, stopping exactly at 50.
2. Assign the same template to a fresh employee: exactly 50 questions, 50 rows in `assessment_questions`, no 51st question, Submit enabled on the review screen.
3. Assign a template where the eligible bank is genuinely smaller than configured: reduced total is shown with the excluded-skill reason in the notice and in the console.
4. Assign a small template ("RPA Batch - 1", 2 skills x 5): unchanged, 10 questions.
5. Run a fixed (non-adaptive) assessment: unchanged.

## Edge cases covered

- Legacy in-flight attempts with the old `adaptive_state` shape (the reported case).
- Skills with zero published MCQs (excluded, named, budget redistributed).
- Skill pool smaller than `skills_per_assessment` (preview and runtime totals now agree).
- Banks too small to reach the configured total (explicit shortfall message, no silent reduction).
- Reload mid-attempt: delivered count is respected, no duplicate or phantom question.
