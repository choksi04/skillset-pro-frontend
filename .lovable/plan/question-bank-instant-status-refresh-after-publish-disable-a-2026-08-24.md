# Question Bank: instant status refresh after publish, disable, and bulk upload

## What's happening

The Question Bank table renders from a page-local list (`pageQuestions`) that is filled once per page/filter load. Mutations (publish, disable, bulk upload) update the shared question store, but nothing tells the page to reload its own list — so the row keeps showing the old status until a hard refresh re-runs the page load.

The page already has the right pattern: a `loadQuestionPage()` refresher that preserves current page, filters, search and sort. It is already called after AI save, question form save, delete, and bulk publish. It is simply missing on three actions.

## The fix (smallest atomic change)

1. Single publish (row menu) — await `publishQuestion(id)`, then call `loadQuestionPage()`.
2. Enable/disable (row menu) — await `toggleQuestionStatus(id)`, then call `loadQuestionPage()`.
3. Bulk upload — pass an `onUploaded` callback to `BulkUploadSheet` that calls `loadQuestionPage()`, and fire it after a successful import (same pattern `QuestionFormSheet` already uses with `onSaved`).

Also, the "Publish Selected" bulk action picks draft IDs from the global store list rather than the rows currently on screen; it will read from the displayed page rows so the selection matches what the user sees.

Existing toasts, filters, pagination, counts, and all other question logic stay exactly as they are.

## Technical details

- `src/pages/QuestionBankPage.tsx`
  - Row dropdown items at the publish and toggle-status handlers become async and call `loadQuestionPage()` after the store action resolves.
  - `<BulkUploadSheet ... onUploaded={loadQuestionPage} />`.
  - Bulk publish filter switches from `questions.find(...)` to `pageQuestions.find(...)`.
- `src/components/questions/BulkUploadSheet.tsx`
  - Add optional `onUploaded?: () => void` to its `Props` and invoke it after `addQuestions` succeeds.

No store, schema, service, or data-fetch architecture changes.

## Manual test

- Publish a draft question from the row menu — status flips to Published in place, filters/page unchanged.
- Disable a published question — status flips to Disabled immediately.
- Bulk upload an MCQ Excel — new rows appear without a browser refresh.
- Select several drafts and use Publish Selected — all flip immediately.
- Repeat while a skill/status filter and page 2 are active; the view should stay on the same page and filter.
