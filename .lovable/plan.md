# Question Bank: Pagination + Separate Counts API

## Problem

1. **Missing questions**: Supabase's 1,000-row limit means 62+ questions are invisible.
2. **Performance**: 1,000+ questions rendered at once slows the UI.
3. **Counts must be independent**: Stats cards (Total, Published, Draft, AI-generated) should come from a dedicated count query, not from the loaded question data.

## Solution

### 1. Add `fetchQuestionCounts` to `questionStore.ts`

Add a new store method that runs a lightweight query to get counts by status and source, independent of question data fetching.

```typescript
// New state
counts: { total: 0, published: 0, draft: 0, aiGenerated: 0 }

// New method
fetchQuestionCounts: async () => {
  const { data } = await supabase
    .from('questions')
    .select('status, ai_generated')
    .is('deleted_on', null);
  // This only fetches 2 small columns, but still hits the 1000 limit...
}
```

Actually, to avoid the 1,000-row limit entirely, we will create a **database function** that returns counts server-side:

**Database migration** — create a `get_question_counts` function:

```sql
CREATE OR REPLACE FUNCTION public.get_question_counts()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'published', COUNT(*) FILTER (WHERE status = 'published'),
    'draft', COUNT(*) FILTER (WHERE status = 'draft'),
    'disabled', COUNT(*) FILTER (WHERE status = 'disabled'),
    'ai_generated', COUNT(*) FILTER (WHERE ai_generated = true)
  )
  FROM public.questions
  WHERE deleted_on IS NULL;
$$;
```

**Store method** calls this via `supabase.rpc('get_question_counts')` — returns exact counts in one call, no row limit.

- If count is is more than 10,000, then we can convert them into 10k. 100k etc and with hover show the actual raw numbers in the tooltip with a thousand separator.

### 2. Fix `fetchQuestions` with paginated fetch loop

Replace the single `.select('*')` with a loop using `.range(offset, offset+999)` to fetch all rows in batches of 1,000.

### 3. Add UI pagination to `QuestionBankPage.tsx`

- `PAGE_SIZE = 50`, `currentPage` state (default: 1)
- Slice `filtered` for display: `filtered.slice((page-1)*50, page*50)`
- Reset `currentPage` to 1 on any filter/search change
- Render `Pagination` component below the table with Previous/Next, page numbers, ellipsis
- Show "Showing 1–50 of 312 questions" info text
- If the total count is is more than 10,000 then we can convert them into 10k. 100k etc and with hover show the actual raw numbers in tooltip with thousand seperator.
- Stats cards use `counts` from the dedicated RPC, not from `questions.length`

## Files Modified

- **New migration** — `get_question_counts()` database function
- `src/stores/questionStore.ts` — add `counts` state, `fetchQuestionCounts` via RPC, paginated `fetchQuestions`
- `src/pages/QuestionBankPage.tsx` — use `counts` for stats cards, add pagination UI with 50 per page