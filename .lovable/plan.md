# Score % vs Achieved Level mismatch

## What's actually happening (not a data bug)

The list view and the detail view show **two different metrics** computed in two different ways. They aren't wrong individually — they answer different questions — but together they look contradictory.

### For your two assessments

| Assessment | List shows | Detail shows | Why |
|---|---|---|---|
| `96b6…b202` (1 skill) | **Score 50%** | **L3 – Demonstrating** | 2 of 4 correct → 50%. The 2 correct were both at Level 3 → achieved L3. |
| `f2d5…f148c4` (4 skills) | **Score 25%** | **L3** (overall) | 4 of 16 correct → 25%. Per-skill max-correct-level: L4, L1, L2, L1 → avg ≈ L2; but only skills with at least one correct answer count → (4+2)/2 = L3. |

### Where the two numbers come from

- **List "Score X%"** (`AssessmentsPage.tsx` line 416, `TeamAssessmentsPage.tsx` line 518) reads `assessment_attempts.total_ai_score`. For adaptive attempts this is set by `adaptiveEngineStore.finalizeAdaptiveAttempt` (line 510) as `avg(per-skill avg_score)`, where `avg_score = correctCount / total * 100`. **It's a correctness rate, not a competency score.**
- **Detail "Achieved Level"** (`ResultSummaryCard.tsx`) is `max(level of correct answers)` per skill, then averaged across skills. **It ignores the % entirely.**

So 50% → L3 is possible (you got the L3 questions right and the L4 questions wrong) and 25% → L3 is possible (one skill nailed L4, others failed). The mapping in `competency_levels` (50 → L2, 20 → L1) is **not used** by the adaptive flow at all.

## Proposed fix — pick one direction

### Option A — Recommended: Show the level everywhere, drop the misleading %

Replace the "Score X%" badge in the assessment list (both `AssessmentsPage` and `TeamAssessmentsPage`) with the **Achieved Level** badge (same value `ResultSummaryCard` computes). Optionally show "X / Y correct" as a small secondary label. This makes list and detail tell the same story and matches the L1–L5 framework the product is built on.

### Option B — Keep %, but make it score-derived (and consistent with levels)

Change `total_ai_score` in `finalizeAdaptiveAttempt` to the **mid-point of the achieved level's range** (e.g. L3 → 67%, L2 → 48%) using `competency_levels`. Then 50% will always map to L2 and L3 will always show ≥60%. Downside: loses the "correctness rate" info, and changes historical numbers on next finalize.

### Option C — Show both, clearly labeled

Keep the % but rename it "Correctness" and add the Achieved Level badge next to it in the list. No recomputation, but two metrics side by side.

## Recommendation

**Option A.** The product is level-driven (L1–L5 is the framework, registry, and review unit). The % is an internal correctness rate that confuses users when it doesn't map to a level via the competency table. Keeping it as the headline metric is what's causing the reported confusion.

## Scope of change for Option A

- `src/pages/AssessmentsPage.tsx` (~line 406–417): swap Score % badge for `getFormattedLevelLabel(levels, achievedLevel)` badge; compute `achievedLevel` the same way `ResultSummaryCard` does (read `attempt.skill_scores` or `adaptive_state.skills` and take avg of max-correct-levels).
- `src/pages/TeamAssessmentsPage.tsx` (~line 508–520, and the `scoreToLevelDynamic(total_ai_score)` usage at line 165): same swap, and replace the `scoreToLevelDynamic` mapping so the manager view derives level the same way as `ResultSummaryCard`.
- Optionally extract the "compute achieved level from attempt" logic into `src/lib/assessmentStatus.ts` (or a new helper) so list, detail, and manager view all share one function — guarantees they never disagree again.
- No DB change, no edge function change, no recomputation of historical data.

## Out of scope

- The adaptive engine's level rule (max-correct-level) itself — keeping as-is.
- Non-adaptive / fixed-runner attempts that use AI-scored 0–100 (those already use `scoreToLevelDynamic` against the competency table consistently in both list and detail).
- User Guide copy update (small follow-up once the UI is finalized).
