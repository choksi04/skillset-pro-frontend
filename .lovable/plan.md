# Plan

## Issue 1 — Questions cluster on a single topic per skill

**Where:** `src/stores/assessmentStore.ts` → `generateAssessmentQuestions` (fixed template flow) and `src/stores/adaptiveEngineStore.ts` (adaptive flow).

**Current behavior:** Candidates are filtered by `skill_id + competency_level + question_type`, sorted by `created_at`, then the first N are picked. When a skill is populated topic-by-topic (SQL Server first, then MySQL, etc.), the earliest-created batch dominates and only that topic's questions get selected.

**Fix — topic-diversified round-robin per (skill, level, question_type):**

1. Group candidate questions by `topic_id` (treat `null`/missing topic as its own bucket).
2. Shuffle candidates within each topic bucket (seeded per assessment so a retry is stable within one run).
3. Shuffle the topic order.
4. Pick round-robin across topics until `targetCount` is reached:
   - Rotate through topics one question each pass.
   - Skip a topic when its bucket is empty.
   - Only when every topic has been used at least once, allow a second pass (i.e. repeats) — matches the user's rule "topics fewer than expected questions → repeats are OK, but all topics must be covered first."
5. When candidate topics ≥ `targetCount`: each picked question comes from a distinct topic (no repeats).
6. Keep the existing `usedIds` de-dup so the same question isn't picked twice inside one assessment across question types.

Apply the same round-robin selection in `adaptiveEngineStore` where the next question is chosen for a skill so consecutive questions in an adaptive attempt don't stick to one topic either.

**No schema change.** `questions.topic_id` already exists and is loaded into the store.

## Issue 2 — Dash (—) on the Results page for question 1

**Where:** `src/pages/AssessmentDetailPage.tsx` lines ~641–657 (Attempted Questions table, Result column).

**Root cause:** The cell falls back to a bare `—` badge whenever there is no `ai_evaluations` row for that `question_id`. That happens when the employee skipped the question (no answer submitted), so the AI evaluator produced no row. The user sees an unexplained dash.

**Fix:**
- Look up the corresponding `attempt.answers` entry for `aq.question_id`.
- If no answer OR answer text is empty → render a `Skipped` badge (neutral/muted variant).
- If answer exists but `ev` is missing → render `Pending` (evaluation not yet produced).
- Otherwise keep the current `Correct` / `Incorrect` badges.

Mirror the same status in `EvalResults.tsx` header if needed for consistency (only if the same ambiguity shows up there — otherwise leave untouched).

## Files to change

- `src/stores/assessmentStore.ts` — replace the `slice(0, targetCount)` block with the topic round-robin picker (small helper function inside the file).
- `src/stores/adaptiveEngineStore.ts` — apply topic-diversity when selecting the next candidate for a skill.
- `src/pages/AssessmentDetailPage.tsx` — replace the fallback `—` badge with `Skipped` / `Pending` logic based on `attempt.answers`.

## Out of scope

- No changes to question authoring, topic setup, or DB schema.
- No changes to scoring math or manager review workflow.
- Manual retesting on a real assessment is expected after the fix ships.
