## Adaptive Assessment Engine

Today, "adaptive" templates pre-generate a fixed list of questions up front (round-robin by skill), then the employee answers them all. We will replace this for **adaptive templates only** with a true adaptive engine that picks the next question after each answer, walks levels up/down based on a streak, and computes the final skill level from the in-session evidence.

Fixed templates remain unchanged.

---

### Engine Behavior (per attempt)

1. **Skill selection** — pick N skills (round-robin) from the template's domain, scoped by `skill_selection_mode` (`top_n` from registry ratings, or `custom` from `assessment_template_skills`). N = `template.skills_per_assessment`.
2. **Initial level per skill** — start at the employee's self-rated level for that skill if available, else **L3**.
3. **Question loop** — for each skill, pick one published MCQ at the current level (correctness from `correctIndex` in MCQ JSON). Track per-skill `correctStreak` / `wrongStreak`.
4. **Level movement**:
   - 2 consecutive correct → level up (cap at L5)
   - 2 consecutive wrong → level down (floor at L1)
   - Streak resets when level changes or pattern breaks.
5. **Stop conditions** (per skill):
   - Reached `template.questions_per_skill` (clamped 4–5), OR
   - No more questions available at the current level and no fallback available.
6. **Final level (per skill)** — highest level at which the candidate answered ≥ 2 questions correctly. If none qualify, use `max(1, lastAttemptedLevel - 1)`.
7. **Edge cases / fallback** — if no question exists at the target level, try level − 1, then level + 1, then nearest available; mark that question as "fallback" so it doesn't aggressively shift the streak.

Final skill scores are stored using the existing `attempt_skill_scores` table. `avg_score` is derived from per-question correctness (correct = 100, wrong = 0) so existing dashboards keep working; `calculated_level` holds the adaptive final level; `target_level` holds the starting level.

---

### What changes

**Template editor (no schema change)** — for adaptive templates, restrict question types to **MCQ only** (the engine needs a deterministic correct answer). Keep the type chip but disable Scenario/Coding with a tooltip.

**Removed for adaptive**: pre-generation of `assessment_questions` at assignment time. Adaptive assignments create the `assessment` row with an empty question list and `is_adaptive = true`. Questions are added one-by-one as the engine selects them.

**Database migration**:
- `assessments`: add `is_adaptive boolean default false`.
- `assessment_attempts`: add `adaptive_state jsonb default '{}'::jsonb` (tracks per-skill: currentLevel, correctStreak, wrongStreak, history, finalLevel, attemptedCount).
- Backfill existing assessments with `is_adaptive = false`.

**New store: `src/stores/adaptiveEngineStore.ts`**
- `initAdaptiveAttempt(assessmentId)` — picks initial skills + levels, persists to `adaptive_state`.
- `getNextQuestion(attemptId)` — selects next question (skill round-robin + level + fallback), inserts into `assessment_questions`, returns it.
- `recordAnswer(attemptId, questionId, isCorrect)` — updates streak, moves level, persists state, marks per-skill stop.
- `finalizeAdaptiveAttempt(attemptId)` — computes final level per skill (rule: highest level with ≥ 2 correct, else lastLevel − 1), writes `attempt_skill_scores`, marks attempt `evaluated`, syncs assignment status.

**Assignment flow (`src/stores/assignmentStore.ts`)**:
- For adaptive templates, skip `addAssessment` and instead create the empty `assessments` row with `is_adaptive = true`. Fixed flow unchanged.

**Exam UI (`src/pages/AssessmentExecPage.tsx`)**:
- When `assessment.is_adaptive`, switch to an adaptive runtime:
  - On start: call `initAdaptiveAttempt`, then `getNextQuestion`.
  - On submit-answer: grade locally (compare selected MCQ index to `correctIndex`), call `recordAnswer`, then `getNextQuestion` until engine returns `null` (done).
  - Hide the "navigate by question index" sidebar; show a "Question X — Skill: Y, Level: Z" header and a single Next button.
  - On engine-done: call `finalizeAdaptiveAttempt`, no AI evaluation needed (MCQ correctness is deterministic). Skip the existing `submitAttempt` AI path for adaptive; still create the manager review row using the computed `skill_scores`.

**Manager review** — works as today; `skill_scores` already feed into `useReviewStore.createReview`.

---

### Validation & Constraints

- Adaptive templates require `domain_id` and `question_types` ⊆ `['mcq']` (UI enforces; saveTemplate validates).
- `questions_per_skill` is clamped to 4–5 for adaptive at save-time.
- If a skill has zero MCQs across all 5 levels, the engine drops the skill at init and surfaces a toast: "Skipped {skill} — no MCQs available".
- If all selected skills are dropped, assignment fails with `reason: 'No MCQs available for any selected skill'`.

---

### Files to add/change

- **Migration**: `assessments.is_adaptive`, `assessment_attempts.adaptive_state`.
- **New**: `src/stores/adaptiveEngineStore.ts`.
- **Edit**: `src/stores/assignmentStore.ts` — branch on `template.type === 'adaptive'`; create empty assessment.
- **Edit**: `src/stores/assessmentStore.ts` — extend `Assessment` with `is_adaptive`; small typing only.
- **Edit**: `src/pages/AssessmentExecPage.tsx` — adaptive runtime branch (new `<AdaptiveRunner />` sub-component to keep diff focused).
- **Edit**: `src/pages/AssessmentTemplateEditPage.tsx` — restrict adaptive `question_types` to MCQ only; clamp questions_per_skill to 4–5.

No removal of fixed-template behavior. No AI evaluator changes.

---

### ASCII flow

```text
start attempt
  └─ pick N skills (round-robin)
  └─ per skill: level = self_rating || 3
loop:
  pick skill (round-robin) not yet done
    pick question at currentLevel (fallback ±1)
    employee answers
      correct? streak.correct++   wrong? streak.wrong++
      if streak.correct == 2 → level = min(5, level+1); reset
      if streak.wrong   == 2 → level = max(1, level-1); reset
    skill.attempted++
    if skill.attempted >= questions_per_skill → mark skill done
all skills done → finalize
  per skill: final = max level with ≥ 2 correct, else lastLevel-1
  write attempt_skill_scores; status = evaluated; create review
```
