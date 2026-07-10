# Adaptive assessment — "questions don't load" fix

## What I found from the DB

For the currently-failing template `.Net Skill Assessment Test 2` (`0fee3693…`):

- All 5 template skills exist and have **45–50 published MCQs** each.
- All 3 in-progress attempts have `adaptive_state.initialized = true` with **5 skills**.
- 2 of 3 attempts have **zero** `assessment_questions` rows → the runner never successfully pulled the first question.

So init works. The "Skills: 0" on the detail card is cosmetic (`assessment.skill_ids` stays empty until the first question is persisted). The real failure is downstream — either `getNextQuestion` throws, or the runner never mounts (adaptive path not wired on the detail page's "Resume" button, or an error is swallowed).

## Root causes that can silently block "next question"

From `adaptiveEngineStore.getNextQuestion`:

1. `loadCompetencyLevelMap()` returns an empty `levelToId` → every level lookup fails and each skill is immediately marked `done` → the recursion returns `null` question with no toast.
2. `assessment_questions` insert fails (e.g., missing `tenant_id`, RLS, or a unique constraint from a leftover row) → error swallowed by the caller.
3. `AdaptiveRunner` `initAdaptiveAttempt` returns `{ state: null, reason }` — the runner shows a toast, but the detail page still shows "Resume Assessment" so the user thinks nothing happened.
4. `AssessmentDetailPage` may still route in-progress adaptive attempts through `FixedRunner` (which reads `assessment.assessment_questions` — empty for a fresh adaptive attempt → "no questions" screen).

## Plan

### 1. Diagnose the live assessment (no code)

Query `competency_levels` (active + level→id map) and inspect the exact adaptive attempt row from the browser to confirm which of #1–#4 is hitting. Report which case.

### 2. Surface the real reason in the UI

`src/components/assessment/AdaptiveRunner.tsx`
- Replace the generic `toast.error('Failed to initialize…')` with the actual `reason` string on-screen: render an inline error card ("This adaptive assessment can't start: <reason>. Contact your admin.") instead of an invisible toast.
- Add a matching inline error when `getNextQuestion` returns `null` on the very first call (before any answer) — currently it silently opens the empty Review panel.

`src/pages/AssessmentDetailPage.tsx`
- Fix the "Skills: 0" header for adaptive attempts: read skill count from `attempt.adaptive_state.skills.length` when `is_adaptive` and no `assessment_questions` yet.
- Ensure the "Resume Assessment" button for `is_adaptive=true` mounts `AdaptiveRunner`, not `FixedRunner`. (Verify — if already correct, no change.)

### 3. Harden `getNextQuestion`

`src/stores/adaptiveEngineStore.ts`
- If `loadCompetencyLevelMap()` returns empty, throw with a clear message instead of silently marking every skill `done`.
- Wrap the `assessment_questions` insert with `.select().maybeSingle()` and surface the error to the caller (return `{ error }` on the shape) so `AdaptiveRunner` can display it.
- Ensure the insert includes `tenant_id` (fetched from the assessment row) to avoid NOT-NULL failures.

### 4. Preflight validation on template assign

`src/components/templates/AssignTemplateDialog.tsx` (or the assignment store)
- Before creating assessments, for each target employee resolve the same candidate skills the engine would use, and check:
  - `assessment_template_skills` (custom mode) is non-empty, **or** `domain_skill_mappings` fallback is non-empty.
  - At least one candidate skill has a published MCQ (`question_type='mcq'`, `status='published'`, `deleted_on IS NULL`).
  - `competency_levels` has at least one active level.
- Block the assign with a specific toast: "Template has 0 skills / 0 MCQs — cannot assign."

### 5. Verification

- Manual: assign the same template again, resume, first MCQ renders. Then temporarily disable an MCQ to force the empty-pool path and confirm the inline error reads clearly.
- SQL spot-check: after Resume, `assessment_questions` has one row.

## Out of scope

- Changing adaptive scoring/level logic.
- Rewriting the runner UI.
- Backfilling old broken attempts (once fix ships, admin can re-assign).
