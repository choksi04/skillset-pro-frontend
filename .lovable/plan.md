## Problem

`questionStore.fetchQuestions()` pages through the entire `questions` table (~7000 rows → 8 sequential 1000-row API calls) and dumps everything into memory. It runs from many screens that only need a tiny slice:

- `AssessmentDetailPage` / `FixedRunner` — only need the ~4–10 questions in the current assessment
- `TeamAssessmentsPage` / `AssessmentsPage` — only need counts or referenced question IDs across visible rows
- `EvalResults`, `AddQuestionDialog`, `QuestionFormSheet`, `BulkUploadSheet` — only need referenced or filtered slices
- `SetupProgress`, `QuickStartChecklist` — only need the total count
- `QuestionBankPage`, `QuestionPickerSheet`, `SelectedQuestionsSheet`, `AssessmentTemplateEditPage` — legitimately browse/search, but should paginate server-side with filters, not preload everything

Result on the current Team Assessments screen: 8+ `questions?...offset=N&limit=1000` calls just to render 1 assessment's 4 questions.

## Fix (scoped fetching, no more full preloads)

### 1. Add scoped fetchers to `questionStore`

Extend the store with narrow, targeted methods. Keep `fetchQuestions()` only as an internal helper (not called from pages).

```text
fetchQuestionsByIds(ids: string[]): Promise<Question[]>
   - chunked .in('id', ...) fetch, upserts into store, returns rows
fetchQuestionsPage(filters, { limit, offset }): Promise<{ rows, total }>
   - server-side filter + range() + head-count for QuestionBank/pickers
fetchQuestionCounts()                    // already exists — keep
```

### 2. Replace `fetchQuestions()` calls per screen

| File | Current | New |
|---|---|---|
| `AssessmentDetailPage.tsx` | `fetchQuestions()` | `fetchQuestionsByIds(assessment.assessment_questions.map(q=>q.question_id))` after `fetchAssessmentById` |
| `FixedRunner.tsx` | `fetchQuestions()` | `fetchQuestionsByIds(assessmentQuestionIds)` |
| `EvalResults.tsx` | uses `questions` array | receive/lookup via `fetchQuestionsByIds` (or props from parent) |
| `TeamAssessmentsPage.tsx` / `AssessmentsPage.tsx` | `fetchQuestions()` | drop it — list only needs counts (`assessment.assessment_questions.length`) already on the assessment row |
| `AssessmentTemplateEditPage.tsx` | `fetchQuestions()` | `fetchQuestionsPage({ skill_ids, level, status:'published' }, page)` for the picker |
| `QuestionPickerSheet.tsx` / `SelectedQuestionsSheet.tsx` / `AddQuestionDialog.tsx` | `fetchQuestions()` | `fetchQuestionsPage(filters, page)` + `fetchQuestionsByIds(selectedIds)` for the "already selected" chip list |
| `QuestionFormSheet.tsx` | `fetchQuestions()` (dup check) | direct scoped Supabase query on duplicate check only |
| `BulkUploadSheet.tsx` | `fetchQuestions()` (dup check) | scoped `.in('question_text_hash', ...)` or per-row check |
| `SetupProgress.tsx` / `QuickStartChecklist.tsx` | `fetchQuestions()` | `fetchQuestionCounts()` only |
| `QuestionBankPage.tsx` | `fetchQuestions()` + client filter/sort/paginate | `fetchQuestionsPage(filters, {limit,offset})` — filter/sort/paginate on the server |

### 3. Question Bank server-side listing

Rewrite the list to send `skill_id`, `competency_level`, `question_type`, `status`, search, and `range(offset, offset+limit-1)` to Supabase, plus a `select('*', { count: 'exact', head: true })` sibling query for total. This is the biggest UX win — the page currently freezes waiting for all 7000 rows.

### 4. Cleanup

- Remove the `initialized` full-preload short-circuit from `questionStore` — no screen should depend on "all questions loaded".
- Leave the store's local cache (rows fetched by ID / page) so repeated views on the same detail page are instant.

## Expected result

- Team Assessments detail page: **1** `questions?id=in.(...)` call for the 4 assessment questions instead of 8 full-table pages.
- Question Bank: single paginated call (~50 rows) per page change, filter, or sort.
- Dashboards/onboarding: 1 RPC (`get_question_counts`) instead of full preload.

## Out of scope (deliberately)

- Similar preload smell in other stores (skills, topics) — separate pass if you want.
- Full-text search server-side (current substring filter can move to `ilike` in the same page query without adding infra).
