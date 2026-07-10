## Problem

`Generate Questions with AI` in Question Bank is returning "Edge Function returned a non-2xx status code" — most likely low AI credits on the gateway. We want to hide this feature from users for now while keeping AI evaluation of assessment answers working (that runs from `evaluate-assessment`, unaffected).

## Change

Hide the entire "Generate Questions with AI" panel in `src/pages/QuestionBankPage.tsx` behind a disabled flag. No logic removed — flip one condition back later to re-enable.

- Line 385–386: wrap the `<Collapsible>` block with `{false && canEdit && (...)}` (leave the JSX intact so re-enabling is a one-line change).

Nothing else touched:
- `evaluate-assessment` edge function stays live (AI evaluation of answers continues to work).
- `generate-questions` edge function stays deployed but no UI entry point calls it.
- "AI Generated" filter and existing AI-generated question badges remain visible for historical questions.

## Verification

- Load `/questions` as an admin: no "Generate Questions with AI" collapsible card renders between the stats and the filter bar.
- Existing questions still list; filters, create, edit, bulk upload all work.
- Complete an assessment → AI evaluation still scores answers.

## Re-enable later

Change `{false && canEdit && (` back to `{canEdit && (` on line 386 once credits are topped up.
