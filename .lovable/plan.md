# Fix: Fixed Assessment detail screen shows Verified Level equal to Achieved Level

## Current state

The listing screens (My Assessments, Team Assessments) already use the shared helpers in `src/lib/assessmentStatus.ts`:
- Achieved Level: `getAchievedLevelFromAttempt(attempt, { questions, resolveLevel })` — for fixed attempts it derives the level from the delivered questions' target levels plus each question's AI evaluation score (score >= 50 counts as correct).
- Verified Level: `getVerifiedLevelFromReviews(reviews, attemptId, attempt)` — reads only the completed manager review for that attempt.

The detail screen does not. `src/components/assessment/ResultSummaryCard.tsx` computes its own numbers: for a fixed attempt it falls back to `skill_scores[].calculated_level`, which is the exact same value the manager review is seeded from. So on detail screens both columns show the same level. Adaptive attempts are unaffected there because the card reads `adaptive_state.history`.

## The fix (smallest atomic change)

Make the detail card reuse the same shared helpers the listings already use, instead of its own duplicate math.

- `src/components/assessment/ResultSummaryCard.tsx`
  - Accept an optional `questions` prop (the assessment's `assessment_questions`).
  - Build the same `resolveLevel` mapping used in the listings (`getIdToLevelMap` + `getCompetencyToLevelMap` from the competency level store).
  - Overall Achieved Level and the correct/total counts come from `getAchievedLevelFromAttempt(attempt, { questions, resolveLevel })`.
  - Verified Level comes from `getVerifiedLevelFromReviews([review], attempt.id, attempt)`; when it returns null, keep the existing "Pending manager review" placeholder.
  - Per-skill breakdown rows: for fixed attempts, derive each skill's achieved level from that skill's questions scored >= 50 (same rule), keeping the adaptive branch untouched.

- `src/pages/AssessmentDetailPage.tsx`
  - Pass `assessment.assessment_questions` into `ResultSummaryCard`. No other change.

Adaptive path, review workflow, scoring persistence, and database are untouched.

## Result

Listing and detail screens for both My Assessments and Team Assessments read Achieved Level and Verified Level from the same two functions, so they always agree, and Verified Level only ever comes from a completed manager review.

## Manual test

1. Fixed assessment approved without adjustment: detail Result Summary shows an evidence-based Achieved Level; Verified Level shows the manager value; both match the values in the My/Team listings.
2. Same assessment opened from Team Assessments detail — identical values.
3. Fixed assessment with review still pending: Verified Level shows "Pending manager review", not the achieved value.
4. Adaptive assessment detail: both values unchanged from today.
5. Fixed assessment with no correct answers / missing evaluations: falls back to the existing behaviour, no crash, dash where nothing can be derived.
