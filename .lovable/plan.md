## Goal

Simplify the assessment result experience. Drop percentage-based "Overall AI Score" and rename everything to **Assessment Score**, expressed only as an achieved competency level (e.g. `L3 - Intermediate`). Replace the current confusing logic with a simple rule: the achieved level is the **highest competency level at which the employee answered correctly**, computed per-skill and overall.

## New scoring rule (single source of truth)

For each skill in an adaptive attempt:

- Look only at the questions the employee got **correct**.
- Achieved level = the **maximum `level` among correct answers**.
- If the employee got nothing correct on that skill → achieved level = **L1** (or "Not achieved" badge — see Open question).

Overall achieved level = **average (rounded) of per-skill achieved levels**, then mapped to its competency label (L1 - Beginner, L2 - Basic, …) via the `competency_levels` table.

The numeric `total_ai_score` (0–100) and `avg_score` columns are kept in the DB (no migration needed) but are **no longer surfaced anywhere in the UI**. We just stop displaying them.

This replaces the current logic which:

- Computes `avg_score = correctCount / totalAsked * 100` per skill
- Then maps that percentage back to a level via competency score ranges
- Causes the reported bug (2/4 correct = 50% → L2, even though both correct answers were at L3).

## What changes in the UI — Assessment Detail page

### 1. Remove the "AI Score" metadata card

Delete the 4th metadata card ("AI Score 13% / AI: L2 / Verified: Lx") in the top grid. The grid becomes 3 cards: **Questions, Duration, Skills**.

### 2. Add a new "Result Summary" card (only when attempt is terminal)

Replaces the removed AI Score tile and the existing `EvalResults` "Overall AI Score" panel. Shown above the Attempted Questions table. Contents:

```
RESULT SUMMARY
Achieved Level: [ L3 - Intermediate ]      ← big badge, derived
Verified Level: [ L3 - Intermediate ]      ← only if manager review completed

Questions Attempted: 4
Correct: 2     Wrong: 2

Skill-wise breakdown
─────────────────────────────────────────────
React          2 / 3 correct     L3 - Intermediate
Node.js        1 / 2 correct     L2 - Basic
TypeScript     0 / 1 correct     —
```

- "Achieved Level" badge replaces the percentage display.
- "Verified Level" appears only when `review.status === 'completed'`, computed as the rounded average of `verified_level` across `skill_reviews`.
- Skill-wise rows pull from `attempt.adaptive_state.skills[*].history` (correct vs total, max level among correct).

### 3. Rename all "AI Score" / "AI Evaluation" labels

- "Overall AI Score" → removed entirely.
- "AI Score" card label → removed.
- The `EvalResults` "Per-Question Results" section header stays, but its top **Overall AI Score** block, **Skill Scores & Calculated Levels** block, and **Evaluation Dimensions** block are removed (since those reintroduce the percentage). Per-question expandable rows (employee answer, correct option, feedback) stay — they're useful.
- Manager Review Panel and notifications continue to call this an "Assessment" / "Assessment Score". Anywhere user-facing text says "AI Score" → change to "Assessment Score".

### 4. Attempted Questions table

Already shows ✓ Correct / ✗ Incorrect per question — keep as is. This is the only place the per-question right/wrong info needs to live.

## What changes in the engine — `src/stores/adaptiveEngineStore.ts`

In `**finalizeAdaptiveAttempt**` and `**reconstructEvaluationsFromHistory**`, replace the level-calculation block with the simple rule:

```ts
const correctLevels = skill.history.filter(h => h.correct).map(h => h.level);
const calculated_level = correctLevels.length
  ? Math.max(...correctLevels)
  : 1; // or null — see Open question
```

Remove the existing 2-correct-at-a-level threshold logic (lines ~467–484) and the percentage-derived level mapping. Keep `avg_score` written to the DB for backward compatibility but stop using it for level decisions. `total_ai_score` is still written (avg of avg_score) but no UI reads it.

This single change fixes the reported bug — the 2 correct L3 answers now produce `calculated_level = 3`, not L2.

## Files to touch

- `src/stores/adaptiveEngineStore.ts` — replace level calculation in `finalizeAdaptiveAttempt` and `reconstructEvaluationsFromHistory` with "max level among correct answers".
- `src/pages/AssessmentDetailPage.tsx` — drop the AI Score card; render a new `ResultSummaryCard` for terminal attempts; remove `EvalResults` overall/skill/dimension blocks (or replace `EvalResults` with a slimmer version).
- `src/components/assessment/EvalResults.tsx` — strip the Overall AI Score, Skill Scores, and Dimension Breakdown sections. Keep only "Per-Question Results" with right/wrong + feedback. Rename remaining "AI" wording to "Assessment".

No DB migration. No changes to manager review, registry, or notification flows.

## Out of scope

- Changing the fixed (non-adaptive) assessment evaluation pipeline — it still uses AI-graded scores. We only simplify the **display** there to show level instead of percentage; underlying scores stay.
- Touching the competency_levels score ranges (no longer used for level derivation in adaptive attempts after this change).

## Open question (please confirm before I implement)

When an employee gets **zero correct answers** on a skill, what should we show?

Ans: **L1 - Beginner** (treat as the lowest level achieved) — keeps every skill mapped to a level.