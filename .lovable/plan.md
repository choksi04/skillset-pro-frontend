## Goal

Restructure the list tables in **My Assessments** and **Team Assessments** to clearly separate Achieved Level (AI-derived) and Verified Level (manager-approved), since managers can adjust levels during review.

## New helper

Add `getVerifiedLevelFromReviews(reviews, attemptId)` to `src/lib/assessmentStatus.ts`:
- Find the completed review for the given attempt (`review.attempt_id === attemptId && review.status === 'completed'`).
- Return the rounded average of `skill_reviews[].verified_level` across skills.
- Returns `{ level: number | null }`. `null` means not verified yet → render as "—".

## My Assessments page (`src/pages/AssessmentsPage.tsx`)

Replace the current 5 columns with:

| Column | Content |
|---|---|
| **Assessment Details** | Name (bold). Sub-line(s): domain badge, "{N} Questions · {Adaptive/Fixed}", "{duration} mins". |
| **Status** | Status badge + date line below (same logic as today: Completed/Submitted/Assigned/Created). |
| **Assigned By** | Unchanged (avatar + name + role/Automated). |
| **Achieved Level** | If attempt submitted/evaluated/approved → level badge via `getAchievedLevelFromAttempt` + `getFormattedLevelLabel`. Else `—`. |
| **Verified Level** | If manager review completed → level badge via new `getVerifiedLevelFromReviews`. Else `—`. |
| **Action** | Unchanged (Start/Resume/View Results). |

Remove the "X / Y correct" sub-label and the inline achieved-level badge currently nested inside the Status cell.

## Team Assessments page (`src/pages/TeamAssessmentsPage.tsx`)

Replace the current 6 columns with:

| Column | Content |
|---|---|
| **Employee** | Unchanged (avatar + name + designation). |
| **Assessment Details** | Same structure as My Assessments (name + domain + questions/format + duration). |
| **Status** | Status badge + date below. |
| **Achieved Level** | Same as My Assessments. |
| **Verified Level** | Same as My Assessments. |
| **Action** | Unchanged (Send Reminder / Review / View). |

The existing "Skill Level" column (which mixed AI-derived level + verification badge) is removed; its data is now split across Achieved + Verified columns. Verification filter continues to work (uses `review.status === 'completed'`).

## Out of scope

- Manager review logic, DB schema, edge functions.
- Detail pages (`AssessmentDetailPage`, `ResultSummaryCard`).
- Filter popover contents (only the table changes).
