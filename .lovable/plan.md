# Fix missing questions on Assessment detail — scoped fetch

## What you're seeing

Assessment `8a6e7b8c-…`: DB has 4 `assessment_questions` and 4 `attempt_answers` (all correct), but the "Assessment Questions" list on the detail page shows only 2.

## Root cause

`assessmentStore.fetchAssessments()` loads **every** assessment on app boot, then batches child rows in a single call:

```ts
supabase.from('assessment_questions')
  .select('*')
  .in('assessment_id', assessmentIds)   // no limit, no range
```

Supabase's Data API caps every response at **1000 rows by default**. `assessment_questions` currently holds **1362 rows**, so ~362 are silently dropped. With no `ORDER BY`, which rows are dropped is nondeterministic — this assessment lost 2 of its 4 on the recent load.

You're right that the real problem is the "fetch everything, filter in memory" pattern, not just the 1000-row cap. The list page needs a handful of rows for the current user; the detail page needs rows for a single assessment. There's no reason to pull the whole table.

## Fix — scoped fetches, not global preloads

Two targeted changes, no new helpers, no pagination hacks.

### 1. Detail page loads its own assessment

Add `fetchAssessmentById(id)` to `src/stores/assessmentStore.ts`:

```ts
fetchAssessmentById: async (id) => {
  const { data: a } = await supabase
    .from('assessments').select('*')
    .eq('id', id).is('deleted_on', null).maybeSingle();
  if (!a) return null;

  const { data: qs } = await supabase
    .from('assessment_questions').select('*')
    .eq('assessment_id', id)
    .order('created_at', { ascending: true });

  const assessment = mapAssessment(a, qs ?? []);
  // upsert into the store so lists stay in sync
  set((s) => ({ assessments: [assessment, ...s.assessments.filter(x => x.id !== id)] }));
  return assessment;
}
```

Do the same on the attempt side — add `fetchAttemptsForAssessment(assessmentId)` to `src/stores/attemptStore.ts` that fetches `assessment_attempts`, `attempt_answers`, `ai_evaluations`, `attempt_skill_scores` filtered by that one assessment / its attempt IDs.

`AssessmentDetailPage.tsx` calls both on mount instead of relying on the preloaded lists.

### 2. List pages fetch only what the current user can see

Right now `fetchAssessments()` pulls every assessment for every role. Change it to accept a scope:

- **Employee** (`My Assessments`): `.eq('employee_id', currentUserId)`
- **Manager** (`Team Assessments`): `.in('domain_id', managedDomainIds)` (already computed elsewhere)
- **Admin**: current behavior, but with `.order('created_at', desc).limit(200)` for the initial page and lazy-load on demand.

Then the child-row fetch (`assessment_questions`, attempts, etc.) uses the resulting — much smaller — `assessmentIds`, well under 1000 rows in every realistic case.

### Files touched

- `src/stores/assessmentStore.ts` — add `fetchAssessmentById`, scope `fetchAssessments` by role.
- `src/stores/attemptStore.ts` — add `fetchAttemptsForAssessment`, scope `fetchAttempts` similarly.
- `src/pages/AssessmentDetailPage.tsx` — call the by-id fetchers on mount.
- `src/pages/AssessmentsPage.tsx` / `src/pages/TeamAssessmentsPage.tsx` — pass the current user / managed domains into `fetchAssessments`.

## Verification

1. Reload `/team-assessments/8a6e7b8c-…` — badge reads **4**, all four questions render (2× L3, 2× L4), stable order.
2. `AssessmentsPage` and `TeamAssessmentsPage` still list the right assessments for each role.
3. Network tab shows scoped queries (small `assessment_id` filters, no full-table pulls).

## Non-goals

- No schema, RLS, or adaptive-engine changes.
- Not migrating to nested PostgREST selects in this pass.
