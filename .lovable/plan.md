## Goal

In the **Selected Questions** drawer (and ideally also the inline Selected list in the Assessment Template editor), make each question row clickable to open a detail panel that shows the full question content, options, and correct answer — matching the experience in the Question Bank.

## Approach

Reuse the existing `QuestionDetailSheet` from `src/pages/QuestionBankPage.tsx` rather than rebuilding it. This guarantees identical formatting (uses `FormattedQuestionContent`, badges, level labels, dates).

### Steps

1. **Extract `QuestionDetailSheet` into a shared component**
   - Move the inline `QuestionDetailSheet` function (lines 1082–1121 of `QuestionBankPage.tsx`) plus its dependencies (`questionTypeLabels`, `statusStyles`, `FormattedQuestionContent` import) into a new file: `src/components/questions/QuestionDetailSheet.tsx`.
   - Update `QuestionBankPage.tsx` to import from the new location.

2. **Make rows clickable in `SelectedQuestionRow.tsx`**
   - Add an optional `onClick` prop. Wrap the row content in a `button` (or add `role="button"` + `onClick` + cursor/hover styles).
   - Ensure the **Remove (X)** button stops propagation so it doesn't trigger the detail view.

3. **Wire detail sheet inside `SelectedQuestionsSheet.tsx`**
   - Add local state `detailQuestion: Question | null`.
   - Pass `onClick={() => setDetailQuestion(q)}` to each `SelectedQuestionRow`.
   - Render `<QuestionDetailSheet>` when `detailQuestion` is set, resolving `skillName`, `topicName`, and `levelLabels` from the existing stores already loaded in this component (skills, competencyLevels) plus the topic store.

4. **Apply the same in the inline Selected list** on `AssessmentTemplateEditPage.tsx`
   - Wherever `SelectedQuestionRow` is rendered inline (outside the sheet), pass the same `onClick` and host the `QuestionDetailSheet` at page level so users can click any selected question to inspect it without going through the secondary drawer.

### Technical notes

- `QuestionDetailSheet` already uses the shared `FormattedQuestionContent`, which renders MCQ options with the correct answer highlighted, scenarios, and coding problems consistently with Question Bank.
- No data fetching changes required — `useQuestionStore` already has full question objects in `SelectedQuestionsSheet`.
- Topic name in the sheet can be omitted (pass `null`) if the topic store isn't already loaded here, to keep the change minimal; the detail sheet handles `null` topic gracefully.

### Files

- New: `src/components/questions/QuestionDetailSheet.tsx`
- Edited: `src/pages/QuestionBankPage.tsx` (import from new location, remove inline def)
- Edited: `src/components/templates/SelectedQuestionRow.tsx` (clickable + stopPropagation on remove)
- Edited: `src/components/templates/SelectedQuestionsSheet.tsx` (host detail sheet)
- Edited: `src/pages/AssessmentTemplateEditPage.tsx` (host detail sheet for inline list)

### Out of scope

- No changes to the Add Questions picker (it already supports expanding to view options).
- No changes to data model or stores.
