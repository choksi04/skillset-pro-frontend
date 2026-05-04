# Show Manager Comments in Result Summary

The employee's `My Assessments > Detail` page already renders `ResultSummaryCard` with the `review` prop available. We will extend that single component — no page-level changes needed.

## Changes

### 1. `src/components/assessment/ResultSummaryCard.tsx`

**a) Add a "Manager Comment" column to the Skill-wise breakdown table**

- Build a lookup map: `skill_id → { verified_level, manager_comment }` from `review?.skill_reviews`.
- Add a new rightmost `<th>Manager Comment</th>` column.
- For each row, render the comment as small muted text.
  - If review is missing or status !== `completed`: show `—` with tooltip "Pending manager review".
  - If review completed but comment empty: show "No comment" in muted italic.
  - Otherwise show the comment text (wrap nicely, `whitespace-pre-wrap`, `text-xs`). If comment is long, add the ellipsis and show comment in native browser tool with "title" attribute.

**b) Add an "Overall Manager Comment" section below the breakdown table**

A new `<div>` block (Card-style: `rounded-lg border border-border p-4`) with:

- Header: small label "Overall Manager Comment" + reviewer status badge (Approved / Pending).
- Body — three states:
  1. **No review yet** OR `review.status !== 'completed'`:
    "Assessment is still under manager review."
  2. **Completed but `overall_comment` empty/whitespace**:
    "Manager approved this assessment without additional comments." (muted italic)
  3. **Completed with comment**:
    Render `review.overall_comment` in `whitespace-pre-wrap text-sm text-foreground`.
- When completed, show small footer: "Reviewed on {formatted completed_at}".

## State Matrix (for clarity)


| Review state                 | Per-skill cell              | Overall section                                 |
| ---------------------------- | --------------------------- | ----------------------------------------------- |
| No review                    | —                           | "Assessment is still under manager review."     |
| `pending` / `in_progress`    | —                           | "Assessment is still under manager review."     |
| `completed`, comment empty   | "No comment" (italic muted) | "Manager approved without additional comments." |
| `completed`, comment present | Comment text                | Comment text + reviewed date                    |


## Files

- `src/components/assessment/ResultSummaryCard.tsx` (edit only)

No DB, store, or routing changes — `review.skill_reviews[].manager_comment` and `review.overall_comment` are already fetched by `reviewStore.fetchReviews`.